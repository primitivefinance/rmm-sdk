import { callDelta, getStableGivenRiskyApproximation, quantilePrime } from '@primitivefinance/v2-math'
import { utils, BigNumber } from 'ethers'
import { isAddress } from 'ethers/lib/utils'
import invariant from 'tiny-invariant'
import { parseWei, Time, Wei } from 'web3-units'
const { keccak256, solidityPack } = utils

export class PoolSimple {
  public readonly address: string
  public readonly decimals = 18
  public readonly token0: string
  public readonly token1: string
  public readonly decimals0: number
  public readonly decimals1: number
  public readonly strike: number
  public readonly maturityTimestamp: number
  public readonly lastTimestamp: number
  public readonly sigmaBasisPts: number
  public readonly feeBasisPts: number
  public readonly priceToken1PerToken0: number
  public gammaBasisPts: number
  public strikeWei: Wei

  public reserveRisky: Wei
  public reserveStable: Wei
  public liquidity: Wei

  constructor(
    address: string,
    token0: string,
    token1: string,
    decimals0: number,
    decimals1: number,
    strike: number | Wei,
    maturityTimestamp: number,
    lastTimestamp: number,
    sigmaBasisPts: number,
    feeBasisPts: number,
    priceToken1PerToken0: number,
    overrideReserves?: {
      risky?: Wei
      stable?: Wei
      liquidity?: Wei
    }
  ) {
    this.address = address
    this.token0 = token0
    this.token1 = token1
    this.decimals0 = decimals0
    this.decimals1 = decimals1

    this.strike = typeof strike !== 'number' ? strike.float : strike
    this.maturityTimestamp = maturityTimestamp
    this.lastTimestamp = lastTimestamp
    this.sigmaBasisPts = sigmaBasisPts
    this.feeBasisPts = feeBasisPts
    this.priceToken1PerToken0 = priceToken1PerToken0
    this.gammaBasisPts = 1e4 - feeBasisPts
    this.strikeWei = typeof strike !== 'number' ? strike : parseWei(strike, decimals1)

    const maxPrice = typeof strike !== 'number' ? strike.float : strike
    const tau = new Time(maturityTimestamp).sub(lastTimestamp)

    let reserveRisky: Wei // store in memory to reference if needed to compute stable side of pool
    if (overrideReserves?.risky) {
      const { risky } = overrideReserves
      invariant(risky?.decimals === decimals0, `Risky decimals ${risky?.decimals} != ${decimals0}`)
      reserveRisky = risky
    } else {
      const oppositeDelta = PoolSimple.getRiskyGivenPrice(maxPrice, sigmaBasisPts, tau.years, priceToken1PerToken0)
      const formatted = oppositeDelta.toFixed(decimals0)
      reserveRisky = parseWei(formatted, decimals0)
    }
    this.reserveRisky = reserveRisky

    if (overrideReserves?.stable) {
      const { stable } = overrideReserves
      invariant(stable?.decimals === decimals1, `Stable decimals ${stable?.decimals} != ${decimals1}`)
      this.reserveStable = stable
    } else {
      const balance = getStableGivenRiskyApproximation(reserveRisky.float, maxPrice, sigmaBasisPts, tau.years)
      const formatted = balance.toFixed(decimals1)
      this.reserveStable = parseWei(formatted, decimals1)
    }

    if (overrideReserves?.liquidity) {
      const { liquidity } = overrideReserves
      invariant(liquidity?.decimals === this.decimals, `Liquidity decimals ${liquidity?.decimals} != ${this.decimals}`)
      this.liquidity = overrideReserves?.liquidity
    } else {
      this.liquidity = parseWei(1, 18)
    }
  }

  /**
   * @notice Keccak256 hash of the parameters and the engine address
   */
  get id(): string {
    return PoolSimple.computePoolId(
      this.address,
      this.strikeWei.raw,
      this.sigmaBasisPts,
      this.maturityTimestamp,
      this.gammaBasisPts
    )
  }

  public static getRiskyGivenPrice(
    strikeFloating: number,
    sigmaBasisPts: number,
    tauYears: number,
    priceToken1PerToken0: number
  ): number {
    return 1 - callDelta(strikeFloating, sigmaBasisPts, tauYears, priceToken1PerToken0)
  }

  /**
   * @notice Each Primitive pool has a unique pool identifier
   * @param engine Address of Engine which the pool is created from
   * @param strike Max price in wei, with same decimals as the `stable` token
   * @param sigma Implied volatility in basis points
   * @param maturity Maturity timestamp in seconds
   * @param gamma 1 - fee, in basis points
   * @returns poolId Keccak256 hash of these parameters
   */
  public static computePoolId(
    engine: string,
    strike: number | string | BigNumber,
    sigma: number | string | BigNumber,
    maturity: number | string | number,
    gamma: number | string | BigNumber
  ): string {
    invariant(isAddress(engine), 'Invalid address when computing pool id')
    invariant(Math.floor(Number(strike)) > 0, `Strike must be an integer in units of wei: ${strike}`)
    invariant(sigma > 1 && sigma <= 1e7, `Sigma out of bounds > 1 || <= 1e7 bps: ${sigma}`)
    invariant(gamma >= 9e3 && gamma < 1e4, `Gamma out of bounds >= 9e3 && < 1e4 bps: ${gamma}`)
    invariant(maturity > 0 && maturity < (2 ^ 32) - 1, `Maturity out of bounds > 0 && < 2^32 -1: ${maturity}`)
    return keccak256(
      solidityPack(['address', 'uint128', 'uint32', 'uint32', 'uint32'], [engine, strike, sigma, maturity, gamma])
    )
  }

  /**
   * @returns Time until expiry in seconds
   */
  get tau(): Time {
    return new Time(this.maturityTimestamp).sub(this.lastTimestamp)
  }

  get spotPrice(): Wei {
    const risky = this.reserveRisky.float / this.liquidity.float
    const tau = this.tau.years
    const spot = PoolSimple.poolPriceToken1PerToken0(risky, this.strike, this.sigmaBasisPts, tau).toFixed(
      this.decimals1
    )
    return parseWei(spot, this.decimals1)
  }

  public static poolPriceToken1PerToken0(
    balance0Floating: number,
    strikeFloating: number,
    sigmaBasisPts: number,
    tauYears: number
  ): number {
    return (
      getStableGivenRiskyApproximation(balance0Floating, strikeFloating, sigmaBasisPts, tauYears) *
      quantilePrime(1 - balance0Floating)
    )
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

  public static getMarginalPriceSwapRiskyIn(amountIn: number) {
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
}
