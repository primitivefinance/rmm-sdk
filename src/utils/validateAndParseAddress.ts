import { getAddress } from '@ethersproject/address'

/**
 * Validates an address and returns the parsed (checksummed) version of that address.
 *
 * @param address the unchecksummed hex address.
 *
 * @throws
 * Throws if `address` is an invalid hex address.
 *
 * @beta
 */
export function validateAndParseAddress(address: string): string {
  try {
    return getAddress(address)
  } catch (error) {
    throw new Error(`${address} is not a valid address.`)
  }
}
