import { parseWei, Wei } from 'web3-units'
import invariant from 'tiny-invariant'
import { getAddress } from '@ethersproject/address'
import { Token } from '@uniswap/sdk-core'

export function checkDecimals(amount: Wei, token: Token) {
  invariant(amount.decimals === token.decimals, 'Amount decimals does not match token decimals')
}

/**
 * @notice Truncates `wad` to appropriate decimals then converts to a floating point number
 */
export function normalize(wad: number, decimals: number): number {
  const x = Math.trunc(wad * 10 ** decimals) / 10 ** decimals
  return x
}

/**
 * @notice A smart contract returns a wei value as a string,
 * this converts that string value by using the parseWei function, which multiplies
 * it by 10^decimals. Therefore, to get the actual string as a wei we have to divided it back.
 * @returns `wei` but as a Wei instance
 */
export function weiToWei(wei: string, decimals = 18): Wei {
  const parsed = parseWei(wei, decimals)
  const formatted = parsed.div(parseWei('1', decimals))
  return formatted
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
