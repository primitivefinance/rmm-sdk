import { BigNumber } from 'ethers'
import { Interface } from '@ethersproject/abi'
import { Token } from '@uniswap/sdk-core'
import ManagerArtifact from '@primitivefi/rmm-manager/artifacts/contracts/PrimitiveManager.sol/PrimitiveManager.json'

/** Valid secp256k1 signature components */
export interface RSV {
  v: 0 | 1 | 27 | 28
  r: string
  s: string
}

/** {@link https://eips.ethereum.org/EIPS/eip-2612} */
export interface StandardPermitArguments extends RSV {
  /** Value of approval to make in permit call. */
  amount: BigNumber

  /** Timestamp to void permit signature.  */
  deadline: BigNumber
}

/** {@link https://eips.ethereum.org/EIPS/eip-2612} */
export interface AllowedPermitArguments extends RSV {
  /** Nonce of this permit. */
  nonce: BigNumber

  /** Timestamp to void permit signature. */
  expiry: BigNumber
}

/** Either {@link AllowedPermitArguments} or {@link StandardPermitArguments} */
export type PermitOptions = StandardPermitArguments | AllowedPermitArguments

/** True if `permitOptions` has a `nonce` attribute. */
function isAllowedPermit(permitOptions: PermitOptions): permitOptions is AllowedPermitArguments {
  return 'nonce' in permitOptions
}

/**
 * Abstract class with static methods to encode permit related function calldata.
 */
export abstract class SelfPermit {
  public static INTERFACE: Interface = new Interface(ManagerArtifact.abi)

  protected constructor() {}

  /**
   * Get encoded function data with function selector depending on permit type.
   *
   * @param token Token entity to permit.
   * @param options Signature and permit details.
   *
   * @public
   */
  protected static encodePermit(token: Token, options: PermitOptions) {
    return isAllowedPermit(options)
      ? SelfPermit.INTERFACE.encodeFunctionData('selfPermitAllowed', [
          token.address,
          options.nonce.toHexString(),
          options.expiry.toHexString(),
          options.v,
          options.r,
          options.s
        ])
      : SelfPermit.INTERFACE.encodeFunctionData('selfPermit', [
          token.address,
          options.amount.toHexString(),
          options.deadline.toHexString(),
          options.v,
          options.r,
          options.s
        ])
  }
}
