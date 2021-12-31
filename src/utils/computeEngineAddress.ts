import { getCreate2Address, keccak256 } from 'ethers/lib/utils'
import { getTokenPairSaltHash } from './getTokenPairSaltHash'

/**
 * Statically computes an Engine address.
 *
 * @remarks
 * Verify `contractBytecode` is up-to-date.
 *
 * @param factory Deployer of the Engine contract.
 * @param risky Risky token address.
 * @param stable Stable token address.
 * @param contractBytecode Bytecode of the PrimitiveEngine.sol smart contract.
 *
 * @returns engine address.
 *
 * @beta
 */
export function computeEngineAddress(factory: string, risky: string, stable: string, contractBytecode: string): string {
  const salt = getTokenPairSaltHash(risky, stable)
  return getCreate2Address(factory, salt, keccak256(contractBytecode))
}
