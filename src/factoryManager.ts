import invariant from 'tiny-invariant'
import { Interface } from '@ethersproject/abi'
import { AddressZero } from '@ethersproject/constants'
import FactoryArtifact from '@primitivefinance/rmm-core/artifacts/contracts/PrimitiveFactory.sol/PrimitiveFactory.json'

export abstract class FactoryManager {
  public static INTERFACE: Interface = new Interface(FactoryArtifact.abi)
  public static BYTECODE: string = FactoryArtifact.bytecode
  public static ABI: any = FactoryArtifact.abi

  private constructor() {}

  // deploy engine
  public static encodeDeploy(risky: string, stable: string): string {
    invariant(risky !== AddressZero && stable !== AddressZero, 'Zero address tokens')
    invariant(risky !== stable, 'Same tokens')
    return FactoryManager.INTERFACE.encodeFunctionData('deploy', [risky, stable])
  }
}
