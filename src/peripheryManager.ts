import { Interface } from '@ethersproject/abi'
import { BigNumber } from '@ethersproject/bignumber'
import { AddressZero } from '@ethersproject/constants'
import { Signer } from '@ethersproject/abstract-signer'
import { ContractFactory } from '@ethersproject/contracts'
import invariant from 'tiny-invariant'
import { parseWei, Percentage, toBN, Wei } from 'web3-units'
import { NativeCurrency } from '@uniswap/sdk-core'
import ManagerArtifact from '@primitivefi/rmm-manager/artifacts/contracts/PrimitiveManager.sol/PrimitiveManager.json'

import { Engine } from './entities/engine'
import { Pool, PoolSides } from './entities/pool'
import { Swaps } from './entities/swaps'
import { MethodParameters, validateAndParseAddress, validateDecimals } from './utils'

import { PermitOptions, SelfPermit } from './selfPermit'

/** Flag to use a native currency in a transaction.  */
export interface NativeOptions {
  useNative?: NativeCurrency
}

/** Recipient address of any tokens which are output from transactions. */
export interface RecipientOptions {
  recipient: string
}

/** Timestamp which will revert the transaction if not yet mined. */
export interface Deadline {
  deadline?: BigNumber
}

/** Permit details on either risky or stable tokens. */
export interface PermitTokens {
  /** If defined, risky token can be permitted, saving the user an approve tx. */
  permitRisky?: PermitOptions

  /** If defined, stable token can be permitted, saving the user an approve tx. */
  permitStable?: PermitOptions
}

/** Token amounts to use for depositing or withdrawing into a margin account.  */
export interface MarginOptions extends PermitTokens, RecipientOptions, NativeOptions {
  amountRisky: Wei
  amountStable: Wei
}

/** Token amounts to use for allocating liquidity. */
export interface LiquidityOptions {
  /** Amount of risky tokens to provide as liquidity. */
  delRisky: Wei
  /** Amount of stable tokens to provide as Liquidity. */
  delStable: Wei
  /** Desired liquidity to mint. */
  delLiquidity: Wei
}

/**
 * Provide liquidity argument details.
 *
 * @remarks
 * Slippage tolerance can be safely set to 0,
 * which will cause the transaction to revert in the case the expected `delLiquidity`
 * is not granted to the transaction sender.
 *
 * @param recipient Address that will be granted the minted Primitive liquidity pool tokens.
 * @param delRisky Amount of risky tokens to provide as liquidity.
 * @param delStable Amount of stable tokens to provide as Liquidity.
 * @param delLiquidity Desired amount of liquidity to mint.
 * @param fromMargin Use margin balance to pay for liquidity deposit.
 * @param slippageTolerance Maximum difference in liquidity received from expected liquidity.
 * @param createPool Create a pool and allocate liquidity to it.
 * @param useNative Whether or not a native protocol token (e.g. Ether) should be used with a wrapped token version.
 *
 * @beta
 */
export interface AllocateOptions extends PermitTokens, LiquidityOptions, NativeOptions, RecipientOptions {
  fromMargin: boolean
  slippageTolerance: Percentage
  createPool?: boolean
}

/**
 * Remove liquidity argument details.
 *
 * @remarks
 * Expected risky and stable amounts should be defaulted to 0.
 *
 * @param expectedRisky Amount of risky tokens to withdraw from margin account, minRisky is added to this.
 * @param expectedStable Amount of stable tokens to withdraw from margin account, minStable is added to this.
 * @param toMargin Whether or not to keep tokens withdrawn from liquidity in margin.
 * @param slippageTolerance Percentage deviation from the expected token amounts being removed from the pool.
 * @param recipient Address that will be granted the minted Primitive liquidity pool tokens.
 * @param delRisky Amount of risky tokens to provide as liquidity.
 * @param delStable Amount of stable tokens to provide as Liquidity.
 * @param delLiquidity Desired amount of liquidity to mint.
 * @param useNative Whether or not a native protocol token (e.g. Ether) should be used with a wrapped token version.
 *
 * @beta
 */
export interface RemoveOptions extends LiquidityOptions, RecipientOptions, NativeOptions {
  expectedRisky: Wei
  expectedStable: Wei
  toMargin: boolean
  slippageTolerance: Percentage
}

/** Transfer ERC-1155 liquidity token argument details. */
export interface SafeTransferOptions {
  sender: string
  recipient: string
  amount: Wei
  id: string
  data?: string
}

/** Batch Transfer ERC-1155 liquidity token argument details. */
export interface BatchTransferOptions {
  sender: string
  recipient: string
  ids: string[]
  amounts: Wei[]
  data?: string
}

/**
 * Abstract class with static methods to build Manager function calldatas.
 *
 * @beta
 */
export abstract class PeripheryManager extends SelfPermit {
  public static INTERFACE: Interface = new Interface(ManagerArtifact.abi)
  public static BYTECODE: string = ManagerArtifact.bytecode
  public static ABI: any[] = ManagerArtifact.abi
  public static getFactory: (signer?: Signer) => ContractFactory = signer =>
    new ContractFactory(PeripheryManager.INTERFACE, PeripheryManager.BYTECODE, signer)

  private constructor() {
    super()
  }

  /**
   * Gets encoded function data with function selector 'create' and create pool args
   *
   * @param pool {@link IPool} Virtualized pool with computed reserves to compute create args from.
   * @param liquidity Amount of liquidity to initially supply.
   *
   * @throws
   * Throws if liquidity amount decimals and pool decimals are not equal.
   * Throws if pool has an undefined {@link IPool.referencePriceOfRisky}.
   * Throws if `liquidity` is less than {@link IEngine.MIN_LIQUIDITY}.
   *
   * @beta
   */
  public static encodeCreate(pool: Pool, liquidity: Wei): string {
    validateDecimals(liquidity, pool)
    invariant(typeof pool.referencePriceOfRisky !== 'undefined', `Attempting to create a pool without reference price.`)
    const riskyPerLp = parseWei(
      Swaps.getRiskyReservesGivenReferencePrice(
        pool.strike.float,
        pool.sigma.float,
        pool.tau.years,
        pool.referencePriceOfRisky.float
      ),
      pool.risky.decimals
    )

    invariant(
      riskyPerLp.gt(0),
      `Attempting to create a pool that has 0 risky tokens in the reserves. This is only possible after a pool has expired, has the maturity timestamp already been passed?`
    )
    invariant(
      riskyPerLp.lt(parseWei(1, riskyPerLp.decimals)),
      `Attempting to create a pool that has 1 risky token per liquidity in the reserves. This is only possible after a pool has expired, has the maturity timestamp already been passed?`
    )
    invariant(
      liquidity.gte(pool.MIN_LIQUIDITY),
      `Attempting to create a pool and allocating less than MIN_LIQUIDITY amount of liquidity.`
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

  /**
   * Gets calldata and value to send with a `create` transaction to Primitive Manager.
   *
   * @beta
   */
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

  /**
   * Gets calldata and value to send to deposit into a margin account of Primitive Manager.
   *
   * @param engine {@link IEngine} Tokens of the Engine to deposit into margin accounts for.
   * @param options Deposit argument details.
   *
   * @throws
   * Throws if both deposit amounts are zero.
   * Throws if a deposit amount decimals does not match respective token decimals.
   * Throws if {@link RecipientOptions.recipient} is the Zero address or is an invalid address.
   * Throws if depositing a currency and the token has an undefined `wrapped` attribute.
   *
   * @beta
   */
  public static depositCallParameters(engine: Engine, options: MarginOptions): MethodParameters {
    invariant(options.amountRisky.gt(0) || options.amountStable.gt(0), 'ZeroError()')
    validateDecimals(options.amountRisky, engine.risky)
    validateDecimals(options.amountStable, engine.stable)

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

  /**
   * Gets encoded function data with function selector 'withdraw' and withdraw arguments.
   *
   * @param engine {@link IEngine} Tokens of the Engine to deposit into margin accounts for.
   * @param options Margin argument details with token amounts to withdraw..
   *
   * @throws
   * Throws if both withdraw amounts are zero.
   * Throws if a withdraw amount decimals does not match respective token decimals.
   * Throws if {@link RecipientOptions.recipient} is the Zero address or is an invalid address.
   * Throws if withdrawing a currency and the token has an undefined `wrapped` attribute.
   *
   * @beta
   */
  public static encodeWithdraw(engine: Engine, options: MarginOptions): string[] {
    invariant(options.amountRisky.gt(0) || options.amountStable.gt(0), 'ZeroError()')
    validateDecimals(options.amountRisky, engine.risky)
    validateDecimals(options.amountStable, engine.stable)

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

  /**
   * Gets calldata and value to send for a withdraw transaction from the Primitive Manager.
   *
   * @beta
   */
  public static withdrawCallParameters(engine: Engine, options: MarginOptions): MethodParameters {
    let calldatas: string[] = PeripheryManager.encodeWithdraw(engine, options)

    return {
      calldata:
        calldatas.length === 1 ? calldatas[0] : PeripheryManager.INTERFACE.encodeFunctionData('multicall', [calldatas]),
      value: toBN(0).toHexString()
    }
  }

  /**
   * Gets calldata and value to send to allocate liquidity into a pool through Primitive Manager.
   *
   * @param pool {@link IPool} Uses the pool's poolId and tokens in allocate arguments.
   * @param options {@link AllocateOptions} Allocate argument details.
   *
   * @throws
   * Throws if any {@link LiquidityOptions} amounts are zero.
   * Throws if any {@link LiquidityOptions} amount decimals does not match respective token decimals.
   * Throws if depositing a currency and the token has an undefined `wrapped` attribute.
   * Throws if attempting to create a pool from a margin balance.
   * Throws if computed minimum liquidity to receive is 0.
   * Throws if recipient is AddressZero.
   *
   * @beta
   */
  public static allocateCallParameters(pool: Pool, options: AllocateOptions): MethodParameters {
    invariant(options.delRisky.gt(0), 'ZeroError()')
    invariant(options.delStable.gt(0), 'ZeroError()')
    invariant(options.delLiquidity.gt(0), 'ZeroError()')
    validateDecimals(options.delLiquidity, pool)
    validateDecimals(options.delRisky, pool.risky)
    validateDecimals(options.delStable, pool.stable)

    const recipient: string = validateAndParseAddress(options.recipient)
    invariant(recipient !== AddressZero, 'Zero Address Recipient')

    let calldatas: string[] = []

    // if permits
    if (options.permitRisky) {
      calldatas.push(PeripheryManager.encodePermit(pool.risky, options.permitRisky))
    }

    if (options.permitStable) {
      calldatas.push(PeripheryManager.encodePermit(pool.stable, options.permitStable))
    }

    const slippageMultiplier = Percentage.BasisPoints - options.slippageTolerance.bps // 100% - slippage%
    const minLiquidity = options.delLiquidity.mul(slippageMultiplier).div(Percentage.BasisPoints)
    invariant(
      minLiquidity.gt(0),
      `Slippage parameter minLiquidity cannot be zero! ${options.delLiquidity.display} * ${slippageMultiplier} / ${Percentage.BasisPoints} = ${minLiquidity.display} `
    )

    // if curve should be created
    let createData: string | undefined = undefined

    if (options.createPool) {
      invariant(!options.fromMargin, 'Cannot pay from margin when creating, set fromMargin to false.')
      createData = PeripheryManager.encodeCreate(pool, options.delLiquidity)
      calldatas.push(createData)
    } else {
      calldatas.push(
        PeripheryManager.INTERFACE.encodeFunctionData('allocate', [
          recipient,
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

      let wrappedAmount: BigNumber

      if (options.createPool && typeof createData !== 'undefined') {
        const decoded = PeripheryManager.INTERFACE.decodeFunctionData('create', createData)
        const riskyPerLp: BigNumber = decoded[decoded.length - 2]
        const liquidity: BigNumber = decoded[decoded.length - 1]
        const amount: BigNumber = riskyPerLp.mul(liquidity).div(Engine.PRECISION.raw) // weth token per liquidity * liquidity / 1e18

        wrappedAmount = pool.risky.equals(wrapped) ? amount : options.delStable.raw
      } else {
        wrappedAmount = pool.risky.equals(wrapped) ? options.delRisky.raw : options.delStable.raw
      }

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

  /**
   * Gets calldata and value to send to remove liquidity from a Pool through Primitive Manager.
   *
   * @param pool {@link IPool} Uses poolId and tokens of Pool entity for remove arguments.
   * @param options {@link RemoveOptions} Remove argument details.
   *
   * @remarks
   * Computed min token amounts to receive are used to withdraw them from margin, and expected amounts are added to them.
   * A high slippageTolerance when removing liquidity could cause a discrepancy in the withdrawn tokens and tokens received in margin.
   * For this reason, it's best to have a 0 slippage tolerance.
   * In most cases, 0 slippage tolerance and 0 expected amounts should be used.
   * Potentially fails if there is not enough margin balance after removing liquidity when attempting to withdraw expected amounts.
   *
   * @throws
   * Throws if {@link LiquidityOptions.delLiquidity} is zero.
   * Throws if {@link LiquidityOptions} amount decimals does not match respective token decimals.
   *
   * @beta
   */
  public static removeCallParameters(pool: Pool, options: RemoveOptions): MethodParameters {
    invariant(options.delLiquidity.gt(0), 'ZeroError()')
    validateDecimals(options.delLiquidity, pool)
    validateDecimals(options.delRisky, pool.risky)
    validateDecimals(options.delStable, pool.stable)

    let calldatas: string[] = []

    const { delRisky, delStable } = pool.liquidityQuote(options.delLiquidity, PoolSides.RMM_LP)
    const slippageMultiplier = Percentage.BasisPoints - options.slippageTolerance.bps // 100% - slippage%
    const minRisky = delRisky.mul(slippageMultiplier).div(Percentage.BasisPoints)
    const minStable = delStable.mul(slippageMultiplier).div(Percentage.BasisPoints)

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
          amountRisky: minRisky.add(options.expectedRisky),
          amountStable: minStable.add(options.expectedStable),
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

  /**
   * Gets calldata for a transaction to transfer ERC-1155 tokens of Primitive Manager.
   *
   * @param options {@link SafeTransferOptions} Safe transfer argument details.
   *
   * @throws
   * Throws if {@link SafeTransferOptions} sender or recipient is an invalid address.
   *
   * @beta
   */
  public static safeTransferFromParameters(options: SafeTransferOptions): MethodParameters {
    const sender = validateAndParseAddress(options.sender)
    const recipient = validateAndParseAddress(options.recipient)

    const id = options.id.substring(0, 2) === '0x' ? BigNumber.from(options.id).toString() : options.id

    const calldata = PeripheryManager.INTERFACE.encodeFunctionData(
      'safeTransferFrom(address,address,uint256,uint256,bytes)',
      [sender, recipient, id, options.amount.raw.toHexString(), options.data ?? '0x']
    )

    return {
      calldata,
      value: toBN(0).toHexString()
    }
  }

  /**
   * Gets calldata for a transaction to batch transfer multiple ERC-1155 tokens of Primitive Manager.
   *
   * @param options {@link BatchTransferOptions} Safe batch transfer argument details.
   *
   * @throws
   * Throws if {@link BatchTransferOptions} sender or recipient is an invalid address.
   *
   * @beta
   */
  public static batchTransferFromParameters(options: BatchTransferOptions): MethodParameters {
    const sender = validateAndParseAddress(options.sender)
    const recipient = validateAndParseAddress(options.recipient)

    const ids = options.ids.map(id => (id.substring(0, 2) === '0x' ? BigNumber.from(id).toString() : id))
    const amounts = options.amounts.map(v => v.raw.toHexString())

    const calldata = PeripheryManager.INTERFACE.encodeFunctionData(
      'safeBatchTransferFrom(address,address,uint256[],uint256[],bytes)',
      [sender, recipient, ids, amounts, options.data ?? '0x']
    )

    return {
      calldata,
      value: toBN(0).toHexString()
    }
  }
}
