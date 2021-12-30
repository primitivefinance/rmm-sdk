import { getAddress, isAddress } from 'ethers/lib/utils'
import { Interface } from '@ethersproject/abi'
import { One } from '@ethersproject/constants'
import EngineArtifact from '@primitivefi/rmm-core/artifacts/contracts/PrimitiveEngine.sol/PrimitiveEngine.json'
import invariant from 'tiny-invariant'
import { Token } from '@uniswap/sdk-core'
import { parseWei, Wei } from 'web3-units'

import { computeEngineAddress } from '../utils/computeEngineAddress'

/**
 * Abstraction of PrimitiveEngine.sol smart contract.
 *
 * @remarks
 * Implements immutable state variables as static methods.
 *
 * @beta
 */
export interface IEngine {
  /** Primitive Factory address. Should be deployer of this instantiated Engine. */
  factory: string

  /** Risky token class entity. */
  risky: Token

  /** Stable token class entity. */
  stable: Token

  /** Multiplier to scale risky token amounts to the base `PRECISION`. */
  readonly scaleFactorRisky: Wei

  /** Multiplier to scale stable token amounts to the base `PRECISION`. */
  readonly scaleFactorStable: Wei

  /**
   * Checks to see if `token` is a token of this Engine.
   *
   * @param token Token to check involvement of.
   *
   * @returns true if one of Engine's tokens is `token`.
   */
  involvesToken(token: Token): boolean

  /** Minimum amount of liquidity of every pool. */
  MIN_LIQUIDITY: number
}

/**
 * Engine base class implementation of {@link IEngine}
 *
 * @beta
 */
export class Engine extends Token implements IEngine {
  /** PrimitiveEngine bytecode. */
  public static BYTECODE: string = EngineArtifact.bytecode
  /** PrimitiveEngine interface instantiated from abi. */
  public static INTERFACE: Interface = new Interface(EngineArtifact.abi)
  /** PrimitiveEngine abi. */
  public static ABI: any = EngineArtifact.abi

  /** Used to calculate minimum liquidity based on lowest decimals of risky/stable. */
  public static readonly MIN_LIQUIDITY_FACTOR = 6
  /** Engine constant value which all values are scaled to for any math. */
  public static readonly PRECISION: Wei = parseWei('1', 18)
  /** Engine constant  for the seconds after a pool expires in which swaps are still possible. */
  public static readonly BUFFER: number = 120
  /** {@inheritdoc IEngine.factory} */
  public readonly factory: string
  /** {@inheritdoc IEngine.risky} */
  public readonly risky: Token
  /** {@inheritdoc IEngine.stable} */
  public readonly stable: Token
  /** {@inheritdoc IEngine.scaleFactorRisky} */
  public readonly scaleFactorRisky: Wei
  /** {@inheritdoc IEngine.scaleFactorStable} */
  public readonly scaleFactorStable: Wei

  /**
   * Creates a typescript instance of the PrimitiveEngine contract.
   *
   * @param factory Deployer of the Engine.
   * @param risky Risky token.
   * @param stable Stable token.
   *
   * @beta
   */
  constructor(factory: string, risky: Token, stable: Token) {
    invariant(risky.chainId === stable.chainId, `Token chainId mismatch: ${risky.chainId} != ${stable.chainId}`)
    invariant(isAddress(factory), `Factory is not a valid address: ${factory}`)
    invariant(isAddress(risky.address), `Risky token is not a valid address: ${risky.address}`)
    invariant(isAddress(stable.address), `Stable token is not a valid address: ${stable.address}`)
    super(
      risky.chainId,
      computeEngineAddress(factory, risky.address, stable.address, EngineArtifact.bytecode),
      18,
      'RMM-01',
      'Primitive RMM-01 LP Token'
    )

    this.factory = getAddress(factory)
    this.risky = risky
    this.stable = stable
    this.scaleFactorRisky = risky.decimals === 18 ? new Wei(One) : parseWei(1, 18 - risky.decimals)
    this.scaleFactorStable = stable.decimals === 18 ? new Wei(One) : parseWei(1, 18 - stable.decimals)
  }

  /** {@inheritdoc IEngine.involvesToken} */
  public involvesToken(token: Token): boolean {
    return this.risky.equals(token) || this.stable.equals(token)
  }

  /** {@inheritdoc IEngine.MIN_LIQUIDITY} */
  get MIN_LIQUIDITY(): number {
    return (
      (this.stable.decimals > this.risky.decimals ? this.risky.decimals : this.stable.decimals) /
      Engine.MIN_LIQUIDITY_FACTOR
    )
  }
}
