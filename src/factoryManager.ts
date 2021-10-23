import invariant from 'tiny-invariant'
import { Interface } from '@ethersproject/abi'
import { AddressZero } from '@ethersproject/constants'
import { abi } from '@primitivefinance/v2-core/artifacts/contracts/PrimitiveFactory.sol/PrimitiveFactory.json'

export abstract class FactoryManager {
  public static INTERFACE: Interface = new Interface(abi)

  private constructor() {}

  // deploy engine
  public encodeDeploy(risky: string, stable: string): string {
    invariant(risky !== AddressZero && stable !== AddressZero, 'Zero address tokens')
    invariant(risky !== stable, 'Same tokens')
    return FactoryManager.INTERFACE.encodeFunctionData('deployEngine', [risky, stable])
  }
}
