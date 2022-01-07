import { Token, WETH9 } from '@uniswap/sdk-core'
import { AddressZero } from '@ethersproject/constants'
import { parseWei, Time } from 'web3-units'

import { Pool } from '../../src/entities/pool'
import { Swaps } from '../../src/entities/swaps'
import { parseCalibration } from '../../src/utils/parseCalibration'

import { EMPTY_CALIBRATION } from './constants'
import { PoolInterface } from 'src'

export function usePoolWithDecimals(decimals: number): Pool {
  const token0 = new Token(1, AddressZero, decimals)
  const token1 = new Token(1, AddressZero, decimals)
  const spot = parseWei(10, token1.decimals)

  const { strike, sigma, maturity, gamma } = parseCalibration(AddressZero, token0, token1, {
    strike: parseWei(10, decimals).toString(),
    sigma: '1000',
    maturity: Time.YearInSeconds.toString(),
    gamma: '9900'
  })
  const lastTimestamp = new Time(1)
  const tau = maturity.sub(lastTimestamp).years
  const risky = Swaps.getRiskyReservesGivenReferencePrice(strike.float, sigma.float, tau, spot.float)
  const stable = Swaps.getStableGivenRisky(strike.float, sigma.float, tau, risky)
  const reserve = {
    reserveRisky: risky ? parseWei(risky, token0.decimals).toString() : '0',
    reserveStable: stable ? parseWei(stable, token1.decimals).toString() : '0',
    liquidity: parseWei(1, 18).toString()
  }
  const uri: PoolInterface = {
    name: 'Pool',
    image: '',
    license: '',
    creator: '',
    description: 'Regular pool',
    properties: {
      chainId: '1',
      factory: AddressZero,
      riskyName: token0.name,
      riskyAddress: token0.address,
      riskySymbol: token0.symbol,
      riskyDecimals: token0.decimals,
      stableName: token1.name,
      stableDecimals: token1.decimals,
      stableSymbol: token1.symbol,
      stableAddress: token1.address,
      strike: strike.toString(),
      sigma: sigma.toString(),
      maturity: maturity.toString(),
      gamma: gamma.toString(),
      lastTimestamp: lastTimestamp.toString(),
      reserveRisky: reserve.reserveRisky,
      reserveStable: reserve.reserveStable,
      liquidity: reserve.liquidity
    }
  }
  const pool = Pool.from(uri, spot.float)
  return pool
}

export function usePool(): Pool {
  const token0 = new Token(1, AddressZero, 18)
  const token1 = new Token(1, AddressZero, 18)
  const spot = parseWei(10, token1.decimals)

  const { strike, sigma, maturity, gamma } = EMPTY_CALIBRATION
  const lastTimestamp = new Time(1)
  const tau = maturity.sub(lastTimestamp).years
  const risky = Swaps.getRiskyReservesGivenReferencePrice(strike.float, sigma.float, tau, spot.float)
  const stable = Swaps.getStableGivenRisky(strike.float, sigma.float, tau, risky)
  const reserve = {
    reserveRisky: risky ? parseWei(risky, token0.decimals).toString() : '0',
    reserveStable: stable ? parseWei(stable, token1.decimals).toString() : '0',
    liquidity: parseWei(1, 18).toString()
  }
  const uri: PoolInterface = {
    name: 'Pool',
    image: '',
    license: '',
    creator: '',
    description: 'Regular pool',
    properties: {
      chainId: '1',
      factory: AddressZero,
      riskyName: token0.name,
      riskyAddress: token0.address,
      riskySymbol: token0.symbol,
      riskyDecimals: token0.decimals,
      stableName: token1.name,
      stableDecimals: token1.decimals,
      stableSymbol: token1.symbol,
      stableAddress: token1.address,
      strike: strike.toString(),
      sigma: sigma.toString(),
      maturity: maturity.toString(),
      gamma: gamma.toString(),
      lastTimestamp: lastTimestamp.toString(),
      reserveRisky: reserve.reserveRisky,
      reserveStable: reserve.reserveStable,
      liquidity: reserve.liquidity
    }
  }
  const pool = Pool.from(uri, spot.float)
  return pool
}

export function useWethPool(): Pool {
  const token0 = WETH9[1]
  const token1 = new Token(1, AddressZero, 18)
  const spot = parseWei(10, token1.decimals)

  const { strike, sigma, maturity, gamma } = parseCalibration(AddressZero, token0, token1, {
    strike: parseWei(10, token1.decimals).toString(),
    sigma: '1000',
    maturity: Time.YearInSeconds.toString(),
    gamma: '9900'
  })
  const lastTimestamp = new Time(1)
  const tau = maturity.sub(lastTimestamp).years
  const risky = Swaps.getRiskyReservesGivenReferencePrice(strike.float, sigma.float, tau, spot.float)
  const stable = Swaps.getStableGivenRisky(strike.float, sigma.float, tau, risky)
  const reserve = {
    reserveRisky: risky ? parseWei(risky, token0.decimals).toString() : '0',
    reserveStable: stable ? parseWei(stable, token1.decimals).toString() : '0',
    liquidity: parseWei(1, 18).toString()
  }
  const uri: PoolInterface = {
    name: 'Pool',
    image: '',
    license: '',
    creator: '',
    description: 'Regular pool',
    properties: {
      chainId: '1',
      factory: AddressZero,
      riskyName: token0.name,
      riskyAddress: token0.address,
      riskySymbol: token0.symbol,
      riskyDecimals: token0.decimals,
      stableName: token1.name,
      stableDecimals: token1.decimals,
      stableSymbol: token1.symbol,
      stableAddress: token1.address,
      strike: strike.toString(),
      sigma: sigma.toString(),
      maturity: maturity.toString(),
      gamma: gamma.toString(),
      lastTimestamp: lastTimestamp.toString(),
      reserveRisky: reserve.reserveRisky,
      reserveStable: reserve.reserveStable,
      liquidity: reserve.liquidity
    }
  }
  const pool = Pool.from(uri, spot.float)
  return pool
}
