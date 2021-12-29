import {
  getInvariantApproximation,
  getMarginalPriceSwapRiskyInApproximation,
  getMarginalPriceSwapStableInApproximation,
  getRiskyGivenStable,
  getRiskyGivenStableApproximation,
  getSpotPriceApproximation,
  getStableGivenRiskyApproximation
} from '@primitivefi/rmm-math'
import { getAddress } from 'ethers/lib/utils'
import { parseWei, Time, Wei } from 'web3-units'
import { Engine } from './engine'
import { Floating } from './Floating'
import { Pool } from './pool'

type Coin = string

interface ExactInResult extends SwapResult {
  /**
   * @notice Amount of tokens output from a swap
   */
  output: number
}

interface ExactOutResult extends SwapResult {
  /**
   * @notice Amount of tokens input to a swap
   */
  input: number
}

interface SwapResult {
  /**
   * @notice Post-swap invariant of the pool
   */
  invariant: number
  /**
   * @notice Price of the asset paid from the swap
   */
  priceIn: number
}

export class Swaps {
  coin0: Coin
  coin1: Coin

  decimals0: number
  decimals1: number

  res0: number
  res1: number
  liq: number

  strike: number
  sigma: number
  maturity: number
  gamma: number
  lastTimestamp: number

  invariant: number

  static fromPool(pool: Pool): Swaps {
    return new Swaps(
      pool.risky.address,
      pool.stable.address,
      pool.reserveRisky.float,
      pool.reserveStable.float,
      pool.liquidity.float,
      pool.strike.float,
      pool.sigma.float,
      pool.maturity.raw,
      pool.gamma.float,
      pool.invariant.float,
      pool.lastTimestamp.raw,
      pool.risky.decimals,
      pool.stable.decimals
    )
  }

  constructor(
    coin0: string,
    coin1: string,
    res0: number,
    res1: number,
    liq: number,
    strike: number,
    sigma: number,
    maturity: number,
    gamma: number,
    invariant: number,
    lastTimestamp: number = Time.now,
    decimals0 = 18,
    decimals1 = 18
  ) {
    this.coin0 = getAddress(coin0)
    this.coin1 = getAddress(coin1)
    this.decimals0 = decimals0
    this.decimals1 = decimals1
    this.res0 = res0
    this.res1 = res1
    this.liq = liq
    this.strike = strike
    this.sigma = sigma
    this.maturity = maturity
    this.gamma = gamma
    this.invariant = invariant
    this.lastTimestamp = lastTimestamp
  }

  /**
   * @returns Price of Risky denominated in Stable
   */
  public static getReportedPriceOfRisky(
    balance0Floating: number,
    strikeFloating: number,
    sigmaFloating: number,
    tauYears: number
  ): number {
    return getSpotPriceApproximation(balance0Floating, strikeFloating, sigmaFloating, tauYears)
  }

  // ===== Computing Reserves =====

  /**
   * @param reserveStable Amount of stable tokens in reserve
   * @return reserveRisky Expected amount of risky token reserves
   */
  public static getRiskyGivenStable(
    strikeFloating: number,
    sigmaFloating: number,
    tauYears: number,
    reserveStableFloating: number,
    invariantFloating = 0
  ): number | undefined {
    const stable = getRiskyGivenStableApproximation(
      reserveStableFloating,
      strikeFloating,
      sigmaFloating,
      tauYears,
      invariantFloating
    )

    if (isNaN(stable)) return undefined
    return stable
  }

  /**
   * @param reserveRisky Amount of risky tokens in reserve
   * @return reserveStable Expected amount of stable token reserves
   */
  public static getStableGivenRisky(
    strikeFloating: number,
    sigmaFloating: number,
    tauYears: number,
    reserveRiskyFloating: number,
    invariantFloating = 0
  ): number | undefined {
    const stable = getStableGivenRiskyApproximation(
      reserveRiskyFloating,
      strikeFloating,
      sigmaFloating,
      tauYears,
      invariantFloating
    )

    if (isNaN(stable)) return undefined
    return stable
  }

  // ===== Computing Change in Marginal Price =====

  /**
   * @notice See https://arxiv.org/pdf/2012.08040.pdf
   * @param amountIn Amount of risky token to add to risky reserve
   * @return Marginal price after an exact trade in of the RISKY asset with size `amountIn`
   */
  public static getMarginalPriceSwapRiskyIn(
    reserve0Floating: number,
    strikeFloating: number,
    sigmaFloating: number,
    tauYears: number,
    gammaFloating: number,
    amountIn: number
  ) {
    return getMarginalPriceSwapRiskyInApproximation(
      amountIn,
      reserve0Floating,
      strikeFloating,
      sigmaFloating,
      tauYears,
      1 - gammaFloating
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
    sigmaFloating: number,
    tauYears: number,
    gammaFloating: number,
    amountIn: number
  ) {
    return getMarginalPriceSwapStableInApproximation(
      amountIn,
      invariantFloating,
      reserve1Floating,
      strikeFloating,
      sigmaFloating,
      tauYears,
      1 - gammaFloating
    )
  }

  /**
   * @notice Given an exact amount of risky tokens in, approximate the output amount of stable tokens
   */
  public static exactRiskyInput(
    amountIn: number,
    decimalsRisky: number,
    decimalsStable: number,
    reserveRiskyFloating: number,
    reserveStableFloating: number,
    reserveLiquidityFloating: number,
    strikeFloating: number,
    sigmaFloating: number,
    gammaFloating: number,
    tauYears: number
  ): ExactInResult {
    if (amountIn < 0) throw new Error(`Amount in cannot be negative: ${amountIn}`)

    const K = strikeFloating
    const gamma = gammaFloating
    const sigma = sigmaFloating
    const tau = tauYears

    const x = Floating.from(reserveRiskyFloating, decimalsRisky)
    const y = Floating.from(reserveStableFloating, decimalsStable)
    const l = Floating.from(reserveLiquidityFloating, 18)

    // Invariant `k` must always be calculated given the curve with `tau`, else the swap happens on a mismatched curve
    const k = getInvariantApproximation(
      x.div(l).normalized, // truncates to appropriate decimals
      y.div(l).normalized,
      K,
      sigma,
      tau,
      0
    )

    const x1 = x.add(amountIn * gamma).div(l)

    const yAdjusted = Swaps.getStableGivenRisky(x1.normalized, K, sigma, tau, k)
    if (!yAdjusted) throw new Error(`Next stable reserves are undefined: ${yAdjusted}`)

    const y1 = Floating.from(yAdjusted, decimalsStable).mul(l) // liquidity normalized

    const output = y.sub(y1.normalized)
    if (output.normalized < 0) throw new Error(`Reserves cannot be negative: ${output.normalized}`)

    const res0 = x.add(amountIn).div(l)
    const res1 = y.sub(output).div(l)

    const invariant = getInvariantApproximation(res0.normalized, res1.normalized, K, sigma, tau, 0)
    if (invariant < k) throw new Error(`Invariant decreased from: ${k} to ${invariant}`)

    const priceIn = output.div(amountIn)

    return {
      output: output.normalized,
      invariant: invariant,
      priceIn: priceIn.normalized
    }
  }

  /**
   * @notice Given an exact amount of stable tokens in, approximate the output amount of risky tokens
   */
  public static exactStableInput(
    amountIn: number,
    decimalsRisky: number,
    decimalsStable: number,
    reserveRiskyFloating: number,
    reserveStableFloating: number,
    reserveLiquidityFloating: number,
    strikeFloating: number,
    sigmaFloating: number,
    gammaFloating: number,
    tauYears: number
  ): ExactInResult {
    if (amountIn < 0) throw new Error(`Amount in cannot be negative: ${amountIn}`)

    const K = strikeFloating
    const gamma = gammaFloating
    const sigma = sigmaFloating
    const tau = tauYears

    const x = Floating.from(reserveRiskyFloating, decimalsRisky)
    const y = Floating.from(reserveStableFloating, decimalsStable)
    const l = Floating.from(reserveLiquidityFloating, 18)

    // Invariant `k` must always be calculated given the curve with `tau`, else the swap happens on a mismatched curve
    const k = getInvariantApproximation(
      x.div(l).normalized, // truncates to appropriate decimals
      y.div(l).normalized,
      K,
      sigma,
      tau,
      0
    )

    const y1 = y.add(amountIn * gamma).div(l)

    // note: for some reason, the regular non approximated fn outputs less
    const xAdjusted = getRiskyGivenStable(y1.normalized, K, sigma, tau, k)
    if (xAdjusted < 0) throw new Error(`Reserves cannot be negative: ${xAdjusted}`)

    const x1 = Floating.from(xAdjusted, decimalsRisky).mul(l)

    const output = x.sub(x1)
    if (output.normalized < 0) throw new Error(`Amount out cannot be negative: ${output.normalized}`)

    const res0 = x.sub(output).div(l)
    const res1 = y.add(amountIn).div(l)

    const invariant = getInvariantApproximation(res0.normalized, res1.normalized, K, sigma, tau, 0)
    if (invariant < k) throw new Error(`Invariant decreased by: ${k - invariant}`)

    let priceIn: Floating
    if (amountIn === 0) priceIn = Floating.INFINITY
    else priceIn = Floating.from(amountIn, decimalsStable).div(output)

    return {
      output: output.normalized,
      invariant: invariant,
      priceIn: priceIn.normalized
    }
  }

  /**
   * @notice Given an exact amount of risky tokens out, approximate the input amount of stable tokens
   */
  public static exactRiskyOutput(
    amountOut: number,
    decimalsRisky: number,
    decimalsStable: number,
    reserveRiskyFloating: number,
    reserveStableFloating: number,
    reserveLiquidityFloating: number,
    strikeFloating: number,
    sigmaFloating: number,
    gammaFloating: number,
    tauYears: number
  ): ExactOutResult {
    if (amountOut < 0) throw new Error(`Amount out cannot be negative: ${amountOut}`)

    const K = strikeFloating
    const gamma = gammaFloating
    const sigma = sigmaFloating
    const tau = tauYears

    const x = Floating.from(reserveRiskyFloating, decimalsRisky)
    const y = Floating.from(reserveStableFloating, decimalsStable)
    const l = Floating.from(reserveLiquidityFloating, 18)

    // Invariant `k` must always be calculated given the curve with `tau`, else the swap happens on a mismatched curve
    const k = getInvariantApproximation(
      x.div(l).normalized, // truncates to appropriate decimals
      y.div(l).normalized,
      K,
      sigma,
      tau,
      0
    )

    const x1 = x.sub(amountOut).div(l)

    const yAdjusted = Swaps.getStableGivenRisky(K, sigma, tau, x1.normalized)
    if (!yAdjusted) throw new Error(`Adjusted stable reserve cannot be undefined: ${yAdjusted}`)

    const y1 = Floating.from(yAdjusted, decimalsStable).mul(l)

    const input = y1.sub(y)
    const inputWithFee = input.div(gamma)

    const res0 = x1
    const res1 = y.add(input).div(l)

    const invariant = getInvariantApproximation(res0.normalized, res1.normalized, K, sigma, tau, 0)
    if (invariant < k) throw new Error(`Invariant decreased by: ${k - invariant}`)

    let priceIn: Floating
    if (inputWithFee.normalized === 0) priceIn = Floating.INFINITY
    else priceIn = inputWithFee.div(amountOut)

    return {
      input: inputWithFee.normalized,
      invariant: invariant,
      priceIn: priceIn.normalized
    }
  }

  /**
   * @notice Given an exact amount of stable tokens out, approximate the input amount of risky tokens
   */
  public static exactStableOutput(
    amountOut: number,
    decimalsRisky: number,
    decimalsStable: number,
    reserveRiskyFloating: number,
    reserveStableFloating: number,
    reserveLiquidityFloating: number,
    strikeFloating: number,
    sigmaFloating: number,
    gammaFloating: number,
    tauYears: number
  ): ExactOutResult {
    if (amountOut < 0) throw new Error(`Amount in cannot be negative: ${amountOut}`)

    const K = strikeFloating
    const gamma = gammaFloating
    const sigma = sigmaFloating
    const tau = tauYears

    const x = Floating.from(reserveRiskyFloating, decimalsRisky)
    const y = Floating.from(reserveStableFloating, decimalsStable)
    const l = Floating.from(reserveLiquidityFloating, 18)

    // Invariant `k` must always be calculated given the curve with `tau`, else the swap happens on a mismatched curve
    const k = getInvariantApproximation(
      x.div(l).normalized, // truncates to appropriate decimals
      y.div(l).normalized,
      K,
      sigma,
      tau,
      0
    )

    const y1 = y.sub(amountOut).div(l)

    const xAdjusted = getRiskyGivenStable(y1.normalized, K, sigma, tau, k)
    if (xAdjusted < 0) throw new Error(`Adjusted risky reserves cannot be negative: ${xAdjusted}`)

    const x1 = Floating.from(xAdjusted, decimalsRisky).mul(l)

    const input = x1.sub(x)
    const inputWithFee = input.div(gamma)

    const res0 = x.add(input).div(l)
    const res1 = y1

    const invariant = getInvariantApproximation(res0.normalized, res1.normalized, K, sigma, tau, 0)
    if (invariant < k) throw new Error(`Invariant decreased by: ${k - invariant}`)

    const priceIn = Floating.from(amountOut, decimalsStable).div(inputWithFee)

    return {
      input: inputWithFee.normalized,
      invariant: invariant,
      priceIn: priceIn.normalized
    }
  }
}
