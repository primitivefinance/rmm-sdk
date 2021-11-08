import { Wei, Time, FixedPointX64, parseFixedPointX64, parseWei, toBN } from 'web3-units'
import {
  quantilePrime,
  std_n_pdf,
  inverse_std_n_cdf,
  nonNegative,
  callPremiumApproximation
} from '@primitivefinance/v2-math'
import {
  getStableGivenRiskyApproximation,
  getRiskyGivenStableApproximation,
  getInvariantApproximation
} from '@primitivefinance/v2-math'
import { Engine } from './engine'
import { Calibration } from './calibration'
import { Token } from '@uniswap/sdk-core'
import { PERCENTAGE } from '../constants'
import { callDelta, callPremium } from '@primitivefinance/v2-math'
import invariant from 'tiny-invariant'

export interface SwapReturn {
  deltaOut: Wei
  pool: Pool
  effectivePriceOutStable?: Wei
}

export interface DebugReturn extends SwapReturn {
  invariantLast?: FixedPointX64
  deltaInWithFee?: Wei
  nextInvariant?: FixedPointX64
}

/**
 * @notice Virtualized instance of a pool using reserve and liquidity amounts from state
 */
export class Pool extends Calibration {
  public static readonly FEE: number = Engine.GAMMA / PERCENTAGE

  /// ===== State of Virtual Pool =====
  public liquidity: Wei
  public reserveRisky: Wei
  public reserveStable: Wei
  public invariant: FixedPointX64

  /**
   * @notice Time until expiry is calculated from the difference of current timestamp and this
   */
  public readonly lastTimestamp: Time
  /**
   * @notice Price of risky token denominated in stable tokens, with the precision of the stable tokens
   */
  public spot: Wei

  /**
   * @notice Builds a typescript representation of a single curve within an Engine contract
   * @param reserveRisky Reserve amount to initialize the pool's risky tokens
   * @param liquidity Total liquidity supply to initialize the pool with
   * @param overrideStable The initial stable reserve value
   */
  constructor(
    factory: string,
    risky: Token,
    stable: Token,
    strike: number,
    sigma: number,
    maturity: number,
    gamma: number,
    lastTimestamp: number,
    reserveRisky: Wei,
    reserveStable: Wei,
    liquidity: Wei,
    spot = 0
  ) {
    super(factory, risky, stable, strike, sigma, maturity, gamma)

    // ===== Calibration State =====
    this.lastTimestamp = new Time(lastTimestamp) // in seconds, because `block.timestamp` is in seconds
    this.spot = spot ? parseWei(spot, stable.decimals) : parseWei(0, stable.decimals)

    // ===== Token & Liquidity State =====
    this.reserveRisky = reserveRisky
    this.reserveStable = reserveStable
    this.liquidity = liquidity

    // ===== Invariant ====-
    this.invariant = parseFixedPointX64(0)

    if (reserveRisky.decimals !== risky.decimals)
      throw new Error(
        `Decimals for the risky token ${risky.decimals} doesn't match reserveRisky decimals: ${reserveRisky.decimals}`
      )

    if (reserveStable.decimals !== stable.decimals)
      throw new Error(
        `Decimals for the stable token ${stable.decimals} doesn't match reserveStable decimals: ${reserveStable.decimals}`
      )

    if (liquidity.decimals !== 18) throw new Error(`Liquidity decimals of ${liquidity.decimals} is not 18`)
  }

  // ===== Calibration =====
  /**
   * @returns Time until expiry in seconds
   */
  get tau(): Time {
    return this.maturity.sub(this.lastTimestamp)
  }

  /**
   * @returns Total lifetime of a pool in seconds
   */
  get remaining(): Time {
    const now = this.maturity.now
    if (now >= this.maturity.raw) return new Time(0)

    return this.maturity.sub(now)
  }

  /**
   * @returns expired if time until expiry is lte 0
   */
  get expired(): boolean {
    return this.remaining.raw <= 0
  }

  /**
   * @returns Change in pool premium wrt change in underlying spot price
   */
  get delta(): number {
    return this.spot ? callDelta(this.strike.float, this.sigma.float, this.tau.years, this.spot.float) : 0
  }

  /**
   * @returns Black-Scholes implied premium
   */
  get premium(): number {
    return this.spot ? callPremium(this.strike.float, this.sigma.float, this.tau.years, this.spot.float) : 0
  }

  /**
   * @returns Spot price is above strike price
   */
  get inTheMoney(): boolean {
    return this.spot ? this.strike.float >= this.spot.float : false
  }

  // ===== Liquidity =====

  /**
   * @notice Calculates the other side of the pool using the known amount of a side of the pool
   * @param amount Amount of token
   * @param token Token side of the pool that is used to calculate the other side
   * @param fresh If instantiating a fresh pool, use the spot price (passed in constructor) to get reserves
   * @returns risky token amount, stable token amount, and liquidity amount
   */
  liquidityQuote(amount: Wei, token: Token, fresh?: boolean): { delRisky: Wei; delStable: Wei; delLiquidity: Wei } {
    let delRisky: Wei = parseWei(0)
    let delStable: Wei = parseWei(0)
    let delLiquidity: Wei = parseWei(0)

    let reserveRisky: Wei = parseWei(0)
    let reserveStable: Wei = parseWei(0)
    let liquidity: Wei = parseWei(0)

    if (fresh) {
      invariant(this.spot.gt(0), 'Spot price is not greater than zero')
      reserveRisky = parseWei(1 - this.delta, this.risky.decimals)
      reserveStable = this.getStableGivenRisky(reserveRisky, true)
      liquidity = parseWei(1, 18)
    } else {
      reserveRisky = this.reserveRisky
      reserveStable = this.reserveStable
      liquidity = this.liquidity
    }

    switch (token) {
      case this.risky:
        delRisky = amount
        delLiquidity = delRisky.mul(liquidity).div(reserveRisky)
        delStable = delLiquidity.mul(reserveStable).div(liquidity)
        break
      case this.stable:
        delStable = amount
        delLiquidity = delStable.mul(liquidity).div(reserveStable)
        delRisky = delLiquidity.mul(reserveRisky).div(liquidity)
        break
      case this:
        delLiquidity = amount
        delRisky = delLiquidity.mul(reserveRisky).div(liquidity)
        delStable = delLiquidity.mul(reserveStable).div(liquidity)
        break
      default:
        break
    }
    return { delRisky, delStable, delLiquidity }
  }

  /**
   * @param reserveRisky Amount of risky tokens in reserve
   * @return reserveStable Expected amount of stable token reserves
   */
  getStableGivenRisky(reserveRisky: Wei, noInvariant = false): Wei {
    const decimals = this.reserveStable.decimals
    const invariant = this.invariant.parsed

    const stable = getStableGivenRiskyApproximation(
      reserveRisky.float,
      this.strike.float,
      this.sigma.float,
      this.tau.years,
      noInvariant ? 0 : invariant
    )

    if (isNaN(stable)) return parseWei(0, decimals)
    return parseWei(stable, decimals)
  }

  /**
   *
   * @param reserveStable Amount of stable tokens in reserve
   * @return reserveRisky Expected amount of risky token reserves
   */
  getRiskyGivenStable(reserveStable: Wei, noInvariant = false): Wei {
    const decimals = this.reserveRisky.decimals
    const invariant = this.invariant.parsed

    const risky = getRiskyGivenStableApproximation(
      reserveStable.float,
      this.strike.float,
      this.sigma.float,
      this.tau.years,
      noInvariant ? 0 : invariant
    )

    if (isNaN(risky)) return parseWei(0, decimals)
    return parseWei(risky, decimals)
  }

  /**
   * @return invariant Calculated invariant using this Pool's state
   */
  calcInvariant(): FixedPointX64 {
    const risky = this.reserveRisky.float / this.liquidity.float
    const stable = this.reserveStable.float / this.liquidity.float
    let invariant = getInvariantApproximation(risky, stable, this.strike.float, this.sigma.float, this.tau.years)
    invariant = Math.floor(invariant * Math.pow(10, 18))
    this.invariant = new FixedPointX64(
      toBN(isNaN(invariant) ? 0 : invariant)
        .mul(FixedPointX64.Denominator)
        .div(Engine.PRECISION.raw)
    )
    return this.invariant
  }

  private get defaultSwapReturn(): SwapReturn {
    return { deltaOut: parseWei(0), pool: this, effectivePriceOutStable: parseWei(0) }
  }

  /**
   * @notice A Risky to Stable token swap
   */
  swapAmountInRisky(deltaIn: Wei): DebugReturn {
    if (deltaIn.raw.isNegative()) return this.defaultSwapReturn
    const reserveStableLast = this.reserveStable
    const reserveRiskyLast = this.reserveRisky

    // Updates `tau` and `invariant` state of this virtual pool
    const invariantLast: FixedPointX64 = this.calcInvariant()

    // 0. Calculate the new risky reserves (we know the new risky reserves because we are swapping in risky)
    const deltaInWithFee = deltaIn.mul(Engine.GAMMA).div(PERCENTAGE)
    // 1. Calculate the new stable reserve using the new risky reserve
    const newRiskyReserve = reserveRiskyLast
      .add(deltaInWithFee)
      .mul(Engine.PRECISION)
      .div(this.liquidity)

    const newReserveStable = this.getStableGivenRisky(newRiskyReserve)
      .mul(this.liquidity)
      .div(Engine.PRECISION)

    if (newReserveStable.raw.isNegative()) return this.defaultSwapReturn

    const deltaOut = reserveStableLast.sub(newReserveStable)

    this.reserveRisky = this.reserveRisky.add(deltaIn)
    this.reserveStable = this.reserveStable.sub(deltaOut)

    // 2. Calculate the new invariant with the new reserve values
    const nextInvariant = this.calcInvariant()
    // 3. Check the nextInvariant is >= invariantLast in the fee-less case, set it if valid
    if (nextInvariant.percentage < invariantLast.percentage)
      console.log('invariant not passing', `${nextInvariant.percentage} < ${invariantLast.percentage}`)

    const effectivePriceOutStable = deltaOut
      .mul(parseWei(1, 18 - deltaOut.decimals))
      .div(deltaIn.mul(parseWei(1, 18 - deltaIn.decimals))) // stable per risky

    return { invariantLast, deltaInWithFee, nextInvariant, deltaOut, pool: this, effectivePriceOutStable }
  }

  virtualSwapAmountInRisky(deltaIn: Wei): DebugReturn {
    if (deltaIn.raw.isNegative()) return this.defaultSwapReturn
    const reserveRiskyLast = this.reserveRisky
    const reserveStableLast = this.reserveStable
    const invariantLast: FixedPointX64 = this.calcInvariant()
    const deltaInWithFee = deltaIn.mul(Engine.GAMMA).div(PERCENTAGE)

    const newReserveRisky = reserveRiskyLast
      .add(deltaInWithFee)
      .mul(Engine.PRECISION)
      .div(this.liquidity)

    const newReserveStable = this.getStableGivenRisky(newReserveRisky)
      .mul(this.liquidity)
      .div(Engine.PRECISION)

    if (newReserveStable.raw.isNegative()) return this.defaultSwapReturn

    const deltaOut = reserveStableLast.sub(newReserveStable)

    const risky = reserveRiskyLast.add(deltaIn).float / this.liquidity.float
    const stable = reserveStableLast.sub(deltaOut).float / this.liquidity.float
    let nextInvariant: any = getInvariantApproximation(
      risky,
      stable,
      this.strike.float,
      this.sigma.float,
      this.tau.years
    )
    nextInvariant = Math.floor(nextInvariant * Math.pow(10, 18))
    nextInvariant = new FixedPointX64(
      toBN(nextInvariant)
        .mul(FixedPointX64.Denominator)
        .div(Engine.PRECISION.raw)
    )
    const effectivePriceOutStable = deltaOut
      .mul(parseWei(1, 18 - deltaOut.decimals))
      .div(deltaIn.mul(parseWei(1, 18 - deltaIn.decimals)))

    return { invariantLast, deltaInWithFee, nextInvariant, deltaOut, pool: this, effectivePriceOutStable }
  }

  /**
   * @notice A Stable to Risky token swap
   */
  swapAmountInStable(deltaIn: Wei): DebugReturn {
    if (deltaIn.raw.isNegative()) return this.defaultSwapReturn
    const reserveRiskyLast = this.reserveRisky
    const reserveStableLast = this.reserveStable

    // Important: Updates the invariant and tau state of this pool
    const invariantLast: FixedPointX64 = this.calcInvariant()

    // 0. Calculate the new risky reserve since we know how much risky is being swapped out
    const deltaInWithFee = deltaIn.mul(Engine.GAMMA).div(PERCENTAGE)
    // 1. Calculate the new risky reserves using the known new stable reserves
    const newStableReserve = reserveStableLast
      .add(deltaInWithFee)
      .mul(Engine.PRECISION)
      .div(this.liquidity)

    const newReserveRisky = this.getRiskyGivenStable(newStableReserve)
      .mul(this.liquidity)
      .div(Engine.PRECISION)

    if (newReserveRisky.raw.isNegative()) return this.defaultSwapReturn

    const deltaOut = reserveRiskyLast.sub(newReserveRisky)

    this.reserveStable = this.reserveStable.add(deltaIn)
    this.reserveRisky = this.reserveRisky.sub(deltaOut)

    // 2. Calculate the new invariant with the new reserves
    const nextInvariant = this.calcInvariant()
    // 3. Check the nextInvariant is >= invariantLast
    if (nextInvariant.parsed < invariantLast.parsed)
      console.log('invariant not passing', `${nextInvariant.parsed} < ${invariantLast.parsed}`)
    // 4. Calculate the change in risky reserve by comparing new reserve to previous
    const effectivePriceOutStable = deltaIn
      .mul(parseWei(1, 18 - deltaIn.decimals))
      .div(deltaOut.mul(parseWei(1, 18 - deltaOut.decimals))) // stable per risky

    return { invariantLast, deltaInWithFee, nextInvariant, deltaOut, pool: this, effectivePriceOutStable }
  }

  virtualSwapAmountInStable(deltaIn: Wei): DebugReturn {
    if (deltaIn.raw.isNegative()) return this.defaultSwapReturn
    const reserveRiskyLast = this.reserveRisky
    const reserveStableLast = this.reserveStable
    const invariantLast: FixedPointX64 = this.calcInvariant()
    const deltaInWithFee = deltaIn.mul(Engine.GAMMA).div(PERCENTAGE)

    const newStableReserve = reserveStableLast
      .add(deltaInWithFee)
      .mul(Engine.PRECISION)
      .div(this.liquidity)

    const newReserveRisky = this.getRiskyGivenStable(newStableReserve)
      .mul(this.liquidity)
      .div(Engine.PRECISION)

    if (newReserveRisky.raw.isNegative()) return this.defaultSwapReturn

    const deltaOut = reserveRiskyLast.sub(newReserveRisky)

    const risky = reserveRiskyLast.sub(deltaOut).float / this.liquidity.float
    const stable = reserveStableLast.add(deltaIn).float / this.liquidity.float

    let nextInvariant: any = getInvariantApproximation(
      risky,
      stable,
      this.strike.float,
      this.sigma.float,
      this.tau.years
    )
    nextInvariant = Math.floor(nextInvariant * Math.pow(10, 18))
    nextInvariant = new FixedPointX64(
      toBN(nextInvariant)
        .mul(FixedPointX64.Denominator)
        .div(Engine.PRECISION.raw)
    )

    const effectivePriceOutStable = deltaIn
      .mul(parseWei(1, 18 - deltaIn.decimals))
      .div(deltaOut.mul(parseWei(1, 18 - deltaOut.decimals)))

    return { invariantLast, deltaInWithFee, nextInvariant, deltaOut, pool: this, effectivePriceOutStable }
  }

  get spotPrice(): Wei {
    const risky = this.reserveRisky.float / this.liquidity.float
    const strike = this.strike.float
    const sigma = this.sigma.float
    const tau = this.tau.years
    const spot = getStableGivenRiskyApproximation(risky, strike, sigma, tau) * quantilePrime(1 - risky)
    return parseWei(spot, this.stable.decimals)
  }

  /**
   * @notice See https://arxiv.org/pdf/2012.08040.pdf
   * @param amountIn Amount of risky token to add to risky reserve
   * @return Marginal price after a trade with size `amountIn` with the current reserves.
   */
  getMarginalPriceSwapRiskyIn(amountIn: number) {
    if (!nonNegative(amountIn)) return 0
    const gamma = 1 - Pool.FEE
    const reserveRisky = this.reserveRisky.float / this.liquidity.float
    //const invariant = this.invariant
    const strike = this.strike
    const sigma = this.sigma
    const tau = this.tau
    const step0 = 1 - reserveRisky - gamma * amountIn
    const step1 = sigma.float * Math.sqrt(tau.years)
    const step2 = quantilePrime(step0)
    const step3 = gamma * strike.float
    const step4 = inverse_std_n_cdf(step0)
    const step5 = std_n_pdf(step4 - step1)
    return step3 * step5 * step2
  }

  /**
   * @notice See https://arxiv.org/pdf/2012.08040.pdf
   * @param amountIn Amount of stable token to add to stable reserve
   * @return Marginal price after a trade with size `amountIn` with the current reserves.
   */
  getMarginalPriceSwapStableIn(amountIn: number) {
    if (!nonNegative(amountIn)) return 0
    const gamma = 1 - Pool.FEE
    const reserveStable = this.reserveStable.float / this.liquidity.float
    const invariant = this.invariant
    const strike = this.strike
    const sigma = this.sigma
    const tau = this.tau
    const step0 = (reserveStable + gamma * amountIn - invariant.parsed / Math.pow(10, 18)) / strike.float
    const step1 = sigma.float * Math.sqrt(tau.years)
    const step3 = inverse_std_n_cdf(step0)
    const step4 = std_n_pdf(step3 + step1)
    const step5 = step0 * (1 / strike.float)
    const step6 = quantilePrime(step5)
    const step7 = gamma * step4 * step6
    return 1 / step7
  }

  /**
   * @notice Calculates the current value of the pool, compare this to the current theoretical value
   * @dev Denominating prices in a dollar-pegged stable coin will be easiest to calculate other values with
   * @param priceOfRisky Multiplier for the price of the risky asset
   * @param priceOfStable Multiplier for the price of the stable asset, defaults to 1 given the priceOfRisky is denominated in that asset
   * @returns value per liquidity and values of each side of the pool, denominated in `prices` units
   */
  getCurrentLiquidityValue(priceOfRisky: number, priceOfStable = 1): { valuePerLiquidity: Wei; values: Wei[] } {
    const reserve0 = this.reserveRisky
    const reserve1 = this.reserveStable
    const liquidity = this.liquidity

    const values = [
      reserve0.mul(parseWei(priceOfRisky, reserve0.decimals)).div(parseWei(1, reserve0.decimals)),
      reserve1.mul(parseWei(priceOfStable, reserve1.decimals)).div(parseWei(1, reserve1.decimals))
    ]

    const sum = values[0].add(values[1])
    const valuePerLiquidity = sum.mul(1e18).div(liquidity)
    return { valuePerLiquidity, values }
  }

  /**
   * @notice Calculates the theoretical fee's generated using a pool's creation timestamp
   * @param lastTimestamp Unix timestamp in seconds of the pool's last update
   * @returns Strike price - call premium, denominated in a stable asset
   */
  getTheoreticalLiquidityValue(lastTimestamp = this.lastTimestamp.raw): number {
    const totalTau = new Time(this.maturity.raw - lastTimestamp).years
    const premium = callPremiumApproximation(this.strike.float, this.sigma.float, totalTau, this.spot.float)
    return this.strike.float - premium
  }
}
