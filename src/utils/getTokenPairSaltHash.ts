import { solidityKeccak256, defaultAbiCoder } from 'ethers/lib/utils'

/**
 * Get hash of the token pair addresses is used as the salt in PrimitiveFactory create2 calls.
 *
 * @remarks
 * These tokens are not sorted. Their position as token0 or token1 matters for PrimitiveEngine contracts.
 *
 * @param token0 Address of risky token.
 * @param token1 Address of stable token.
 *
 * @returns solidity keccak256 hash of both `token0` and `token` addresses.
 *
 * @beta
 */
export function getTokenPairSaltHash(token0: string, token1: string): string {
  return solidityKeccak256(['bytes'], [defaultAbiCoder.encode(['address', 'address'], [token0, token1])])
}
