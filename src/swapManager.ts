import { BigNumber } from 'ethers'
import invariant from 'tiny-invariant'
import { Interface } from '@ethersproject/abi'
import { AddressZero } from '@ethersproject/constants'
import { parseWei, Percentage, toBN, Wei } from 'web3-units'
import ManagerArtifact from '@primitivefi/rmm-manager/artifacts/contracts/PrimitiveManager.sol/PrimitiveManager.json'

import { Pool } from 'src/entities/pool'
import { MethodParameters, validateAndParseAddress, validateDecimals } from 'src/utils'

import { PeripheryManager, NativeOptions } from './peripheryManager'
import { PermitOptions, SelfPermit } from './selfPermit'

/** Default arguments in swaps. */
export interface DefaultOptions {
  /** Receiving address of output amount. */
  recipient: string

  /** Timestamp which will revert a swap if tx has not been mined by then. */
  deadline: BigNumber

  /** Maximum slippage of a swap as a Percentage class {@link web3-units#Percentage}. */
  slippageTolerance: Percentage

  /** Permit details if input token is being permitted rather than approved. */
  inputTokenPermit?: PermitOptions
}

/** Swap arguments. */
export interface SwapOptions extends DefaultOptions, NativeOptions {
  /** True if swapping risky tokens to stable tokens. */
  riskyForStable: boolean

  /** Amount of tokens to swap in. */
  deltaIn: Wei

  /** Amount of tokens requested out, sent to {@link DefaultOptions.recipient}. */
  deltaOut: Wei

  /** True if input token amount is debited from `msg.sender` margin account. */
  fromMargin: boolean

  /** True if output token amount is kept within the contract. The {@link DefaultOptions.recipient} margin account is credited. */
  toMargin: boolean

  /** True if output token amount is sent to {@link DefaultOptions.recipient}. */
  toRecipient?: boolean
}

/**
 * Abstract class which implements static methods to encode calldata for swaps.
 *
 * @beta
 */
export abstract class SwapManager extends SelfPermit {
  public static INTERFACE: Interface = new Interface(ManagerArtifact.abi)
  public static BYTECODE: string = ManagerArtifact.bytecode
  public static ABI: any = ManagerArtifact.abi

  private constructor() {
    super()
  }

  /**
   * Gets calldata and value to send for this swap.
   *
   * @remarks
   * If desired output is Ether, swap call is stacked with an unwrapAndWithdraw call, encoded in a multicall.
   *
   * @param pool Pool entity class being swapped within.
   * @param options Swap argument details.
   *
   * @throws
   * Throws if {@link DefaultOptions.recipient} is an invalid address or the zero address.
   * Throws if {@link DefaultOptions.inputTokenPermit} is defined and input token is not a token (e.g. Ether).
   * Throws if decimals on input or output swap amounts is not the same as the pool's respective token decimals.
   *
   * @beta
   */
  public static swapCallParameters(pool: Pool, options: SwapOptions): MethodParameters {
    if (options.riskyForStable) {
      validateDecimals(options.deltaIn, pool.risky)
      validateDecimals(options.deltaOut, pool.stable)
    } else {
      validateDecimals(options.deltaOut, pool.risky)
      validateDecimals(options.deltaIn, pool.stable)
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
   * Get the minimum amount that must be received from this trade for the given slippage tolerance.
   *
   * @param slippageTolerance The tolerance of unfavorable slippage from the execution price of this trade.
   *
   * @returns Amount out.
   *
   * @beta
   */
  public static minimumAmountOut(slippageTolerance: Percentage, amountOut: Wei): Wei {
    invariant(!(slippageTolerance.float < 0), 'SLIPPAGE_TOLERANCE')
    const scalar = Math.pow(10, Percentage.Mantissa)

    // amount out * 100 / (100 + slippage tolerance) = minimum amount out
    const slippageAdjustedAmountOut = amountOut.mul(scalar).div(slippageTolerance.raw.add(scalar))
    return slippageAdjustedAmountOut
  }
}
