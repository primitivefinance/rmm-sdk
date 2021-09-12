import { getAddress } from '@ethersproject/address'
import { utils, BigNumber } from 'ethers'
const { keccak256, solidityPack } = utils

export function computePoolId(
  engine: string,
  strike: string | BigNumber,
  sigma: string | BigNumber,
  maturity: string | number
): string {
  return keccak256(solidityPack(['address', 'uint256', 'uint64', 'uint32'], [engine, strike, sigma, maturity]))
}

/**
 * Validates an address and returns the parsed (checksummed) version of that address
 * @param address the unchecksummed hex address
 */
export function validateAndParseAddress(address: string): string {
  try {
    return getAddress(address)
  } catch (error) {
    throw new Error(`${address} is not a valid address.`)
  }
}

/**
 * Generated method parameters for executing a call.
 */
export interface MethodParameters {
  /**
   * The hex encoded calldata to perform the given operation
   */
  calldata: string
  /**
   * The amount of ether (wei) to send in hex.
   */
  value: string
}

/**
 * Converts a big int to a hex string
 * @param bigintIsh
 * @returns The hex encoded calldata
 */
export function toHex(bn: BigNumber) {
  return bn.toHexString()
}
