import constants from '@ethersproject/constants'
import { Percentage } from 'web3-units'
export const { AddressZero } = constants

export const PERCENTAGE: number = Math.pow(10, Percentage.Mantissa)
