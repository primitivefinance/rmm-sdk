import { Percentage } from 'web3-units'
import { Token } from '@uniswap/sdk-core'
import { Calibration } from './entities/calibration'
import { AddressZero } from '@ethersproject/constants'

export const PERCENTAGE: number = Math.pow(10, Percentage.Mantissa)
export const EMPTY_TOKEN = new Token(4, AddressZero, 18, 'EMPTY', 'Empty Token Class')
export const EMPTY_CALIBRATION = new Calibration(AddressZero, EMPTY_TOKEN, EMPTY_TOKEN, 1, 1, 1, 1, 1)
