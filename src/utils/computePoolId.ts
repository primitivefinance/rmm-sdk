import { keccak256, solidityPack } from 'ethers/lib/utils'

/**
 * Computes deterministic poolIds from hashing engine address and calibration parameters.
 *
 * @param engine Address of Engine contract.
 * @param strike Strike price in wei, with decimal places equal to the Engine's `stable` token decimals.
 * @param sigma  Implied volatility in basis points.
 * @param maturity Timestamp of expiration in seconds, matching the format of `block.timestamp`.
 * @param gamma  Equal to 10_000 - fee, in basis points. Used to apply fee on swaps.
 *
 * @returns Keccak256 hash of a solidity packed array of engine address and calibration struct.
 *
 * @beta
 */
export function computePoolId(engine: string, strike: string, sigma: string, maturity: string, gamma: string): string {
  return keccak256(
    solidityPack(['address', 'uint128', 'uint32', 'uint32', 'uint32'], [engine, strike, sigma, maturity, gamma])
  )
}
