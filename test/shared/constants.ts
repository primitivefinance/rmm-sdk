import { parseWei } from 'web3-units'
import { Token } from '@uniswap/sdk-core'
import { parseCalibration } from '../../src/entities/calibration'
import { AddressZero } from '@ethersproject/constants'
import { PoolInterface } from '../../src/entities/interfaces'
import { Time } from 'web3-units'

export const EMPTY_TOKEN = new Token(1, AddressZero, 18, 'EMPTY', 'Empty Token Class')
export const EMPTY_CALIBRATION = parseCalibration(AddressZero, EMPTY_TOKEN, EMPTY_TOKEN, {
  strike: parseWei(10).toString(),
  sigma: '1000',
  maturity: Time.YearInSeconds.toString(),
  gamma: '9900'
})

export const pools: {
  [engine: string]: {
    [poolId: string]: {
      data: PoolInterface
    }
  }
} = {}

export const AddressOne = '0x0000000000000000000000000000000000000001'
export const AddressTwo = '0x0000000000000000000000000000000000000002'
