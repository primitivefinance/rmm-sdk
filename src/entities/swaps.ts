import {
  getInvariantApproximation,
  getMarginalPriceSwapRiskyInApproximation,
  getMarginalPriceSwapStableInApproximation,
  getRiskyGivenStableApproximation,
  getSpotPriceApproximation,
  getStableGivenRiskyApproximation
} from '@primitivefi/rmm-math'
import { normalize } from 'src'
import { parseWei, Wei } from 'web3-units'
import { Engine } from './engine'
import { Pool } from './pool'

interface OutputResult {
  /**
   * @notice Amount of tokens output from a swap
   */
  output: number
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

  public static exactRiskyIn(
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
  ): OutputResult {
    if (amountIn < 0) throw new Error(`Amount in cannot be negative: ${amountIn}`)

    const K = normalize(strikeFloating, decimalsStable)
    const gamma = gammaFloating
    const sigma = sigmaFloating
    const tau = tauYears

    const x = normalize(reserveRiskyFloating, decimalsRisky)
    const y = normalize(reserveStableFloating, decimalsStable)
    const l = normalize(reserveLiquidityFloating, 18)

    // Invariant `k` must always be calculated given the curve with `tau`, else the swap happens on a mismatched curve
    const k = getInvariantApproximation(
      normalize(x / l, decimalsRisky), // truncates to appropriate decimals
      normalize(y / l, decimalsStable),
      K,
      sigma,
      tau,
      0
    )

    const x1 = Swaps.getStableGivenRisky((x + amountIn * gamma) / l, K, sigma, tau, k)
    if (!x1) throw new Error(`Next stable reserves are undefined: ${x1}`)

    const output = y - x1 * l // liquidity normalized
    const res0 = x + amountIn
    const res1 = y - output
    if (x1 < 0) throw new Error(`Reserves cannot be negative: ${x1}`)

    const invariant = getInvariantApproximation(res0 / l, res1 / l, K, sigma, tau, 0)
    if (invariant < k) throw new Error(`Invariant decreased from: ${k} to ${invariant}`)

    const priceIn = output / amountIn

    return {
      output: output,
      invariant: invariant,
      priceIn: priceIn
    }
  }

  public static exactRiskyInput(
    amountIn: Wei,
    strikeFloating: number,
    sigmaBasisPts: number,
    feeBasisPts: number,
    tauYears: number,
    reserveRisky: Wei,
    reserveStable: Wei,
    liquidity: Wei,
    invariantFloating?: number
  ): { amountOut: Wei; invariant?: number; price?: number } | undefined {
    if (amountIn.raw.isNegative()) return undefined

    const amountInWithFee = amountIn.mul(1e4 - feeBasisPts).div(1e4)
    if (amountInWithFee.raw.isNegative()) return undefined

    const reserveInput = reserveRisky
      .add(amountInWithFee)
      .mul(Engine.PRECISION)
      .div(liquidity)

    const reserveOutputFloating =
      Pool.getStableGivenRisky(
        strikeFloating,
        sigmaBasisPts,
        tauYears,
        reserveInput.float,
        invariantFloating ?? undefined
      ) ?? 0

    const reserveOutput = parseWei(reserveOutputFloating, reserveStable.decimals)
      .mul(liquidity)
      .div(Engine.PRECISION)

    if (reserveOutput.raw.isNegative()) return undefined

    const amountOut = reserveStable.sub(reserveOutput)

    const risky = reserveRisky.add(amountIn).float / liquidity.float
    const stable = reserveStable.sub(amountOut).float / liquidity.float
    const invariant: any = getInvariantApproximation(risky, stable, strikeFloating, sigmaBasisPts, tauYears)
    const price = amountOut.float / amountIn.float

    return { amountOut, invariant, price }
  }

  public static exactStableInput(
    amountIn: Wei,
    strikeFloating: number,
    sigmaBasisPts: number,
    feeBasisPts: number,
    tauYears: number,
    reserveRisky: Wei,
    reserveStable: Wei,
    liquidity: Wei,
    invariantFloating?: number
  ): { amountOut: Wei; invariant?: number; price?: number } | undefined {
    if (amountIn.raw.isNegative()) return undefined

    const amountInWithFee = amountIn.mul(1e4 - feeBasisPts).div(1e4)
    if (amountInWithFee.raw.isNegative()) return undefined

    const reserveInput = reserveStable
      .add(amountInWithFee)
      .mul(Engine.PRECISION)
      .div(liquidity)

    const reserveOutputFloating =
      Pool.getRiskyGivenStable(
        strikeFloating,
        sigmaBasisPts,
        tauYears,
        reserveInput.float,
        invariantFloating ?? undefined
      ) ?? 0

    const reserveOutput = parseWei(reserveOutputFloating, reserveRisky.decimals)
      .mul(liquidity)
      .div(Engine.PRECISION)

    if (reserveOutput.raw.isNegative()) return undefined

    const amountOut = reserveRisky.sub(reserveOutput)

    const risky = reserveRisky.sub(amountOut).float / liquidity.float
    const stable = reserveStable.add(amountIn).float / liquidity.float
    const invariant: any = getInvariantApproximation(risky, stable, strikeFloating, sigmaBasisPts, tauYears)
    const price = amountIn.float / amountOut.float

    return { amountOut, invariant, price }
  }

  public static exactRiskyOutput() {}
  public static exactStableOutput() {}
}
