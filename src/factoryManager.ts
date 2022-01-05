import invariant from 'tiny-invariant'
import { getAddress } from 'ethers/lib/utils'
import { Interface } from '@ethersproject/abi'
import { AddressZero } from '@ethersproject/constants'
import { Signer } from '@ethersproject/abstract-signer'
import { ContractFactory } from '@ethersproject/contracts'

import FactoryArtifact from '@primitivefi/rmm-core/artifacts/contracts/PrimitiveFactory.sol/PrimitiveFactory.json'

/**
 * Abstract class with static methods to encode and bundle calldata.
 *
 * @beta
 */
export abstract class FactoryManager {
  public static INTERFACE: Interface = new Interface(FactoryArtifact.abi)
  public static BYTECODE: string = FactoryArtifact.bytecode
  public static ABI: any[] = FactoryArtifact.abi
  public static getFactory: (signer?: Signer) => ContractFactory = signer =>
    new ContractFactory(FactoryManager.INTERFACE, FactoryManager.BYTECODE, signer)

  private constructor() {}

  /**
   * Gets encoded function data with `deploy` function selector and two token addresses.
   *
   * @param risky Address of risky token.
   * @param stable Address of stable token.
   *
   * @throws
   * Throws if risky or stable addresses are not valid addresses.
   * Throws if risky or stable arguments are equal to the zero address.
   * Throws if risky and stable arguments are the same.
   *
   * @beta
   */
  public static encodeDeploy(risky: string, stable: string): string {
    risky = getAddress(risky)
    stable = getAddress(stable)
    invariant(risky !== AddressZero && stable !== AddressZero, 'Zero address tokens')
    invariant(risky !== stable, 'Same tokens')
    return FactoryManager.INTERFACE.encodeFunctionData('deploy', [risky, stable])
  }
}
