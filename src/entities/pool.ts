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
import { PERCENTAGE, EMPTY_CALIBRATION } from '../constants'

export function scaleUp(value: number, decimals: number): Wei {
  const scaled = Math.floor(value * Math.pow(10, decimals)) / Math.pow(10, decimals)
  return parseWei(scaled.toFixed(decimals), decimals)
}

export function clonePool(poolToClone: VirtualPool, newRisky: Wei, newStable: Wei): VirtualPool {
  return new VirtualPool(
    poolToClone.cal,
    newRisky,
    poolToClone.liquidity,
    poolToClone.reserveStable.decimals,
    newStable ?? newStable
  )
}

export interface SwapReturn {
  deltaOut: Wei
  pool: VirtualPool
  effectivePriceOutStable?: Wei
}

export interface DebugReturn extends SwapReturn {
  invariantLast?: FixedPointX64
  deltaInWithFee?: Wei
  nextInvariant?: FixedPointX64
}

export interface PoolParameters {
  factory: string
  risky: Token
  stable: Token
  strike: number
  sigma: number
  maturity: number
  lastTimestamp: number
  spot?: number
}

export interface PoolState {
  reserveRisky: Wei
  reserveStable: Wei
  liquidity: Wei
}

/**
 * @notice Virtualized instance of a pool using any reserve amounts
 */
export class VirtualPool {
  public static readonly FEE: number = Engine.GAMMA / PERCENTAGE
  public readonly liquidity: Wei
  public readonly cal: Calibration

  /// ===== State of Virtual Pool =====
  public reserveRisky: Wei
  public reserveStable: Wei
  public invariant: FixedPointX64
  public tau: Time
  public debug: boolean = false

  /**
   * @notice Builds a typescript representation of a single curve within an Engine contract
   * @param initialRisky Reserve amount to initialize the pool's risky tokens
   * @param liquidity Total liquidity supply to initialize the pool with
   * @param overrideStable The initial stable reserve value
   */
  constructor(cal: Calibration, initialRisky: Wei, liquidity: Wei, stableDecimals = 18, overrideStable?: Wei) {
    // ===== State =====
    this.reserveRisky = initialRisky
    this.liquidity = liquidity
    this.cal = cal
    // ===== Calculations using State ====-
    this.tau = this.calcTau() // maturity - lastTimestamp
    this.invariant = parseFixedPointX64(0)

    if (overrideStable) {
      this.reserveStable = overrideStable
    } else {
      let stable = getStableGivenRiskyApproximation(
        initialRisky.float,
        cal.strike.float,
        cal.sigma.float,
        cal.tau.years,
        0
      )

      let resStable: Wei
      if (isNaN(stable)) resStable = parseWei(0, stableDecimals)
      resStable = scaleUp(stable, stableDecimals)

      this.reserveStable = resStable
    }
  }

  // ===== Liquidity =====

  /**
   * @notice Calculates the other side of the pool using the known amount of a side of the pool
   * @param amount Amount of token
   * @param token Token side of the pool that is used to calculate the other side
   * @returns risky token amount, stable token amount, and liquidity amount
   */
  quote(amount: Wei, token: Token): { delRisky: Wei; delStable: Wei; delLiquidity: Wei } {
    let delRisky: Wei
    let delStable: Wei
    let delLiquidity: Wei
    if (token.equals(this.cal.risky)) {
      delRisky = amount
      delLiquidity = delRisky.mul(this.liquidity).div(this.reserveRisky)
      delStable = delLiquidity.mul(this.reserveStable).div(this.liquidity)
    } else if (token.equals(this.cal.stable)) {
      delStable = amount
      delLiquidity = delStable.mul(this.liquidity).div(this.reserveStable)
      delRisky = delLiquidity.mul(this.reserveRisky).div(this.liquidity)
    } else {
      delLiquidity = amount
      delRisky = delLiquidity.mul(this.reserveRisky).div(this.liquidity)
      delStable = delLiquidity.mul(this.reserveStable).div(this.liquidity)
    }

    return { delRisky, delStable, delLiquidity }
  }

  /**
   * @param reserveRisky Amount of risky tokens in reserve
   * @return reserveStable Expected amount of stable token reserves
   */
  getStableGivenRisky(reserveRisky: Wei, noInvariant?: boolean): Wei {
    const decimals = this.reserveStable.decimals
    let invariant = this.invariant.parsed

    let stable = getStableGivenRiskyApproximation(
      reserveRisky.float,
      this.cal.strike.float,
      this.cal.sigma.float,
      this.tau.years,
      noInvariant ? 0 : invariant
    )

    if (isNaN(stable)) return parseWei(0, decimals)
    return scaleUp(stable, decimals)
  }

  /**
   *
   * @param reserveStable Amount of stable tokens in reserve
   * @return reserveRisky Expected amount of risky token reserves
   */
  getRiskyGivenStable(reserveStable: Wei, noInvariant?: boolean): Wei {
    const decimals = this.reserveRisky.decimals
    let invariant = this.invariant.parsed

    let risky = getRiskyGivenStableApproximation(
      reserveStable.float,
      this.cal.strike.float,
      this.cal.sigma.float,
      this.tau.years,
      noInvariant ? 0 : invariant
    )

    if (isNaN(risky)) return parseWei(0, decimals)
    return scaleUp(risky, decimals)
  }

  /**
   * @return tau Calculated tau using this Pool's maturity timestamp and lastTimestamp
   */
  calcTau(): Time {
    this.tau = this.cal.maturity.sub(this.cal.lastTimestamp)
    return this.tau
  }

  /**
   * @return invariant Calculated invariant using this Pool's state
   */
  calcInvariant(): FixedPointX64 {
    const risky = this.reserveRisky.float / this.liquidity.float
    const stable = this.reserveStable.float / this.liquidity.float
    let invariant = getInvariantApproximation(
      risky,
      stable,
      this.cal.strike.float,
      this.cal.sigma.float,
      this.tau.years
    )
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
      this.cal.strike.float,
      this.cal.sigma.float,
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
      this.cal.strike.float,
      this.cal.sigma.float,
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
    const strike = this.cal.strike.float
    const sigma = this.cal.sigma.float
    const tau = this.tau.years
    const spot = getStableGivenRiskyApproximation(risky, strike, sigma, tau) * quantilePrime(1 - risky)
    return parseWei(spot)
  }

  /**
   * @notice See https://arxiv.org/pdf/2012.08040.pdf
   * @param amountIn Amount of risky token to add to risky reserve
   * @return Marginal price after a trade with size `amountIn` with the current reserves.
   */
  getMarginalPriceSwapRiskyIn(amountIn: number) {
    if (!nonNegative(amountIn)) return 0
    const gamma = 1 - VirtualPool.FEE
    const reserveRisky = this.reserveRisky.float / this.liquidity.float
    //const invariant = this.invariant
    const strike = this.cal.strike
    const sigma = this.cal.sigma
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
    const gamma = 1 - VirtualPool.FEE
    const reserveStable = this.reserveStable.float / this.liquidity.float
    const invariant = this.invariant
    const strike = this.cal.strike
    const sigma = this.cal.sigma
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
   * @param prices Multiplier for each side of the pool, to convert to a respective price. E.g. [price(ETH, usd), price(USDC, usd)]
   * @returns value per liquidity and values of each side of the pool, denominated in `prices` units
   */
  getCurrentLiquidityValue(prices: number[]): { valuePerLiquidity: Wei; values: Wei[] } {
    const reserve0 = this.reserveRisky
    const reserve1 = this.reserveStable
    const liquidity = this.liquidity

    const values = [
      reserve0.mul(scaleUp(prices[0], reserve0.decimals)).div(parseWei(1, reserve0.decimals)),
      reserve1.mul(scaleUp(prices[1], reserve1.decimals)).div(parseWei(1, reserve1.decimals))
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
  getTheoreticalLiquidityValue(lastTimestamp = this.cal.lastTimestamp.raw): number {
    const totalTau = new Time(this.cal.maturity.raw - lastTimestamp).years
    const premium = callPremiumApproximation(this.cal.strike.float, this.cal.sigma.float, totalTau, this.cal.spot.float)
    return this.cal.strike.float - premium
  }

  /**
   * @notice Calculates the theoretical fees generated using a pool's creation timestamp
   * @param creationTimestamp Unix timestamp in seconds
   * @returns Theoretical premium of the replicated option using the entire lifetime of the pool
   */
  getTheoreticalMaxFee(creationTimestamp: number): number {
    const totalTau = new Time(this.cal.maturity.raw - creationTimestamp).years
    const premium = callPremiumApproximation(this.cal.strike.float, this.cal.sigma.float, totalTau, this.cal.spot.float)
    return premium
  }
}

/**
 * @notice Real pool using on-chain reserves
 */
export class Pool extends Calibration {
  private _virtual: VirtualPool

  constructor(params: PoolParameters) {
    super(
      params.factory,
      params.risky,
      params.stable,
      params.strike,
      params.sigma,
      params.maturity,
      params.lastTimestamp,
      params.spot ?? params.spot
    )

    this._virtual = EMPTY_VIRTUAL_POOL
  }

  public set virtual(virtual: VirtualPool) {
    this._virtual = virtual
  }

  public get virtual(): VirtualPool {
    return this._virtual
  }
}

export const EMPTY_VIRTUAL_POOL = new VirtualPool(EMPTY_CALIBRATION, parseWei(0), parseWei(0), 18, parseWei(0))
