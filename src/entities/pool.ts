import { BigNumber } from '@ethersproject/bignumber'
import invariant from 'tiny-invariant'
import { Token } from '@uniswap/sdk-core'
import { callDelta, callPremium } from '@primitivefi/rmm-math'
import { FixedPointX64, parseFixedPointX64, parseWei, Percentage, Time, Wei } from 'web3-units'

import { Calibration } from './calibration'
import { PoolInterface } from './interfaces'
import { Swaps, ExactInResult, ExactOutResult } from './swaps'
import { weiToWei } from '../utils'

/**
 * Enum for each side of the pool, inclusive of liquidity token.
 *
 * @beta
 */
export enum PoolSides {
  RISKY = 'RISKY',
  STABLE = 'STABLE',
  RMM_LP = 'RMM_LP'
}

/**
 * Abstraction of a Primitive RMM Pool
 *
 * @remarks
 * State includes reserves and calibration, just as a pool in PrimitiveEngine.sol does.
 *
 * @beta
 */
export interface IPool {
  /** Trading function invariant of the Pool, formatted as Q64.64 */
  readonly invariant: FixedPointX64

  /** Risky token reserves of {@link IEngine.risky}. */
  readonly reserveRisky: Wei

  /** Stable token reserves of {@link IEngine.stable}. */
  readonly reserveStable: Wei

  /** Total liquidity of Pool, including the min liquidity {@link IEngine.MIN_LIQUIDITY}. */
  readonly liquidity: Wei

  /**
   * Timestamp of last curve update.
   *
   * @remarks
   * This is the most important parameter when interacting with this pool's curve.
   * The `tau`, time until expiry`, is calculated by the difference of maturity and lastTimestamp,
   * which affects the theoretical reserves of the curve.
   *
   * For example, if swapping, the current timestamp must be used, requiring this lastTimestamp to be updated to it.
   * Else, the swap would be computing an invariant on a stale curve, which will most likely make the swap fail.
   */
  lastTimestamp: Time

  /** Difference between `maturity` timestamp and `lastTimestamp`. */
  tau: number

  /** Difference between `maturity` timestamp and the current timestamp returned by Date.now(). */
  remaining: Time

  /** True if Date.now() in seconds is greater than `maturity` timestamp. */
  expired: boolean

  /** True if `strike` is below `referencePriceOfRisky`. */
  inTheMoney: boolean

  /** Theoretical call option premium, computed using the pool's calibration data. */
  premium: number

  /**
   * Computes other side(s) of pool and/or liquidity amount, given a known size of one side of the pool.
   *
   * @throws
   * Throws if `liquidity` is zero.
   *
   * @param amount Size of {@link PoolSides}
   * @param sideOfPool Risky reserve, stable reserve, or liquidity of pool; {@link PoolSides}.
   *
   * @beta
   */
  liquidityQuote(amount: Wei, sideOfPool: PoolSides): { delRisky: Wei; delStable: Wei; delLiquidity: Wei }

  /**
   * Gets the current value of the pool denominated in units of `priceOfRisky`.
   *
   * @remarks
   * Denominating prices in a dollar-pegged stable coin will be easiest to calculate other values with.
   *
   * @param priceOfRisky Multiplier for the price of the risky asset.
   * @param priceOfStable Multiplier for the price of the stable asset, defaults to 1 given the `priceOfRisky` is denominated in that asset.
   *
   * @returns value per liquidity and values of each side of the pool, denominated in `prices` units.
   *
   * @beta
   */
  getCurrentLiquidityValue(priceOfRisky: number, priceOfStable: number): { valuePerLiquidity: Wei; values: Wei[] }

  /**
   * Gets the reported price CFMM for the {@link IEngine.risky} token, denominated in the {@link IEngine.stable} token.
   *
   * @remarks
   * This implied spot price is a decent health check to see if a pool is earning enough trading fees.
   * It should be close to the real reference price of the risky asset.
   */
  reportedPriceOfRisky: Wei

  /** Gets stored reference price of {@link IEngine.risky}, denominated in {@link IEngine.stable}. */
  referencePriceOfRisky: Wei

  /**
   * Gets amountIn of opposite token, given output amount of the other token.
   *
   * @remarks
   * Computing values in this direction is sometimes in-precise, given the approximations used.
   * Use with caution.
   *
   * @alpha
   */
  amountIn(tokenOut: Token, amountOut: number): ExactOutResult

  /**
   * Gets amountOut of opposite token, given input amount of the other token.
   *
   * @alpha
   */
  amountOut(tokenIn: Token, amountIn: number): ExactInResult

  /**
   * Gets the marginal price of `tokenIn` after a given amount in has been added to the respective reserve.
   *
   * @alpha
   */
  derivativeOut(tokenIn: Token, amountIn: number): number
}

/**
 * Pool base class implements {@link IPool}.
 *
 * @remarks
 * Abstraction of Primitive RMM-01 pools.
 *
 * @beta
 */
export class Pool extends Calibration {
  /** {@inheritdoc IPool.invariant} */
  public readonly invariant: FixedPointX64
  /** {@inheritdoc IPool.reserveRisky} */
  public readonly reserveRisky: Wei
  /** {@inheritdoc IPool.reserveStable} */
  public readonly reserveStable: Wei
  /** {@inheritdoc IPool.liquidity} */
  public readonly liquidity: Wei

  private _lastTimestamp: Time
  private _referencePriceOfRisky?: Wei

  set lastTimestamp(x: Time) {
    this._lastTimestamp = x
  }

  /** {@inheritdoc IPool.lastTimestamp} */
  get lastTimestamp(): Time {
    return this._lastTimestamp
  }

  set referencePriceOfRisky(x: Wei | undefined) {
    this._referencePriceOfRisky = x
  }

  /** {@inheritdoc IPool.referencePriceOfRisky} */
  get referencePriceOfRisky(): Wei | undefined {
    return this._referencePriceOfRisky
  }

  /**
   * Constructs a Pool entity from actual reserve data, e.g. on-chain state.
   *
   * @param address Engine address which had the pool created.
   * @param pool Returned data from on-chain, reconstructed to match PoolInterface or returned from the `PrimitiveManager.uri(id)` call.
   * @param risky Decimal places of the risky token.
   * @param stable Decimal places of the stable token.
   *
   * @returns Pool entity.
   *
   * @beta
   */
  public static from(pool: PoolInterface, referencePrice?: number): Pool {
    const {
      factory,
      riskyName,
      riskySymbol,
      riskyDecimals,
      riskyAddress,
      stableName,
      stableSymbol,
      stableDecimals,
      stableAddress,
      strike,
      sigma,
      gamma,
      maturity,
      lastTimestamp,
      reserveRisky,
      reserveStable,
      liquidity,
      invariant,
      chainId
    } = pool.properties

    const risky = { address: riskyAddress, name: riskyName, symbol: riskySymbol, decimals: riskyDecimals }
    const stable = { address: stableAddress, name: stableName, symbol: stableSymbol, decimals: stableDecimals }
    const calibration = { strike, sigma, maturity, lastTimestamp, gamma }
    const reserve = { reserveRisky, reserveStable, liquidity }
    return new Pool(
      +chainId,
      factory,
      { ...risky },
      { ...stable },
      { ...calibration },
      { ...reserve },
      invariant,
      referencePrice
    )
  }

  /**
   * Constructs a Pool entity using a reference price, which is used to compute the reserves of the pool.
   *
   * @remarks
   * Defaults to an invariant of 0, since the reserves are computed using an invariant of 0.
   *
   * @beta
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
    const strikePrice = weiToWei(strike, +stable.decimals).float
    const tau = new Time(Number(maturity)).sub(latestTimestamp)
    const sigmaFloating = new Percentage(BigNumber.from(sigma)).float

    const oppositeDelta = Swaps.getRiskyReservesGivenReferencePrice(
      strikePrice,
      sigmaFloating,
      tau.years,
      referencePrice
    )
    const balance = Swaps.getStableGivenRisky(strikePrice, sigmaFloating, tau.years, oppositeDelta, invariant) ?? 0

    const reserveRisky = parseWei(oppositeDelta.toString(), Number(risky.decimals)).toString()
    const reserveStable = parseWei(balance.toString(), Number(stable.decimals)).toString()
    return new Pool(
      chainId,
      factory,
      risky,
      stable,
      calibration,
      { reserveRisky, reserveStable, liquidity },
      invariant.toString(),
      referencePrice
    )
  }

  /**
   * @remarks
   * If reserves are not overridden, a `referencePriceOfRisky` must be defined.
   * Reserves are computed using this value and stored instead.
   *
   * @beta
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

  // --- Curve Info ---

  /** {@inheritdoc IPool.tau} */
  get tau(): Time {
    return this.maturity.sub(this.lastTimestamp)
  }

  /** {@inheritdoc IPool.remaining} */
  get remaining(): Time {
    const expiring = this.maturity
    if (Time.now >= expiring.raw) return new Time(0)
    return expiring.sub(this.lastTimestamp)
  }

  /** {@inheritdoc IPool.expired} */
  get expired(): boolean {
    return this.remaining.raw <= 0
  }

  /** {@inheritdoc IPool.delta} */
  get delta(): number | undefined {
    const priceOfRisky = this.referencePriceOfRisky ?? this.reportedPriceOfRisky
    return priceOfRisky ? callDelta(this.strike.float, this.sigma.float, this.tau.years, priceOfRisky.float) : undefined
  }

  /** {@inheritdoc IPool.premium} */
  get premium(): number | undefined {
    const priceOfRisky = this.referencePriceOfRisky ?? this.reportedPriceOfRisky
    return priceOfRisky
      ? callPremium(this.strike.float, this.sigma.float, this.tau.years, priceOfRisky.float)
      : undefined
  }

  /** {@inheritdoc IPool.inTheMoney} */
  get inTheMoney(): boolean | undefined {
    const priceOfRisky = this.referencePriceOfRisky ?? this.reportedPriceOfRisky
    return priceOfRisky ? priceOfRisky.float >= this.strike.float : undefined
  }

  // --- Liquidity Token Info ---

  /**
   * {@inheritdoc IPool.liquidityQuote}
   *
   * @throws
   * Throws if {@link IPool.liquidity} is zero.
   * Throws if `amount.decimals` does not match respective {@link PoolSides}.
   * Throws if resulting amounts do not have matching decimal places of {@link IEngine} tokens.
   */
  liquidityQuote(amount: Wei, sideOfPool: PoolSides): { delRisky: Wei; delStable: Wei; delLiquidity: Wei } {
    const { reserveRisky, reserveStable, liquidity } = this
    const price = this.reportedPriceOfRisky
    return Pool.getLiquidityQuote(amount, sideOfPool, reserveRisky, reserveStable, liquidity, price)
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
    liquidity: Wei,
    reportedPriceOfRisky?: Wei
  ): { delRisky: Wei; delStable: Wei; delLiquidity: Wei } {
    invariant(liquidity.gt(0), `Liquidity must be greater than zero`)

    let delRisky: Wei = parseWei(0, reserveRisky.decimals)
    let delStable: Wei = parseWei(0, reserveStable.decimals)
    let delLiquidity: Wei = parseWei(0, liquidity.decimals)

    switch (sideOfPool) {
      case PoolSides.RISKY:
        invariant(
          reserveRisky.gt(0),
          `Reserve risky is 0. It must be greater than 0 because its being used as a denominator to compute LP tokens to mint.`
        )
        if (typeof reportedPriceOfRisky === 'undefined') {
          delRisky = amount
          delLiquidity = liquidity.mul(delRisky).div(reserveRisky)
          delStable = reserveStable.mul(delLiquidity).div(liquidity)
        } else {
          delRisky = amount
          delStable = reportedPriceOfRisky.mul(delRisky).div(parseWei(1, delRisky.decimals))
          delLiquidity = liquidity.mul(delRisky).div(reserveRisky)
          const computedLiquidity = liquidity.mul(delStable).div(reserveStable)
          delLiquidity = delLiquidity.lt(computedLiquidity) ? delLiquidity : computedLiquidity
        }
        break
      case PoolSides.STABLE:
        invariant(
          reserveStable.gt(0),
          `Reserve stable is 0. It must be greater than 0 because its being used as a denominator to compute LP tokens to mint.`
        )

        if (typeof reportedPriceOfRisky === 'undefined') {
          delStable = amount
          delLiquidity = liquidity.mul(delStable).div(reserveStable)
          delRisky = reserveRisky.mul(delLiquidity).div(liquidity)
        } else {
          delStable = amount
          delRisky = parseWei(1, delRisky.decimals)
            .mul(delStable)
            .div(reportedPriceOfRisky)
          delLiquidity = liquidity.mul(delRisky).div(reserveRisky)
          const computedLiquidity = liquidity.mul(delStable).div(reserveStable)
          delLiquidity = delLiquidity.lt(computedLiquidity) ? delLiquidity : computedLiquidity
        }

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
   * {@inheritdoc IPool.getCurrentLiquidityValue}
   *
   * @throws
   * Throws if {@link IPool.liquidity} is zero.
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

  // --- Swap Routing Info ---

  /** {@inheritdoc IPool.reportedPriceOfRisky} */
  get reportedPriceOfRisky(): Wei | undefined {
    const risky = this.reserveRisky.float / this.liquidity.float
    const tau = this.tau.years
    const spot = Swaps.getReportedPriceOfRisky(risky, this.strike.float, this.sigma.float, tau)
    if (isNaN(spot)) return undefined
    if (!isFinite(spot)) return undefined
    return parseWei(spot, this.stable.decimals)
  }

  /** {@internal} */
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
      this.tau.add(120).years
    ] as const
    return args
  }

  /**
   * {@inheritdoc IPool.amountIn}
   *
   * @throws
   * Throws if `tokenOut` is not a token of this {@link IEngine}.
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
   * {@inheritdoc IPool.amountOut}
   *
   * @throws
   * Throws if `tokenIn` is not a token of this {@link IEngine}.
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
   * {@inheritdoc IPool.derivativeOut}
   *
   * @throws
   * Throws if `tokenIn` is not a token of this {@link IEngine}.
   */
  derivativeOut(tokenIn: Token, amountIn: number) {
    if (this.risky.equals(tokenIn)) {
      return Swaps.getMarginalPriceSwapRiskyIn(
        this.reserveRisky.float,
        this.strike.float,
        this.sigma.float,
        this.tau.years,
        this.gamma.float,
        amountIn
      )
    } else if (this.stable.equals(tokenIn)) {
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
      throw new Error(`Token is not in pair: ${tokenIn.address}`)
    }
  }
}
