import { parseWei } from 'web3-units'
import { Token } from '@uniswap/sdk-core'
import { Calibration } from './entities/calibration'
import { AddressZero } from '@ethersproject/constants'
import { PoolInterface } from './entities/interfaces'

export const EMPTY_TOKEN = new Token(4, AddressZero, 18, 'EMPTY', 'Empty Token Class')
export const EMPTY_CALIBRATION = Calibration.from(AddressZero, EMPTY_TOKEN, EMPTY_TOKEN, {
  strike: parseWei(1).toString(),
  sigma: '5000',
  maturity: '1',
  gamma: '9900'
})

export const pools: {
  [engine: string]: {
    [poolId: string]: {
      data: PoolInterface
    }
  }
} = {}
