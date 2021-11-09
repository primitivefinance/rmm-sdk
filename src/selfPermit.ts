import { Token } from '@uniswap/sdk-core'
import { Interface } from '@ethersproject/abi'
import { abi } from '@primitivefinance/rmm-core/artifacts/contracts/PrimitiveFactory.sol/PrimitiveFactory.json' // todo: fix placeholder
import { BigNumber } from 'ethers'

export interface StandardPermitArguments {
  v: 0 | 1 | 27 | 28
  r: string
  s: string
  amount: BigNumber
  deadline: BigNumber
}

export interface AllowedPermitArguments {
  v: 0 | 1 | 27 | 28
  r: string
  s: string
  nonce: BigNumber
  expiry: BigNumber
}

export type PermitOptions = StandardPermitArguments | AllowedPermitArguments

function isAllowedPermit(permitOptions: PermitOptions): permitOptions is AllowedPermitArguments {
  return 'nonce' in permitOptions
}

export abstract class SelfPermit {
  public static INTERFACE: Interface = new Interface(abi)

  protected constructor() {}

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
