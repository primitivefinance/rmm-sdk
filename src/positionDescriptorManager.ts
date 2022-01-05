import { Interface } from '@ethersproject/abi'
import { Signer } from '@ethersproject/abstract-signer'
import { ContractFactory } from '@ethersproject/contracts'

import PositionDescriptorArtifact from '@primitivefi/rmm-manager/artifacts/contracts/PositionDescriptor.sol/PositionDescriptor.json'

/**
 * Abstract class for PositionDescriptor.
 *
 * @beta
 */
export abstract class PositionDescriptorManager {
  public static INTERFACE: Interface = new Interface(PositionDescriptorArtifact.abi)
  public static BYTECODE: string = PositionDescriptorArtifact.bytecode
  public static ABI: any[] = PositionDescriptorArtifact.abi
  public static getFactory: (signer?: Signer) => ContractFactory = signer =>
    new ContractFactory(PositionDescriptorManager.INTERFACE, PositionDescriptorManager.BYTECODE, signer)

  private constructor() {}
}
