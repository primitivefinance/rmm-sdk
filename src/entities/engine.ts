import { parseWei, Wei } from 'web3-units'
import { Token } from '@uniswap/sdk-core'
import { utils } from 'ethers'
import { bytecode as EngineBytecode } from '@primitivefinance/v2-core/artifacts/contracts/PrimitiveEngine.sol/PrimitiveEngine.json'

/**
 * @notice Represents the PrimitiveEngine.sol smart contract
 */
export class Engine {
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
    this.factory = factory
    this.risky = risky
    this.stable = stable
    this.scaleFactorRisky = parseWei(1, 18 - risky.decimals)
    this.scaleFactorStable = parseWei(1, 18 - stable.decimals)
  }

  /**
   * @notice Computes the Engine address of this instance using the factory and its immutable tokens
   */
  get address(): string {
    return Engine.computeEngineAddress(this.factory, this.risky.address, this.stable.address, EngineBytecode)
  }

  get chainId(): number {
    return this.risky.chainId
  }

  public involvesToken(token: Token): boolean {
    return this.risky.equals(token) || this.stable.equals(token)
  }

  /**
   * @notice Statically computes an Engine address
   * @param factory Deployer of the Engine contract
   * @param risky Risky token
   * @param stable Stable token
   * @param bytecode Bytecode of the PrimitiveEngine.sol smart contract
   * @returns engine address
   */
  static computeEngineAddress(factory: string, risky: string, stable: string, bytecode: string): string {
    const salt = utils.solidityKeccak256(
      ['bytes'],
      [utils.defaultAbiCoder.encode(['address', 'address'], [risky, stable])]
    )
    return utils.getCreate2Address(factory, salt, utils.keccak256(bytecode))
  }
}
