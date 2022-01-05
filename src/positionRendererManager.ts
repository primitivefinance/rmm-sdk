import { Interface } from '@ethersproject/abi'
import { Signer } from '@ethersproject/abstract-signer'
import { ContractFactory } from '@ethersproject/contracts'

import PositionRendererArtifact from '@primitivefi/rmm-manager/artifacts/contracts/PositionRenderer.sol/PositionRenderer.json'

/**
 * Abstract class for PositionRenderer.
 *
 * @beta
 */
export abstract class PositionRendererManager {
  public static INTERFACE: Interface = new Interface(PositionRendererArtifact.abi)
  public static BYTECODE: string = PositionRendererArtifact.bytecode
  public static ABI: any[] = PositionRendererArtifact.abi
  public static getFactory: (signer?: Signer) => ContractFactory = signer =>
    new ContractFactory(PositionRendererManager.INTERFACE, PositionRendererManager.BYTECODE, signer)

  private constructor() {}
}
