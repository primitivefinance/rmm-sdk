import { Interface } from '@ethersproject/abi'
import { abi } from '@primitivefinance/v2-core/artifacts/contracts/PrimitiveFactory.sol/PrimitiveFactory.json'
import { BigNumber } from 'ethers'
import invariant from 'tiny-invariant'
import { parseWei, Percentage, toBN, Wei } from 'web3-units'
import { MethodParameters, validateAndParseAddress } from '.'
import { Calibration } from './entities/calibration'
import { PermitOptions, SelfPermit } from './selfPermit'
import { Pool } from './entities/pool'
import { AddressZero } from '@ethersproject/constants'
import { PeripheryManager } from './peripheryManager'

export interface DefaultOptions {
  recipient: string
  deadline: BigNumber
  slippageTolerance: Percentage
  inputTokenPermit?: PermitOptions
}

export interface SwapOptions extends DefaultOptions {
  cal: Calibration
  riskyForStable: boolean
  amountIn: Wei
  fromMargin: boolean
  toMargin: boolean
}

export abstract class SwapManager extends SelfPermit {
  public readonly INTERFACE: Interface = new Interface(abi)

  private constructor() {
    super()
  }

  public swapCallParameters(pool: Pool, cal: Calibration, options: SwapOptions): MethodParameters {
    const calldatas: string[] = []

    const recipient: string = validateAndParseAddress(options.recipient)

    const inputEth = options.riskyForStable ? cal.risky.isNative : cal.stable.isNative
    const outputEth = options.riskyForStable ? cal.stable.isNative : cal.risky.isNative

    const value: string = inputEth ? options.amountIn.raw.toHexString() : toBN(0).toHexString()

    const swapResult = options.riskyForStable
      ? pool.virtual.swapAmountInRisky(options.amountIn)
      : pool.virtual.swapAmountInStable(options.amountIn)

    const amountOut = SwapManager.minimumAmountOut(options.slippageTolerance, swapResult.deltaOut)

    // if input token is permit-able
    if (options.inputTokenPermit) {
      const token = options.riskyForStable ? cal.risky : cal.stable
      invariant(token.isToken, 'Not token')
      calldatas.push(SwapManager.encodePermit(token, options.inputTokenPermit))
    }

    // swap data
    calldatas.push(
      SwapManager.INTERFACE.encodeFunctionData('swap', [
        outputEth ? AddressZero : recipient, // add to periphery, will direct weth from swap to SwapManager
        cal.risky.address,
        cal.stable.address,
        cal.poolId,
        options.riskyForStable,
        options.amountIn.raw.toHexString(),
        amountOut.raw.toHexString(),
        options.fromMargin,
        options.toMargin // add to periphery
      ])
    )

    // calls withdraw on the periphery manager, assuming withdraw is accessible on swap manager
    if (!options.toMargin) {
      calldatas.push(
        ...PeripheryManager.encodeWithdraw(options.cal, {
          recipient: recipient,
          amountRisky: options.riskyForStable ? parseWei(0) : amountOut,
          amountStable: options.riskyForStable ? amountOut : parseWei(0)
        })
      )
    }

    // if weth is received from trade, unwrap it and send to recipient
    if (outputEth) {
      calldatas.push(SwapManager.INTERFACE.encodeFunctionData('unwrapWETH', [amountOut.raw.toHexString(), recipient]))
    }

    return { calldata: SwapManager.INTERFACE.encodeFunctionData('multicall', [calldatas]), value }
  }

  /**
   * Get the minimum amount that must be received from this trade for the given slippage tolerance
   * @param slippageTolerance The tolerance of unfavorable slippage from the execution price of this trade
   * @returns The amount out
   */
  public static minimumAmountOut(slippageTolerance: Percentage, amountOut: Wei): Wei {
    invariant(!(slippageTolerance.float < 0), 'SLIPPAGE_TOLERANCE')

    // amount out * 100 / (100 + slippage tolerance) = minimum amount out
    const slippageAdjustedAmountOut = amountOut
      .mul(Math.pow(10, Percentage.Mantissa))
      .div(slippageTolerance.raw.add(1e4))
    return slippageAdjustedAmountOut
  }
}
