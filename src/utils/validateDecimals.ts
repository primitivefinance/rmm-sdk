import { Wei } from 'web3-units'
import invariant from 'tiny-invariant'
import { Token } from '@uniswap/sdk-core'

/**
 * Checks if `amount.decimals` is equal to `token.decimals`.
 *
 * @param amount Amount as a Wei class to compare the decimals of to `token.decimals`.
 * @param token Token to check the `amount` against for the same decimals.
 *
 * @throws
 * Throws if token decimals are not equal.
 *
 * @beta
 */
export function validateDecimals(amount: Wei, token: Token): void {
  invariant(
    amount.decimals === token.decimals,
    `Amount decimals does not match token decimals: ${amount.decimals} != ${token.decimals}`
  )
}
