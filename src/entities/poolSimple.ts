import invariant from 'tiny-invariant'

import { isAddress } from '@ethersproject/address'
import { formatFixed, BigNumber } from '@ethersproject/bignumber'
import { keccak256 } from '@ethersproject/keccak256'
import { solidityPack } from 'ethers/lib/utils'
import { FixedPointX64, parseFixedPointX64, parseWei, Time, toBN, Wei } from 'web3-units'

import {
  callDelta,
  callPremium,
  getStableGivenRiskyApproximation,
  inverse_std_n_cdf,
  nonNegative,
  quantilePrime,
  std_n_pdf
} from '@primitivefinance/v2-math'
import { PoolInterface } from './interfaces'

export enum PoolSides {
  RISKY = 'RISKY',
  STABLE = 'STABLE',
  RMM_01 = 'RMM_01'
}

/**
 * @notice RMM-01 Pool Entity
 */
export class PoolSimple {
  public readonly address: string
  public readonly decimals = 18
  public readonly risky: string
  public readonly token1: string
  public readonly decimalsRisky: number
  public readonly decimalsStable: number
  public readonly strike: Wei
  public readonly maturityTimestamp: number
  public readonly lastTimestamp: number
  public readonly sigmaBasisPts: number
  public readonly feeBasisPts: number
  public readonly gammaBasisPts: number

  /**
   * @notice Reference market spot price of the Risky asset denominated in the Stable asset
   */
  public readonly referencePriceOfRisky?: number

  public readonly invariant: FixedPointX64
  public readonly reserveRisky: Wei
  public readonly reserveStable: Wei
  public readonly liquidity: Wei

  /**
   * @notice Constructs a Pool entity from on-chain data
   * @param address Engine address which had the pool created
   * @param pool Returned data from on-chain, reconstructed to match PoolInterface or returned from the `house.uri(id)` call
   * @param decimalsRisky Decimal places of the risky token
   * @param decimalsStable Decimal places of the stable token
   * @returns Pool entity
   */
  public static from(address: string, pool: PoolInterface, decimalsRisky: number, decimalsStable: number): PoolSimple {
    const { risky, stable, calibration, reserve, invariant } = pool.properties
    return new PoolSimple(
      address,
      risky,
      stable,
      decimalsRisky,
      decimalsStable,
      calibration.strike,
      calibration.maturity,
      calibration.lastTimestamp,
      calibration.sigma,
      calibration.gamma,
      undefined,
      { ...reserve },
      invariant
    )
  }

  constructor(
    address: string,
    risky: string,
    token1: string,
    decimalsRisky: number,
    decimalsStable: number,
    strike: string,
    maturityTimestamp: number | string,
    lastTimestamp: number | string,
    sigmaBasisPts: number | string,
    gammaBasisPts: number | string,
    referencePriceOfRisky?: number,
    overrideReserves?: {
      risky?: string
      stable?: string
      liquidity?: string
    },
    overrideInvariant?: string
  ) {
    this.address = address
    this.risky = risky
    this.token1 = token1
    this.decimalsRisky = decimalsRisky
    this.decimalsStable = decimalsStable

    this.strike = new Wei(toBN(strike), decimalsStable)
    this.maturityTimestamp = Number(maturityTimestamp)
    this.lastTimestamp = Number(lastTimestamp)
    this.sigmaBasisPts = Number(sigmaBasisPts)
    this.gammaBasisPts = Number(gammaBasisPts)
    this.referencePriceOfRisky = referencePriceOfRisky
    this.feeBasisPts = Math.floor(1e4 - Number(gammaBasisPts))

    const maxPrice = parseFloat(formatFixed(strike, decimalsStable))
    const tau = new Time(Number(maturityTimestamp)).sub(lastTimestamp)

    let reserveRisky: Wei // store in memory to reference if needed to compute stable side of pool
    if (overrideReserves?.risky) {
      const { risky } = overrideReserves
      reserveRisky = new Wei(toBN(risky), decimalsRisky)
    } else {
      if (!referencePriceOfRisky) {
        const e = `Thrown on Pool constructor, if override risky reserve, must enter a stable per risky price`
        throw e
      }
      const oppositeDelta = PoolSimple.getRiskyReservesGivenReferencePrice(
        maxPrice,
        Number(sigmaBasisPts),
        tau.years,
        referencePriceOfRisky
      )
      const formatted = oppositeDelta.toFixed(decimalsRisky)
      reserveRisky = parseWei(formatted, decimalsRisky)
    }
    this.reserveRisky = reserveRisky

    if (overrideReserves?.stable) {
      const { stable } = overrideReserves
      this.reserveStable = new Wei(toBN(stable), decimalsStable)
    } else {
      const balance = getStableGivenRiskyApproximation(reserveRisky.float, maxPrice, Number(sigmaBasisPts), tau.years)
      const formatted = balance.toFixed(decimalsStable)
      this.reserveStable = parseWei(formatted, decimalsStable)
    }

    if (overrideReserves?.liquidity) {
      const { liquidity } = overrideReserves
      this.liquidity = new Wei(toBN(liquidity), 18)
    } else {
      this.liquidity = parseWei(1, 18)
    }

    if (overrideInvariant) {
      this.invariant = new FixedPointX64(toBN(overrideInvariant), decimalsStable)
    } else {
      this.invariant = parseFixedPointX64(0, decimalsStable)
    }
  }

  /**
   * @notice Keccak256 hash of the parameters and the engine address
   */
  get poolId(): string {
    return PoolSimple.computePoolId(
      this.address,
      this.strike.raw,
      this.sigmaBasisPts,
      this.maturityTimestamp,
      this.gammaBasisPts
    )
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
   * @returns Time until pool expires in seconds
   */
  get tau(): Time {
    return new Time(this.maturityTimestamp).sub(this.lastTimestamp)
  }

  /**
   * @returns Total remaining time of a pool in seconds
   */
  get remaining(): Time {
    const expiring = new Time(this.maturityTimestamp)
    if (expiring.now >= expiring.raw) return new Time(0)
    return expiring.sub(this.lastTimestamp)
  }

  /**
   * @returns Expired if time until expiry is lte 0
   */
  get expired(): boolean {
    return this.remaining.raw <= 0
  }

  /**
   * @returns Change in Black-Scholes implied premium premium wrt change in underlying spot price
   */
  get delta(): number {
    const priceOfRisky = this.referencePriceOfRisky ?? this.reportedPriceOfRisky.float
    return callDelta(this.strike.float, this.sigmaBasisPts, this.tau.years, priceOfRisky)
  }

  /**
   * @returns Black-Scholes implied premium
   */
  get premium(): number {
    const priceOfRisky = this.referencePriceOfRisky ?? this.reportedPriceOfRisky.float
    return callPremium(this.strike.float, this.sigmaBasisPts, this.tau.years, priceOfRisky)
  }

  /**
   * @returns Price of Risky asset, whether reference or reported, is greater than or equal to strike
   */
  get inTheMoney(): boolean {
    const priceOfRisky = this.referencePriceOfRisky ?? this.reportedPriceOfRisky.float
    return priceOfRisky >= this.strike.float
  }

  /**
   * @notice Calculates the other side of the pool using the known amount of a side of the pool
   * @param amount Amount of token
   * @param sideOfPool Token side of the pool that is used to calculate the other side
   * @returns risky token amount, stable token amount, and liquidity amount
   */
  liquidityQuote(amount: Wei, sideOfPool: PoolSides): { delRisky: Wei; delStable: Wei; delLiquidity: Wei } {
    const { reserveRisky, reserveStable, liquidity } = this
    return PoolSimple.getLiquidityQuote(amount, sideOfPool, reserveRisky, reserveStable, liquidity)
  }

  /**
   * @notice Calculates the other side of the pool using the known amount of a side of the pool
   * @param amount Amount of token
   * @param sideOfPool Token side of the pool that is used to calculate the other side
   * @returns risky token amount, stable token amount, and liquidity amount
   */
  public static getLiquidityQuote(
    amount: Wei,
    sideOfPool: PoolSides,
    reserveRisky: Wei,
    reserveStable: Wei,
    liquidity: Wei
  ): { delRisky: Wei; delStable: Wei; delLiquidity: Wei } {
    let delRisky: Wei = parseWei(0)
    let delStable: Wei = parseWei(0)
    let delLiquidity: Wei = parseWei(0)

    switch (sideOfPool) {
      case PoolSides.RISKY:
        delRisky = amount
        delLiquidity = liquidity.mul(delRisky).div(reserveRisky)
        delStable = reserveStable.mul(delLiquidity).div(liquidity)
        break
      case PoolSides.STABLE:
        delStable = amount
        delLiquidity = liquidity.mul(delStable).div(reserveStable)
        delRisky = reserveRisky.mul(delLiquidity).div(liquidity)
        break
      case PoolSides.RMM_01:
        delLiquidity = amount
        delRisky = reserveRisky.mul(delLiquidity).div(liquidity)
        delStable = reserveStable.mul(delLiquidity).div(liquidity)
        break
      default:
        break
    }

    invariant(delRisky.decimals === reserveRisky.decimals, 'Risky amount decimals does not match')
    invariant(delStable.decimals === reserveStable.decimals, 'Stable amount decimals does not match')
    invariant(delLiquidity.decimals === liquidity.decimals, 'Liquidity amount decimals is not 18')
    return { delRisky, delStable, delLiquidity }
  }

  /**
   * @returns Spot price of this pool, in units of Token1 per Token0
   */
  get reportedPriceOfRisky(): Wei {
    const risky = this.reserveRisky.float / this.liquidity.float
    const tau = this.tau.years
    const spot = PoolSimple.getReportedPriceOfRisky(risky, this.strike.float, this.sigmaBasisPts, tau).toFixed(
      this.decimalsStable
    )
    return parseWei(spot, this.decimalsStable)
  }

  /**
   * @returns Price of Risky denominated in Stable
   */
  public static getReportedPriceOfRisky(
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
   * @return Marginal price after an exact trade in with size `amountIn`
   */
  marginalPriceAfterSwapRiskyIn(amountIn: number) {
    return PoolSimple.getMarginalPriceSwapRiskyIn(
      this.reserveRisky.float,
      this.strike.float,
      this.sigmaBasisPts,
      this.tau.years,
      this.gammaBasisPts,
      amountIn
    )
  }

  /**
   * @notice See https://arxiv.org/pdf/2012.08040.pdf
   * @param amountIn Amount of risky token to add to risky reserve
   * @return Marginal price after an exact trade in of the RISKY asset with size `amountIn`
   */
  public static getMarginalPriceSwapRiskyIn(
    reserve0Floating: number,
    strikeFloating: number,
    sigmaBasisPts: number,
    tauYears: number,
    gammaBasisPts: number,
    amountIn: number
  ) {
    if (!nonNegative(amountIn)) return 0
    const step0 = 1 - reserve0Floating - gammaBasisPts * amountIn
    const step1 = sigmaBasisPts * Math.sqrt(tauYears)
    const step2 = quantilePrime(step0)
    const step3 = gammaBasisPts * strikeFloating
    const step4 = inverse_std_n_cdf(step0)
    const step5 = std_n_pdf(step4 - step1)
    return step3 * step5 * step2
  }

  /**
   * @return Marginal price after an exact trade in of the STABLE asset with size `amountIn`
   */
  marginalPriceAfterSwapStableIn(amountIn: number) {
    return PoolSimple.getMarginalPriceSwapStableIn(
      this.invariant.float,
      this.reserveStable.float,
      this.strike.float,
      this.sigmaBasisPts,
      this.tau.years,
      this.gammaBasisPts,
      amountIn
    )
  }

  /**
   * @notice See https://arxiv.org/pdf/2012.08040.pdf
   * @param amountIn Amount of stable token to add to stable reserve
   * @return Marginal price after an exact trade in with size `amountIn`
   */
  public static getMarginalPriceSwapStableIn(
    invariantFloating: number,
    reserve1Floating: number,
    strikeFloating: number,
    sigmaBasisPts: number,
    tauYears: number,
    gammaBasisPts: number,
    amountIn: number
  ) {
    if (!nonNegative(amountIn)) return 0
    const step0 = (reserve1Floating + gammaBasisPts * amountIn - invariantFloating) / strikeFloating
    const step1 = sigmaBasisPts * Math.sqrt(tauYears)
    const step3 = inverse_std_n_cdf(step0)
    const step4 = std_n_pdf(step3 + step1)
    const step5 = step0 * (1 / strikeFloating)
    const step6 = quantilePrime(step5)
    const step7 = gammaBasisPts * step4 * step6
    return 1 / step7
  }

  /**
   * @notice  Equal to the Delta (option greeks) exposure of one liquidity
   * @returns Amount of optimal risky reserves per liquidity given a reference price of the risky
   */
  public static getRiskyReservesGivenReferencePrice(
    strikeFloating: number,
    sigmaBasisPts: number,
    tauYears: number,
    referencePriceOfRisky: number
  ): number {
    return 1 - callDelta(strikeFloating, sigmaBasisPts, tauYears, referencePriceOfRisky)
  }
}
