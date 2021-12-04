import { getInvariantApproximation } from '@primitivefinance/rmm-math'
import { parseWei, Wei } from 'web3-units'
import { Engine } from '.'
import { Pool } from './pool'

export class Swaps {
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
