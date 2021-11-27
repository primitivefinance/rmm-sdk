import invariant from 'tiny-invariant'
import { formatFixed } from '@ethersproject/bignumber'
import { Token } from '@uniswap/sdk-core'
import { FixedPointX64, parseFixedPointX64, parseWei, Time, toBN, Wei } from 'web3-units'

import {
  callDelta,
  callPremium,
  getRiskyGivenStableApproximation,
  getStableGivenRiskyApproximation,
  inverse_std_n_cdf,
  nonNegative,
  quantilePrime,
  std_n_pdf
} from '@primitivefinance/v2-math'
import { PoolInterface } from './interfaces'
import { Calibration } from '.'

export enum PoolSides {
  RISKY = 'RISKY',
  STABLE = 'STABLE',
  RMM_01 = 'RMM_01'
}

/**
 * @notice RMM-01 Pool Entity
 * @dev    Has slots for reserves, invariant, and lastTimestamp state
 */
export class PoolSimple extends Calibration {
  /**
   * @notice Reference market spot price of the Risky asset denominated in the Stable asset
   */
  public readonly referencePriceOfRisky?: number
  public readonly lastTimestamp: Time
  public readonly invariant: FixedPointX64
  public readonly reserveRisky: Wei
  public readonly reserveStable: Wei
  public readonly liquidity: Wei

  /**
   * @notice Constructs a Pool entity from on-chain data
   * @param address Engine address which had the pool created
   * @param pool Returned data from on-chain, reconstructed to match PoolInterface or returned from the `house.uri(id)` call
   * @param risky Decimal places of the risky token
   * @param stable Decimal places of the stable token
   * @returns Pool entity
   */
  public static from(pool: PoolInterface, chainId?: number): PoolSimple {
    const { factory, risky, stable, calibration, reserve, invariant } = pool.properties

    return new PoolSimple(
      factory,
      { ...risky },
      { ...stable },
      { ...calibration },
      { ...reserve },
      invariant,
      chainId ?? undefined,
      undefined
    )
  }

  constructor(
    factory: string,
    risky: { address: string; decimals: string | number; name?: string; symbol?: string },
    stable: { address: string; decimals: string | number; name?: string; symbol?: string },
    calibration: { strike: string; sigma: string; maturity: string; gamma: string; lastTimestamp?: string },
    overrideReserves?: {
      reserveRisky?: string
      reserveStable?: string
      liquidity?: string
    },
    overrideInvariant?: string,
    chainId?: number,
    referencePriceOfRisky?: number
  ) {
    const token0 = new Token(chainId ?? 1, risky.address, +risky.decimals, risky?.symbol, risky?.name)
    const token1 = new Token(chainId ?? 1, stable.address, +stable.decimals, stable?.symbol, stable?.name)

    let { strike, sigma, maturity, gamma, lastTimestamp } = calibration
    super(factory, token0, token1, strike, sigma, maturity, gamma)

    lastTimestamp = lastTimestamp ? lastTimestamp : new Time(Time.now)
    this.lastTimestamp = lastTimestamp

    this.referencePriceOfRisky = referencePriceOfRisky

    const maxPrice = parseFloat(formatFixed(strike, stable.decimals))
    const tau = new Time(Number(maturity)).sub(lastTimestamp)

    let reserveRisky: Wei // store in memory to reference if needed to compute stable side of pool
    if (overrideReserves?.reserveRisky) {
      reserveRisky = new Wei(toBN(overrideReserves.reserveRisky), Number(risky.decimals))
    } else {
      if (!referencePriceOfRisky) {
        const e = `Thrown on Pool constructor, if override risky reserve, must enter a stable per risky price`
        throw e
      }
      const oppositeDelta = PoolSimple.getRiskyReservesGivenReferencePrice(
        maxPrice,
        Number(sigma),
        tau.years,
        referencePriceOfRisky
      )
      const formatted = oppositeDelta.toFixed(Number(risky.decimals))
      reserveRisky = parseWei(formatted, Number(risky.decimals))
    }
    this.reserveRisky = reserveRisky

    if (overrideReserves?.reserveStable) {
      const { reserveStable } = overrideReserves
      this.reserveStable = new Wei(toBN(reserveStable), Number(stable.decimals))
    } else {
      const balance = getStableGivenRiskyApproximation(reserveRisky.float, maxPrice, Number(sigma), tau.years)
      const formatted = balance.toFixed(Number(stable.decimals))
      this.reserveStable = parseWei(formatted, Number(stable.decimals))
    }

    if (overrideReserves?.liquidity) {
      const { liquidity } = overrideReserves
      this.liquidity = new Wei(toBN(liquidity), 18)
    } else {
      this.liquidity = parseWei(1, 18)
    }

    if (overrideInvariant) {
      this.invariant = new FixedPointX64(toBN(overrideInvariant), Number(stable.decimals))
    } else {
      this.invariant = parseFixedPointX64(0, Number(stable.decimals))
    }
  }

  /**
   * @returns Time until pool expires in seconds
   */
  get tau(): Time {
    return this.maturity.sub(this.lastTimestamp)
  }

  /**
   * @returns Total remaining time of a pool in seconds
   */
  get remaining(): Time {
    const expiring = new Time(this.maturity)
    if (Time.now >= expiring.raw) return new Time(0)
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
    return callDelta(this.strike.float, this.sigma.bps, this.tau.years, priceOfRisky)
  }

  /**
   * @returns Black-Scholes implied premium
   */
  get premium(): number {
    const priceOfRisky = this.referencePriceOfRisky ?? this.reportedPriceOfRisky.float
    return callPremium(this.strike.float, this.sigma.bps, this.tau.years, priceOfRisky)
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
   * @param reserveRisky Amount of risky tokens in reserve
   * @return reserveStable Expected amount of stable token reserves
   */
  public static getStableGivenRisky(
    strikeFloating: number,
    sigmaBasisPts: number,
    tauYears: number,
    reserveRiskyFloating: number,
    invariantFloating?: number
  ): number | undefined {
    const stable = getStableGivenRiskyApproximation(
      reserveRiskyFloating,
      strikeFloating,
      sigmaBasisPts,
      tauYears,
      invariantFloating ? invariantFloating : 0
    )

    if (isNaN(stable)) return undefined
    return stable
  }

  /**
   * @param reserveStable Amount of stable tokens in reserve
   * @return reserveRisky Expected amount of risky token reserves
   */
  public static getRiskyGivenStable(
    strikeFloating: number,
    sigmaBasisPts: number,
    tauYears: number,
    reserveStableFloating: number,
    invariantFloating?: number
  ): number | undefined {
    const stable = getRiskyGivenStableApproximation(
      reserveStableFloating,
      strikeFloating,
      sigmaBasisPts,
      tauYears,
      invariantFloating ? invariantFloating : 0
    )

    if (isNaN(stable)) return undefined
    return stable
  }

  /**
   * @returns Spot price of this pool, in units of Token1 per Token0
   */
  get reportedPriceOfRisky(): Wei {
    const risky = this.reserveRisky.float / this.liquidity.float
    const tau = this.tau.years
    const spot = PoolSimple.getReportedPriceOfRisky(risky, this.strike.float, this.sigma.bps, tau).toFixed(
      this.stable.decimals
    )
    return parseWei(spot, this.stable.decimals)
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
      this.sigma.bps,
      this.tau.years,
      this.gamma.bps,
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
      this.sigma.bps,
      this.tau.years,
      this.gamma.bps,
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
