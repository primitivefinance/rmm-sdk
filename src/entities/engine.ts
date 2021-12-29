import { utils, constants } from 'ethers'
import { getAddress, isAddress } from 'ethers/lib/utils'
import { Interface } from '@ethersproject/abi'
import { Token } from '@uniswap/sdk-core'
import EngineArtifact from '@primitivefi/rmm-core/artifacts/contracts/PrimitiveEngine.sol/PrimitiveEngine.json'
import { parseWei, Wei } from 'web3-units'
import invariant from 'tiny-invariant'

export function getTokenPairSaltHash(token0: string, token1: string): string {
  return utils.solidityKeccak256(['bytes'], [utils.defaultAbiCoder.encode(['address', 'address'], [token0, token1])])
}

/**
 * @notice Represents the PrimitiveEngine.sol smart contract
 */
export class Engine extends Token {
  public static BYTECODE: string = EngineArtifact.bytecode
  public static INTERFACE: Interface = new Interface(EngineArtifact.abi)
  public static ABI: any = EngineArtifact.abi

  /**
   * @notice Used to calculate minimum liquidity based on lowest decimals of risky/stable
   */
  public static readonly MIN_LIQUIDITY_FACTOR = 6
  /**
   * @notice Engine constant value which all values are scaled to for any math
   */
  public static readonly PRECISION: Wei = parseWei('1', 18)
  /**
   * @notice Engine constant  for the seconds after a pool expires in which swaps are still possible
   */
  public static readonly BUFFER: number = 120
  /**
   * @notice Deployer of this Engine
   */
  public readonly factory: string
  /**
   * @notice Risky asset
   */
  public readonly risky: Token
  /**
   * @notice Stable asset
   */
  public readonly stable: Token
  /**
   * @notice Multiplier to scale risky token amounts to the base `PRECISION`
   */
  public readonly scaleFactorRisky: Wei
  /**
   * @notice Multiplier to scale stable token amounts to the base `PRECISION`
   */
  public readonly scaleFactorStable: Wei

  /**
   * @notice Creates a typescript instance of the PrimitiveEngine contract
   * @param factory Deployer of the Engine
   * @param risky Risky token
   * @param stable Stable token
   */
  constructor(factory: string, risky: Token, stable: Token) {
    invariant(risky.chainId === stable.chainId, `Token chainId mismatch: ${risky.chainId} != ${stable.chainId}`)
    super(
      risky.chainId,
      Engine.computeEngineAddress(factory, risky.address, stable.address, EngineArtifact.bytecode),
      18,
      'RMM-01',
      'Primitive RMM-01 LP Token'
    )

    this.factory = getAddress(factory)
    this.risky = risky
    this.stable = stable
    this.scaleFactorRisky = risky.decimals === 18 ? new Wei(constants.One) : parseWei(1, 18 - risky.decimals)
    this.scaleFactorStable = stable.decimals === 18 ? new Wei(constants.One) : parseWei(1, 18 - stable.decimals)
  }

  public involvesToken(token: Token): boolean {
    return this.risky.equals(token) || this.stable.equals(token)
  }

  /**
   * @notice Minimum amount of liquidity to supply on calling `create()`
   */
  get MIN_LIQUIDITY(): number {
    return (
      (this.stable.decimals > this.risky.decimals ? this.risky.decimals : this.stable.decimals) /
      Engine.MIN_LIQUIDITY_FACTOR
    )
  }

  /**
   * @notice Statically computes an Engine address
   * @param factory Deployer of the Engine contract
   * @param risky Risky token
   * @param stable Stable token
   * @param contractBytecode Bytecode of the PrimitiveEngine.sol smart contract
   * @returns engine address
   */
  static computeEngineAddress(factory: string, risky: string, stable: string, contractBytecode: string): string {
    invariant(isAddress(factory), `Factory is not a valid address: ${factory}`)
    invariant(isAddress(risky), `Risky token is not a valid address: ${risky}`)
    invariant(isAddress(stable), `Stable token is not a valid address: ${stable}`)
    const salt = getTokenPairSaltHash(risky, stable)
    return utils.getCreate2Address(factory, salt, utils.keccak256(contractBytecode))
  }
}
