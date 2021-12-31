import { Wei, parseWei } from 'web3-units'

/**
 * Gets a Wei class from a wei string value.
 *
 * @remarks
 * This converts the wei value by using the parseWei function, which multiplies
 * it by 10^decimals. Therefore, to get the actual string as a Wei class we have to divided it down by the same scalar.
 *
 * @params wei Raw wei value as a string to convert into a Wei class.
 * @params decimals Decimal places of wei value, since its an integer in the EVM.
 *
 * @returns `wei` but as a Wei instance.
 *
 * @beta
 */
export function weiToWei(wei: string, decimals = 18): Wei {
  const parsed = parseWei(wei, decimals).div(parseWei('1', decimals))
  return parsed
}
