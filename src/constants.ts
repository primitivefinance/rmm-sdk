import { Percentage } from 'web3-units'
import { Token } from '@uniswap/sdk-core'
import { parseCalibration } from './entities/calibration'
import { AddressZero } from '@ethersproject/constants'
import { PoolInterface } from './entities/interfaces'

export const PERCENTAGE: number = Math.pow(10, Percentage.Mantissa)
export const EMPTY_TOKEN = new Token(4, AddressZero, 18, 'EMPTY', 'Empty Token Class')
export const EMPTY_CALIBRATION = parseCalibration(AddressZero, EMPTY_TOKEN, EMPTY_TOKEN, 1, 1, 1, 1 - 0.0015)

export const pools: {
  [engine: string]: {
    [poolId: string]: {
      data: PoolInterface
    }
  }
} = {}
