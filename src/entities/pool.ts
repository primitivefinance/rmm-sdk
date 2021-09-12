import { Wei, Time, FixedPointX64, parseFixedPointX64, parseWei, toBN } from 'web3-units'
import { quantilePrime, std_n_pdf, inverse_std_n_cdf, nonNegative } from '@primitivefinance/v2-math'
import { getStableGivenRisky, getRiskyGivenStable, calcInvariant } from '@primitivefinance/v2-math'
import { Engine } from './engine'
import { Calibration } from './calibration'
import { Token } from '@uniswap/sdk-core'
import { PERCENTAGE } from '..'

export const clonePool = (poolToClone: VirtualPool, newRisky: Wei, newStable: Wei): VirtualPool => {
  return new VirtualPool(poolToClone.cal, newRisky, poolToClone.liquidity, newStable ?? newStable)
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
 * @notice Real pool using on-chain reserves
 */
export class Pool extends Calibration {
  /**
   * @notice Use the virtual pool to simulate swaps
   */
  public readonly virtual: VirtualPool

  constructor(params: PoolParameters, state: PoolState) {
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

    this.virtual = new VirtualPool(this, state.reserveRisky, state.liquidity, state.reserveStable)
  }
}

export function scaleUp(value: number, decimals: number): Wei {
  const scaleFactor = Math.pow(10, decimals)
  const scaled = Math.floor(value * scaleFactor) / scaleFactor
  return new Wei(toBN(scaled), decimals)
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
  constructor(cal: Calibration, initialRisky: Wei, liquidity: Wei, overrideStable?: Wei) {
    // ===== State =====
    this.reserveRisky = initialRisky
    this.liquidity = liquidity
    this.cal = cal
    // ===== Calculations using State ====-
    this.tau = this.calcTau() // maturity - lastTimestamp
    this.invariant = parseFixedPointX64(0)
    this.reserveStable = overrideStable ? overrideStable : this.getStableGivenRisky(this.reserveRisky)
  }

  /**
   * @param reserveRisky Amount of risky tokens in reserve
   * @return reserveStable Expected amount of stable token reserves
   */
  getStableGivenRisky(reserveRisky: Wei, noInvariant?: boolean): Wei {
    const decimals = this.reserveStable.decimals
    let invariant = this.invariant.parsed
    invariant = Math.abs(invariant) >= 1e-8 ? invariant : 0

    let stable = getStableGivenRisky(
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
    invariant = Math.abs(invariant) >= 1e-8 ? invariant : 0

    let risky = getRiskyGivenStable(
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
    let invariant = calcInvariant(risky, stable, this.cal.strike.float, this.cal.sigma.float, this.tau.years)
    invariant = Math.floor(invariant * Math.pow(10, 18))
    this.invariant = new FixedPointX64(
      toBN(invariant === NaN ? 0 : invariant)
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
    let nextInvariant: any = calcInvariant(risky, stable, this.cal.strike.float, this.cal.sigma.float, this.tau.years)
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

    let nextInvariant: any = calcInvariant(risky, stable, this.cal.strike.float, this.cal.sigma.float, this.tau.years)
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
    const spot = getStableGivenRisky(risky, strike, sigma, tau) * quantilePrime(1 - risky)
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
}
