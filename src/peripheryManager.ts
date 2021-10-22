import { BigNumber } from 'ethers'
import invariant from 'tiny-invariant'
import { Interface } from '@ethersproject/abi'
import { parseWei, toBN, Wei } from 'web3-units'
import { NativeCurrency } from '@uniswap/sdk-core'
import { AddressZero } from '@ethersproject/constants'
import { abi } from '@primitivefinance/v2-periphery/artifacts/contracts/PrimitiveHouse.sol/PrimitiveHouse.json'

import { Pool } from './entities/pool'
import { Engine } from './entities/engine'
import { PermitOptions, SelfPermit } from './selfPermit'
import { MethodParameters, validateAndParseAddress } from './utils'

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
  delRisky: Wei
  delStable: Wei
  delLiquidity: Wei
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

  // create pool
  private static encodeCreate(pool: Pool, liquidity: Wei): string {
    const decimals = pool.risky.decimals
    const delta = parseWei(pool.delta, decimals)
    const riskyPerLp = parseWei(1, decimals).sub(delta)
    return PeripheryManager.INTERFACE.encodeFunctionData('create', [
      pool.risky.address,
      pool.stable.address,
      pool.strike.raw,
      pool.sigma.raw,
      pool.maturity.raw,
      riskyPerLp.raw,
      liquidity.raw
    ])
  }

  // deposit margin
  public depositCallParameters(engine: Engine, options: MarginOptions): MethodParameters {
    invariant(options.amountRisky.gt(0) || options.amountStable.gt(0), 'ZeroError()')

    let calldatas: string[] = []

    // if permits
    if (options.permitRisky) {
      calldatas.push(PeripheryManager.encodePermit(engine.risky, options.permitRisky))
    }

    if (options.permitStable) {
      calldatas.push(PeripheryManager.encodePermit(engine.stable, options.permitStable))
    }

    const recipient = validateAndParseAddress(options.recipient)
    invariant(recipient !== AddressZero, 'Zero Address Recipient')

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

    // if ether
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
    const recipient: string = validateAndParseAddress(options.recipient)
    invariant(recipient !== AddressZero, 'Zero Address Recipient')

    const useEth: boolean = engine.risky.isNative || engine.stable.isNative
    const amount0: BigNumber = options.amountRisky.raw
    const amount1: BigNumber = options.amountStable.raw

    // if withdrawing weth and its being unwrapped, a zero address recipient will pull the withdrawn tokens
    // to the periphery contract
    let calldatas: string[] = []
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
      const wrappedAmount = engine.risky.isNative ? amount0 : amount1 // if risky is native, use risky amount
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

    let calldatas: string[] = PeripheryManager.encodeWithdraw(engine, options)

    return {
      calldata:
        calldatas.length === 1 ? calldatas[0] : PeripheryManager.INTERFACE.encodeFunctionData('multicall', [calldatas]),
      value: toBN(0).toHexString()
    }
  }

  // allocate liquidity
  public allocateCallParameters(pool: Pool, options: AllocateOptions): MethodParameters {
    invariant(options.delRisky.gt(0), 'ZeroError()')
    invariant(options.delStable.gt(0), 'ZeroError()')
    invariant(options.delLiquidity.gt(0), 'ZeroError()')

    let calldatas: string[] = []

    // if permits
    if (options.permitRisky) {
      calldatas.push(PeripheryManager.encodePermit(pool.risky, options.permitRisky))
    }

    if (options.permitStable) {
      calldatas.push(PeripheryManager.encodePermit(pool.stable, options.permitStable))
    }

    // if curve should be created
    if (options.createPool) {
      invariant(!options.fromMargin, 'Cannot pay from margin when creating')
      calldatas.push(PeripheryManager.encodeCreate(pool, options.delLiquidity))
    } else {
      calldatas.push(
        PeripheryManager.INTERFACE.encodeFunctionData('allocate', [
          pool.poolId,
          pool.risky.address,
          pool.stable.address,
          options.delRisky.raw.toHexString(),
          options.delStable.raw.toHexString(),
          options.fromMargin
        ])
      )
    }

    let value: string = toBN(0).toHexString()

    // if ether
    if (options.useNative) {
      const wrapped = options.useNative.wrapped
      invariant(pool.risky.equals(wrapped) || pool.stable.equals(wrapped), 'No Weth')

      const wrappedAmount = pool.risky.equals(wrapped) ? options.delRisky.raw : options.delStable.raw

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
  public removeCallParameters(pool: Pool, options: RemoveOptions): MethodParameters {
    invariant(options.delLiquidity.gt(0), 'ZeroError()')

    let calldatas: string[] = []

    // tokens are by default removed from curve and deposited to margin
    calldatas.push(
      PeripheryManager.INTERFACE.encodeFunctionData('remove', [
        pool.address,
        pool.poolId,
        options.delLiquidity.raw.toHexString()
      ])
    )

    // handles unwrapping ether, if needed
    if (!options.toMargin) {
      calldatas.push(
        ...PeripheryManager.encodeWithdraw(pool, {
          recipient: options.recipient,
          amountRisky: options.expectedRisky,
          amountStable: options.expectedStable,
          useNative: options.useNative
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
