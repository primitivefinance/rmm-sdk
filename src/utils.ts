import { getAddress } from '@ethersproject/address'

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
