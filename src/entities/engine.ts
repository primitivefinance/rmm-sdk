import { utils, constants } from 'ethers'
import { Token } from '@uniswap/sdk-core'
import { parseWei, Wei } from 'web3-units'
import { Interface } from '@ethersproject/abi'
import {
  bytecode,
  abi
} from '@primitivefinance/rmm-core/artifacts/contracts/PrimitiveEngine.sol/PrimitiveEngine.json'

/**
 * @notice Represents the PrimitiveEngine.sol smart contract
 */
export class Engine extends Token {
  public static BYTECODE: string = bytecode
  public static INTERFACE: Interface = new Interface(abi)

  /**
   * @notice Used to calculate minimum liquidity based on lowest decimals of risky/stable
   */
  public static readonly MIN_LIQUIDITY_FACTOR = 6
  /**
   * @notice Engine constant value which all values are scaled to for any math
   */
  public static readonly PRECISION: Wei = parseWei('1', 18)
  /**
   * @notice Engine constant used to apply fee of 0.15% to swaps
   */
  public static readonly GAMMA: number = 9985
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
   * @notice Creates a typescript instance of the PrimitveEngine contract
   * @param factory Deployer of the Engine
   * @param risky Risky token
   * @param stable Stable token
   */
  constructor(factory: string, risky: Token, stable: Token) {
    super(
      risky.chainId,
      Engine.computeEngineAddress(factory, risky.address, stable.address, bytecode),
      18,
      'RMM-01',
      'Primitive RMM-01 LP Token'
    )
    this.factory = factory
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
    const salt = utils.solidityKeccak256(
      ['bytes'],
      [utils.defaultAbiCoder.encode(['address', 'address'], [risky, stable])]
    )
    return utils.getCreate2Address(factory, salt, utils.keccak256(contractBytecode))
  }
}
