import { BigNumber } from 'ethers'
import invariant from 'tiny-invariant'
import { Interface } from '@ethersproject/abi'
import { AddressZero } from '@ethersproject/constants'
import { parseWei, Percentage, toBN, Wei } from 'web3-units'
import { abi } from '@primitivefinance/rmm-periphery/artifacts/contracts/PrimitiveHouse.sol/PrimitiveHouse.json'

import { Pool } from './entities/pool'
import { PeripheryManager, NativeOptions } from './peripheryManager'
import { PermitOptions, SelfPermit } from './selfPermit'
import { MethodParameters, validateAndParseAddress, checkDecimals } from './utils'

export interface DefaultOptions {
  recipient: string
  deadline: BigNumber
  slippageTolerance: Percentage
  inputTokenPermit?: PermitOptions
}

export interface SwapOptions extends DefaultOptions, NativeOptions {
  riskyForStable: boolean
  deltaIn: Wei
  deltaOut: Wei
  fromMargin: boolean
  toMargin: boolean
  toRecipient?: boolean
}

export abstract class SwapManager extends SelfPermit {
  public static INTERFACE: Interface = new Interface(abi)

  private constructor() {
    super()
  }

  public static swapCallParameters(pool: Pool, options: SwapOptions): MethodParameters {
    // ensure decimals for amounts are correct
    if (options.riskyForStable) {
      checkDecimals(options.deltaIn, pool.risky)
      checkDecimals(options.deltaOut, pool.stable)
    } else {
      checkDecimals(options.deltaOut, pool.risky)
      checkDecimals(options.deltaIn, pool.stable)
    }

    const recipient: string = validateAndParseAddress(options.recipient)
    invariant(recipient !== AddressZero, 'Zero Address Recipient')

    const isEthInput = options.riskyForStable ? pool.risky.isNative : pool.stable.isNative
    const isEthOutput = options.riskyForStable ? pool.stable.isNative : pool.risky.isNative

    const value: string = isEthInput ? options.deltaIn.raw.toHexString() : toBN(0).toHexString()

    let calldatas: string[] = []

    // if input token is permit-able
    if (options.inputTokenPermit) {
      const token = options.riskyForStable ? pool.risky : pool.stable
      invariant(token.isToken, 'Not token')
      calldatas.push(SwapManager.encodePermit(token, options.inputTokenPermit))
    }

    // swap data
    // By default, tokens are sent to recipient
    // If output token should be ether, and tokens should be sent to recipient, then they
    // first must be transferred to the periphery, and then unwrapped and withdrawn
    const unwrapAndWithdraw = isEthOutput && options.toRecipient
    calldatas.push(
      SwapManager.INTERFACE.encodeFunctionData('swap', [
        {
          recipient: recipient,
          risky: pool.risky.address,
          stable: pool.stable.address,
          poolId: pool.poolId,
          riskyForStable: options.riskyForStable,
          deltaIn: options.deltaIn.raw.toHexString(),
          deltaOut: options.deltaOut.raw.toHexString(),
          fromMargin: options.fromMargin,
          toMargin: unwrapAndWithdraw ? true : options.toMargin,
          deadline: options.deadline
        }
      ])
    )

    // calls withdraw on the periphery manager, assuming withdraw is accessible on swap manager
    if (unwrapAndWithdraw) {
      calldatas.push(
        ...PeripheryManager.encodeWithdraw(pool, {
          recipient: recipient,
          amountRisky: options.riskyForStable ? parseWei(0) : options.deltaOut,
          amountStable: options.riskyForStable ? options.deltaOut : parseWei(0),
          useNative: options.useNative
        })
      )
    }

    return {
      calldata:
        calldatas.length === 1 ? calldatas[0] : SwapManager.INTERFACE.encodeFunctionData('multicall', [calldatas]),
      value
    }
  }

  /**
   * Get the minimum amount that must be received from this trade for the given slippage tolerance
   * @param slippageTolerance The tolerance of unfavorable slippage from the execution price of this trade
   * @returns The amount out
   */
  public static minimumAmountOut(slippageTolerance: Percentage, amountOut: Wei): Wei {
    invariant(!(slippageTolerance.float < 0), 'SLIPPAGE_TOLERANCE')
    const scalar = Math.pow(10, Percentage.Mantissa)

    // amount out * 100 / (100 + slippage tolerance) = minimum amount out
    const slippageAdjustedAmountOut = amountOut.mul(scalar).div(slippageTolerance.raw.add(scalar))
    return slippageAdjustedAmountOut
  }
}
