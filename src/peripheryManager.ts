import { BigNumber } from 'ethers'
import invariant from 'tiny-invariant'
import { Interface } from '@ethersproject/abi'
import { parseWei, Percentage, toBN, Wei } from 'web3-units'
import { NativeCurrency } from '@uniswap/sdk-core'
import { AddressZero } from '@ethersproject/constants'
import ManagerArtifact from '@primitivefi/rmm-manager/artifacts/contracts/PrimitiveManager.sol/PrimitiveManager.json'

import { Pool, PoolSides } from './entities/pool'
import { Engine } from './entities/engine'
import { PermitOptions, SelfPermit } from './selfPermit'
import { MethodParameters, validateAndParseAddress, checkDecimals } from './utils'

export interface NativeOptions {
  useNative?: NativeCurrency
}

export interface RecipientOptions {
  recipient: string
}

export interface Deadline {
  deadline?: BigNumber
}

export interface PermitTokens {
  permitRisky?: PermitOptions
  permitStable?: PermitOptions
}

export interface MarginOptions extends PermitTokens, RecipientOptions, NativeOptions {
  amountRisky: Wei
  amountStable: Wei
}

export interface LiquidityOptions {
  delRisky: Wei
  delStable: Wei
  delLiquidity: Wei
}

export interface AllocateOptions extends PermitTokens, LiquidityOptions, RecipientOptions, NativeOptions, Deadline {
  fromMargin: boolean
  slippageTolerance: Percentage
  createPool?: boolean
}

export interface RemoveOptions extends LiquidityOptions, RecipientOptions, NativeOptions, Deadline {
  expectedRisky: Wei
  expectedStable: Wei
  toMargin: boolean
  slippageTolerance: Percentage
}

export abstract class PeripheryManager extends SelfPermit {
  public static INTERFACE: Interface = new Interface(ManagerArtifact.abi)
  public static BYTECODE: string = ManagerArtifact.bytecode
  public static ABI: any = ManagerArtifact.abi

  private constructor() {
    super()
  }

  // create pool
  public static encodeCreate(pool: Pool, liquidity: Wei): string {
    checkDecimals(liquidity, pool)
    invariant(typeof pool.referencePriceOfRisky !== 'undefined', `Attempting to create a pool without reference price`)
    const riskyPerLp = parseWei(
      Pool.getRiskyReservesGivenReferencePrice(
        pool.strike.float,
        pool.sigma.float,
        pool.tau.years,
        pool.referencePriceOfRisky.float
      ),
      pool.risky.decimals
    )

    return PeripheryManager.INTERFACE.encodeFunctionData('create', [
      pool.risky.address,
      pool.stable.address,
      pool.strike.raw.toHexString(),
      pool.sigma.raw.toHexString(),
      pool.maturity.raw,
      pool.gamma.raw.toHexString(),
      riskyPerLp.raw.toHexString(),
      liquidity.raw.toHexString()
    ])
  }

  public static createCallParameters(pool: Pool, liquidity: Wei, options?: PermitTokens) {
    let calldatas: string[] = []

    if (options?.permitRisky) {
      calldatas.push(PeripheryManager.encodePermit(pool.risky, options?.permitRisky))
    }

    if (options?.permitStable) {
      calldatas.push(PeripheryManager.encodePermit(pool.stable, options?.permitStable))
    }

    calldatas.push(PeripheryManager.encodeCreate(pool, liquidity))

    let value: string = toBN(0).toHexString()

    return {
      calldata:
        calldatas.length === 1 ? calldatas[0] : PeripheryManager.INTERFACE.encodeFunctionData('multicall', [calldatas]),
      value
    }
  }

  // deposit margin
  public static depositCallParameters(engine: Engine, options: MarginOptions): MethodParameters {
    invariant(options.amountRisky.gt(0) || options.amountStable.gt(0), 'ZeroError()')
    checkDecimals(options.amountRisky, engine.risky)
    checkDecimals(options.amountStable, engine.stable)

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
    checkDecimals(options.amountRisky, engine.risky)
    checkDecimals(options.amountStable, engine.stable)

    const recipient: string = validateAndParseAddress(options.recipient)
    invariant(recipient !== AddressZero, 'Zero Address Recipient')

    const amount0: BigNumber = options.amountRisky.raw
    const amount1: BigNumber = options.amountStable.raw

    // if withdrawing weth and its being unwrapped, a zero address recipient will pull the withdrawn tokens
    // to the periphery contract
    let calldatas: string[] = []
    calldatas.push(
      PeripheryManager.INTERFACE.encodeFunctionData('withdraw', [
        options.useNative ? AddressZero : recipient,
        engine.address,
        amount0.toHexString(),
        amount1.toHexString()
      ])
    )

    if (options.useNative) {
      const wrapped = options.useNative.wrapped
      invariant(engine.risky.equals(wrapped) || engine.stable.equals(wrapped), 'No Weth')
      const wrappedAmount = engine.risky.equals(wrapped) ? amount0 : amount1 // if risky is native, use risky amount
      const token = engine.risky.equals(wrapped) ? engine.stable : engine.risky // if risky is native, token is stable
      const tokenAmount = engine.risky.equals(wrapped) ? amount1 : amount0 // if risky is native, token amount is stable amount

      // sends withdrawn assets to the recipient
      calldatas.push(PeripheryManager.INTERFACE.encodeFunctionData('unwrap', [wrappedAmount, recipient]))
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

  public static withdrawCallParameters(engine: Engine, options: MarginOptions): MethodParameters {
    let calldatas: string[] = PeripheryManager.encodeWithdraw(engine, options)

    return {
      calldata:
        calldatas.length === 1 ? calldatas[0] : PeripheryManager.INTERFACE.encodeFunctionData('multicall', [calldatas]),
      value: toBN(0).toHexString()
    }
  }

  // allocate liquidity
  public static allocateCallParameters(pool: Pool, options: AllocateOptions): MethodParameters {
    invariant(options.delRisky.gt(0), 'ZeroError()')
    invariant(options.delStable.gt(0), 'ZeroError()')
    invariant(options.delLiquidity.gt(0), 'ZeroError()')
    checkDecimals(options.delLiquidity, pool)
    checkDecimals(options.delRisky, pool.risky)
    checkDecimals(options.delStable, pool.stable)

    let calldatas: string[] = []

    // if permits
    if (options.permitRisky) {
      calldatas.push(PeripheryManager.encodePermit(pool.risky, options.permitRisky))
    }

    if (options.permitStable) {
      calldatas.push(PeripheryManager.encodePermit(pool.stable, options.permitStable))
    }

    const minLiquidity = options.delLiquidity.mul(options.slippageTolerance.raw).div(Percentage.BasisPoints)

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
          options.fromMargin,
          minLiquidity.raw.toHexString()
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
  public static removeCallParameters(pool: Pool, options: RemoveOptions): MethodParameters {
    invariant(options.delLiquidity.gt(0), 'ZeroError()')
    checkDecimals(options.delLiquidity, pool)
    checkDecimals(options.delRisky, pool.risky)
    checkDecimals(options.delStable, pool.stable)

    let calldatas: string[] = []

    const { delRisky, delStable } = pool.liquidityQuote(options.delLiquidity, PoolSides.RMM_LP)
    const minRisky = delRisky.mul(options.slippageTolerance.bps).div(Percentage.BasisPoints)
    const minStable = delStable.mul(options.slippageTolerance.bps).div(Percentage.BasisPoints)

    // tokens are by default removed from curve and deposited to margin
    calldatas.push(
      PeripheryManager.INTERFACE.encodeFunctionData('remove', [
        pool.address,
        pool.poolId,
        options.delLiquidity.raw.toHexString(),
        minRisky.raw.toHexString(),
        minStable.raw.toHexString()
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
