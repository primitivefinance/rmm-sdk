import invariant from 'tiny-invariant'
import { formatFixed } from '@ethersproject/bignumber'
import { Token } from '@uniswap/sdk-core'
import { FixedPointX64, parseFixedPointX64, parseWei, Time, Wei } from 'web3-units'

import { callDelta, callPremium } from '@primitivefi/rmm-math'
import { Calibration } from './calibration'
import { PoolInterface } from './interfaces'
import { Swaps, ExactInResult, ExactOutResult } from './swaps'
import { weiToWei } from '../utils'

export enum PoolSides {
  RISKY = 'RISKY',
  STABLE = 'STABLE',
  RMM_LP = 'RMM_LP'
}

/**
 * @notice RMM-01 Pool Entity
 * @dev    Has slots for reserves, invariant, and lastTimestamp state
 */
export class Pool extends Calibration {
  public readonly invariant: FixedPointX64
  public readonly reserveRisky: Wei
  public readonly reserveStable: Wei
  public readonly liquidity: Wei

  private _lastTimestamp: Time
  private _referencePriceOfRisky?: Wei

  set lastTimestamp(x: Time) {
    this._lastTimestamp = x
  }

  get lastTimestamp(): Time {
    return this._lastTimestamp
  }

  set referencePriceOfRisky(x: Wei | undefined) {
    this._referencePriceOfRisky = x
  }

  /**
   * @notice Reference market spot price of the Risky asset denominated in the Stable asset
   */
  get referencePriceOfRisky(): Wei | undefined {
    return this._referencePriceOfRisky
  }

  /**
   * @notice Constructs a Pool entity from actual reserve data, e.g. on-chain state
   * @param address Engine address which had the pool created
   * @param pool Returned data from on-chain, reconstructed to match PoolInterface or returned from the `house.uri(id)` call
   * @param risky Decimal places of the risky token
   * @param stable Decimal places of the stable token
   * @returns Pool entity
   */
  public static from(pool: PoolInterface, referencePrice?: number, chainId: number = 1): Pool {
    const { factory, risky, stable, calibration, reserve, invariant } = pool.properties

    return new Pool(
      chainId,
      factory,
      { ...risky },
      { ...stable },
      { ...calibration },
      { ...reserve },
      invariant,
      referencePrice ?? undefined
    )
  }

  /**
   * @notice Constructs a Pool entity using a reference price, which is used to compute the reserves of the pool
   * @dev    Defaults to an invariant of 0, since the reserves are computed using an invariant of 0
   */
  public static fromReferencePrice(
    referencePrice: number,
    factory: string,
    risky: { address: string; decimals: string | number; name?: string; symbol?: string },
    stable: { address: string; decimals: string | number; name?: string; symbol?: string },
    calibration: { strike: string; sigma: string; maturity: string; gamma: string; lastTimestamp?: string },
    chainId = 1,
    liquidity = parseWei(1, 18).toString(),
    invariant = 0
  ): Pool {
    const { strike, sigma, maturity, lastTimestamp } = calibration

    const latestTimestamp = lastTimestamp ? new Time(Number(lastTimestamp)) : new Time(Time.now)
    const strikePrice = parseFloat(formatFixed(strike, stable.decimals))
    const tau = new Time(Number(maturity)).sub(latestTimestamp)

    const oppositeDelta = Swaps.getRiskyReservesGivenReferencePrice(
      strikePrice,
      Number(sigma),
      tau.years,
      referencePrice
    )
    const balance = Swaps.getStableGivenRisky(oppositeDelta, strikePrice, Number(sigma), tau.years, invariant) ?? 0

    const reserveRisky = weiToWei(oppositeDelta.toString(), Number(risky.decimals)).toString()
    const reserveStable = weiToWei(balance.toString(), Number(stable.decimals)).toString()
    return new Pool(
      chainId,
      factory,
      risky,
      stable,
      calibration,
      { reserveRisky, reserveStable, liquidity },
      invariant.toString()
    )
  }

  /**
   * @dev If reserves are not overridden, a `referencePriceOfRisky` must be defined.
   * Reserves are computed using this value and stored instead.
   */
  constructor(
    chainId: number,
    factory: string,
    risky: { address: string; decimals: string | number; name?: string; symbol?: string },
    stable: { address: string; decimals: string | number; name?: string; symbol?: string },
    calibration: { strike: string; sigma: string; maturity: string; gamma: string; lastTimestamp?: string },
    reserves: {
      reserveRisky: string
      reserveStable: string
      liquidity: string
    },
    invariant?: string,
    referencePriceOfRisky?: number
  ) {
    const token0 = new Token(chainId, risky.address, +risky.decimals, risky?.symbol, risky?.name)
    const token1 = new Token(chainId, stable.address, +stable.decimals, stable?.symbol, stable?.name)

    let { strike, sigma, maturity, gamma, lastTimestamp } = calibration
    super(factory, token0, token1, strike, sigma, maturity, gamma)

    this._lastTimestamp = lastTimestamp ? new Time(Number(lastTimestamp)) : new Time(Time.now)

    this.reserveRisky = weiToWei(reserves.reserveRisky, Number(risky.decimals))
    this.reserveStable = weiToWei(reserves.reserveStable, Number(stable.decimals))
    this.liquidity = weiToWei(reserves.liquidity, 18)

    this.invariant = invariant
      ? FixedPointX64.from(invariant, Number(stable.decimals))
      : parseFixedPointX64(0, Number(stable.decimals))

    this._referencePriceOfRisky = referencePriceOfRisky ? parseWei(referencePriceOfRisky, token1.decimals) : undefined
  }

  // ===== Curve Info =====

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
    const expiring = this.maturity
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
  get delta(): number | undefined {
    const priceOfRisky = this.referencePriceOfRisky ?? this.reportedPriceOfRisky
    return priceOfRisky ? callDelta(this.strike.float, this.sigma.float, this.tau.years, priceOfRisky.float) : undefined
  }

  /**
   * @returns Black-Scholes implied premium
   */
  get premium(): number | undefined {
    const priceOfRisky = this.referencePriceOfRisky ?? this.reportedPriceOfRisky
    return priceOfRisky
      ? callPremium(this.strike.float, this.sigma.float, this.tau.years, priceOfRisky.float)
      : undefined
  }

  /**
   * @returns Price of Risky asset, whether reference or reported, is greater than or equal to strike
   */
  get inTheMoney(): boolean | undefined {
    const priceOfRisky = this.referencePriceOfRisky ?? this.reportedPriceOfRisky
    return priceOfRisky ? priceOfRisky.float >= this.strike.float : undefined
  }

  // ===== Liquidity Token Info =====

  /**
   * @notice Calculates the other side of the pool using the known amount of a side of the pool
   * @param amount Amount of token
   * @param sideOfPool Token side of the pool that is used to calculate the other side
   * @returns risky token amount, stable token amount, and liquidity amount
   */
  liquidityQuote(amount: Wei, sideOfPool: PoolSides): { delRisky: Wei; delStable: Wei; delLiquidity: Wei } {
    const { reserveRisky, reserveStable, liquidity } = this
    return Pool.getLiquidityQuote(amount, sideOfPool, reserveRisky, reserveStable, liquidity)
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
    invariant(liquidity.gt(0), `Liquidity must be greater than zero`)

    let delRisky: Wei = parseWei(0, reserveRisky.decimals)
    let delStable: Wei = parseWei(0, reserveStable.decimals)
    let delLiquidity: Wei = parseWei(0, liquidity.decimals)

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
      case PoolSides.RMM_LP:
        delLiquidity = amount
        delRisky = reserveRisky.mul(delLiquidity).div(liquidity)
        delStable = reserveStable.mul(delLiquidity).div(liquidity)
        break
      default:
        break
    }

    invariant(
      delRisky.decimals === reserveRisky.decimals,
      `Computed risky amount decimals: ${delRisky.decimals} != reserve risky decimals: ${reserveRisky.decimals}`
    )
    invariant(
      delStable.decimals === reserveStable.decimals,
      `Computed stable amount decimals: ${delRisky.decimals} != reserve stable decimals: ${reserveRisky.decimals}`
    )
    invariant(
      delLiquidity.decimals === liquidity.decimals,
      `Computed liquidity amount decimals: ${delRisky.decimals} != 18`
    )
    return { delRisky, delStable, delLiquidity }
  }

  /**
   * @notice Calculates the current value of the pool in units of `priceOfRisky`
   * @dev Denominating prices in a dollar-pegged stable coin will be easiest to calculate other values with
   * @param priceOfRisky Multiplier for the price of the risky asset
   * @param priceOfStable Multiplier for the price of the stable asset, defaults to 1 given the priceOfRisky is denominated in that asset
   * @returns value per liquidity and values of each side of the pool, denominated in `prices` units
   */
  getCurrentLiquidityValue(priceOfRisky: number, priceOfStable = 1): { valuePerLiquidity: Wei; values: Wei[] } {
    const reserve0 = this.reserveRisky
    const reserve1 = this.reserveStable
    const liquidity = this.liquidity

    invariant(liquidity.gt(0), `Liquidity must be greater than zero`)

    // Computes the price of the token multiplied by amount of the token and dividing by 10^decimals, canceling out the tokens decimals
    const values = [
      parseWei(priceOfRisky, 18)
        .mul(reserve0)
        .div(parseWei(1, reserve0.decimals)),
      parseWei(priceOfStable, 18)
        .mul(reserve1)
        .div(parseWei(1, reserve1.decimals))
    ]

    const sum = values[0].add(values[1]) // both have 18 decimals
    const valuePerLiquidity = sum.mul(1e18).div(liquidity)
    return { valuePerLiquidity, values }
  }

  // ===== Swap Routing Info =====

  /**
   * @returns Spot price of this pool, in units of Token1 per Token0
   */
  get reportedPriceOfRisky(): Wei | undefined {
    const risky = this.reserveRisky.float / this.liquidity.float
    const tau = this.tau.years
    const spot = Swaps.getReportedPriceOfRisky(risky, this.strike.float, this.sigma.float, tau)
    if (isNaN(spot)) return undefined
    return parseWei(spot, this.stable.decimals)
  }

  get swapArgs() {
    const args = [
      this.risky.decimals,
      this.stable.decimals,
      this.reserveRisky.float,
      this.reserveStable.float,
      this.liquidity.float,
      this.strike.float,
      this.sigma.float,
      this.gamma.float,
      this.tau.years
    ] as const
    return args
  }

  /**
   * @return Amount input for a swap after an exact trade out of `tokenOut` with size `amountOut`
   */
  amountIn(tokenOut: Token, amountOut: number): ExactOutResult {
    const args = [amountOut, ...this.swapArgs] as const
    if (this.risky.equals(tokenOut)) {
      return Swaps.exactRiskyOutput(...args)
    } else if (this.stable.equals(tokenOut)) {
      return Swaps.exactStableOutput(...args)
    } else {
      throw new Error(`Token is not in pair: ${tokenOut.address}`)
    }
  }

  /**
   * @return Amount output from swap after an exact trade in of `tokenIn` with size `amountIn`
   */
  amountOut(tokenIn: Token, amountIn: number): ExactInResult {
    const args = [amountIn, ...this.swapArgs] as const
    if (this.risky.equals(tokenIn)) {
      return Swaps.exactRiskyInput(...args)
    } else if (this.stable.equals(tokenIn)) {
      return Swaps.exactStableInput(...args)
    } else {
      throw new Error(`Token is not in pair: ${tokenIn.address}`)
    }
  }

  /**
   * @return Marginal price after an exact trade in of `token` with size `amountIn`
   */
  derivativeOut(token: Token, amountIn: number) {
    if (this.risky.equals(token)) {
      return Swaps.getMarginalPriceSwapRiskyIn(
        this.reserveRisky.float,
        this.strike.float,
        this.sigma.float,
        this.tau.years,
        this.gamma.float,
        amountIn
      )
    } else if (this.stable.equals(token)) {
      return Swaps.getMarginalPriceSwapStableIn(
        this.invariant.float,
        this.reserveStable.float,
        this.strike.float,
        this.sigma.float,
        this.tau.years,
        this.gamma.float,
        amountIn
      )
    } else {
      throw new Error(`Token is not in pair: ${token.address}`)
    }
  }
}
