import { Interface } from '@ethersproject/abi'
import { abi } from '@primitivefinance/v2-core/artifacts/contracts/PrimitiveFactory.sol/PrimitiveFactory.json'
import { NativeCurrency } from '@uniswap/sdk-core'
import { BigNumber } from 'ethers'
import invariant from 'tiny-invariant'
import { parseWei, toBN, Wei } from 'web3-units'
import { MethodParameters, validateAndParseAddress } from '.'
import { Calibration } from './entities/calibration'
import { Engine } from './entities/engine'
import { Pool } from './entities/pool'
import { PermitOptions, SelfPermit } from './selfPermit'
import { AddressZero } from '@ethersproject/constants'

export interface NativeOptions {
  useNative?: NativeCurrency
}

export interface RecipientOptions {
  recipient: string
}

export interface Deadline {
  deadline: BigNumber
}

export interface MarginOptions extends RecipientOptions, NativeOptions {
  amountRisky: Wei
  amountStable: Wei
  permitRisky?: PermitOptions
  permitStable?: PermitOptions
}

export interface LiquidityOptions {
  cal: Calibration
  amountLiquidity: Wei
}

export interface AllocateOptions extends LiquidityOptions, RecipientOptions, NativeOptions, Deadline {
  fromMargin: boolean
  permitRisky?: PermitOptions
  permitStable?: PermitOptions
  createPool?: boolean
}

export interface RemoveOptions extends LiquidityOptions, RecipientOptions, NativeOptions, Deadline {
  expectedRisky: Wei
  expectedStable: Wei
  toMargin: boolean
}

export abstract class PeripheryManager extends SelfPermit {
  public static INTERFACE: Interface = new Interface(abi)

  private constructor() {
    super()
  }

  // deploy engine
  public encodeDeploy(): string {
    return PeripheryManager.INTERFACE.encodeFunctionData('deployEngine', [])
  }

  // create pool
  private static encodeCreate(cal: Calibration, liquidity: Wei): string {
    return PeripheryManager.INTERFACE.encodeFunctionData('create', [
      cal.risky.address,
      cal.stable.address,
      cal.strike.raw,
      cal.sigma.raw,
      cal.maturity.raw,
      parseWei(cal.delta, 18).raw,
      liquidity.raw
    ])
  }

  // deposit margin
  public depositCallParameters(engine: Engine, options: MarginOptions): MethodParameters {
    invariant(options.amountRisky.gt(0) || options.amountStable.gt(0), 'ZeroError()')

    const calldatas: string[] = []

    // if permits
    if (options.permitRisky) {
      calldatas.push(PeripheryManager.encodePermit(engine.risky, options.permitRisky))
    }

    if (options.permitStable) {
      calldatas.push(PeripheryManager.encodePermit(engine.stable, options.permitStable))
    }

    const recipient = validateAndParseAddress(options.recipient)
    const amount0 = options.amountRisky.raw
    const amount1 = options.amountStable.raw

    calldatas.push(
      PeripheryManager.INTERFACE.encodeFunctionData('deposit', [
        recipient,
        engine.risky.address,
        engine.stable.address,
        amount0.toHexString(),
        amount1.toHexString()
      ])
    )

    let value: string = toBN(0).toHexString()

    if (options.useNative) {
      const wrapped = options.useNative.wrapped
      invariant(engine.risky.equals(wrapped) || engine.stable.equals(wrapped), 'No Weth')

      const wrappedAmount = engine.risky.equals(wrapped) ? amount0 : amount1

      if (wrappedAmount.gte(0)) {
        calldatas.push(PeripheryManager.INTERFACE.encodeFunctionData('refundETH'))
      }

      value = wrappedAmount.toHexString()
    }

    return {
      calldata:
        calldatas.length === 1 ? calldatas[0] : PeripheryManager.INTERFACE.encodeFunctionData('multicall', [calldatas]),
      value
    }
  }

  // withdraw margin
  public static encodeWithdraw(engine: Engine, options: MarginOptions): string[] {
    invariant(options.amountRisky.gt(0) || options.amountStable.gt(0), 'ZeroError()')
    const calldatas: string[] = []

    const useEth: boolean = engine.risky.isNative || engine.stable.isNative
    const recipient: string = validateAndParseAddress(options.recipient)
    const amount0: BigNumber = options.amountRisky.raw
    const amount1: BigNumber = options.amountStable.raw

    // if withdrawing weth and its being unwrapped, a zero address recipient will pull the withdrawn tokens
    // to the periphery contract
    calldatas.push(
      PeripheryManager.INTERFACE.encodeFunctionData('withdraw', [
        useEth ? AddressZero : recipient,
        engine.risky.address,
        engine.stable.address,
        amount0.toHexString(),
        amount1.toHexString()
      ])
    )

    if (useEth) {
      const wrappedAmount = engine.risky.isNative ? amount0 : amount1 // if risky is native use risky amount
      const token = engine.risky.isNative ? engine.stable : engine.risky // if risky is native, token is stable
      const tokenAmount = engine.risky.isNative ? amount1 : amount0 // if risky is native, token amount is stable amount

      // sends withdrawn assets to the recipient
      calldatas.push(PeripheryManager.INTERFACE.encodeFunctionData('unwrapWETH', [wrappedAmount, recipient]))
      calldatas.push(
        PeripheryManager.INTERFACE.encodeFunctionData('sweepToken', [
          token.address,
          tokenAmount.toHexString(),
          recipient
        ])
      )
    }

    return calldatas
  }

  public withdrawCallParameters(engine: Engine, options: MarginOptions): MethodParameters {
    invariant(options.amountRisky.gt(0) || options.amountStable.gt(0), 'ZeroError()')

    const calldatas: string[] = PeripheryManager.encodeWithdraw(engine, options)

    return {
      calldata:
        calldatas.length === 1 ? calldatas[0] : PeripheryManager.INTERFACE.encodeFunctionData('multicall', [calldatas]),
      value: toBN(0).toHexString()
    }
  }

  // allocate liquidity
  public allocateCallParameters(pool: Pool, options: AllocateOptions): MethodParameters {
    invariant(options.amountLiquidity.gt(0), 'ZeroError()')

    const calldatas: string[] = []

    const { amount0, amount1 } = { amount0: pool.virtual.reserveRisky.raw, amount1: pool.virtual.reserveStable.raw } // get token amounts

    // if curve should be created
    if (options.createPool) {
      calldatas.push(PeripheryManager.encodeCreate(options.cal, options.amountLiquidity))
    }

    // if permits
    if (options.permitRisky) {
      calldatas.push(PeripheryManager.encodePermit(options.cal.risky, options.permitRisky))
    }

    if (options.permitStable) {
      calldatas.push(PeripheryManager.encodePermit(options.cal.stable, options.permitStable))
    }

    //const recipient = validateAndParseAddress(options.recipient) // add to periphery
    //const deadline = options.deadline.toHexString() // add to periphery

    calldatas.push(
      PeripheryManager.INTERFACE.encodeFunctionData('allocate', [
        options.cal.risky.address,
        options.cal.stable.address,
        options.cal.poolId,
        options.amountLiquidity.raw.toHexString(),
        options.fromMargin
      ])
    )

    let value: string = toBN(0).toHexString()

    // if ether
    if (options.useNative) {
      const wrapped = options.useNative.wrapped
      invariant(options.cal.risky.equals(wrapped) || options.cal.stable.equals(wrapped), 'No Weth')

      const wrappedAmount = options.cal.risky.equals(wrapped) ? amount0 : amount1

      if (wrappedAmount.gte(0)) {
        calldatas.push(PeripheryManager.INTERFACE.encodeFunctionData('refundETH'))
      }

      value = wrappedAmount.toHexString()
    }

    return {
      calldata:
        calldatas.length === 1 ? calldatas[0] : PeripheryManager.INTERFACE.encodeFunctionData('multicall', [calldatas]),
      value
    }
  }

  // remove liquidity

  public removeCallParameters(options: RemoveOptions): MethodParameters {
    invariant(options.amountLiquidity.gt(0), 'ZeroError()')

    const calldatas: string[] = []

    //const recipient = validateAndParseAddress(options.recipient) // add to periphery
    //const deadline = options.deadline.toHexString() // add to peripheyr

    calldatas.push(
      PeripheryManager.INTERFACE.encodeFunctionData('remove', [
        options.cal.risky.address,
        options.cal.stable.address,
        options.cal.poolId,
        options.amountLiquidity.raw.toHexString(),
        options.toMargin // add to periphery
      ])
    )

    if (!options.toMargin) {
      calldatas.push(
        ...PeripheryManager.encodeWithdraw(options.cal, {
          recipient: options.recipient,
          amountRisky: options.expectedRisky,
          amountStable: options.expectedStable
        })
      )
    }

    return {
      calldata:
        calldatas.length === 1 ? calldatas[0] : PeripheryManager.INTERFACE.encodeFunctionData('multicall', [calldatas]),
      value: toBN(0).toHexString()
    }
  }
}
