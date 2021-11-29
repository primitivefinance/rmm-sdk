import { Pool } from '../../src/entities/pool'
import { Token, WETH9 } from '@uniswap/sdk-core'
import { parseWei, Time } from 'web3-units'
import { AddressZero } from '@ethersproject/constants'
import { EMPTY_CALIBRATION } from '../../src/constants'
import { parseCalibration } from '../../src/entities'

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
  const risky = Pool.getRiskyReservesGivenReferencePrice(strike.float, sigma.float, tau, spot.float)
  const stable = Pool.getStableGivenRisky(strike.float, sigma.float, tau, risky)
  const reserve = {
    reserveRisky: risky ? parseWei(risky, token0.decimals).toString() : '0',
    reserveStable: stable ? parseWei(stable, token1.decimals).toString() : '0',
    liquidity: parseWei(1, 18).toString()
  }
  const pool = Pool.from(
    {
      name: 'Pool',
      image: '',
      license: '',
      creator: '',
      description: 'Regular pool',
      properties: {
        factory: AddressZero,
        risky: { ...token0 },
        stable: { ...token1 },
        invariant: '0',
        calibration: {
          strike: strike.toString(),
          sigma: sigma.toString(),
          maturity: maturity.toString(),
          gamma: gamma.toString(),
          lastTimestamp: lastTimestamp.toString()
        },
        reserve
      }
    },
    spot.float,
    token0.chainId
  )
  return pool
}

export function usePool(): Pool {
  const token0 = new Token(1, AddressZero, 18)
  const token1 = new Token(1, AddressZero, 18)
  const spot = parseWei(10, token1.decimals)

  const { strike, sigma, maturity, gamma } = EMPTY_CALIBRATION
  const lastTimestamp = new Time(1)
  const tau = maturity.sub(lastTimestamp).years
  const risky = Pool.getRiskyReservesGivenReferencePrice(strike.float, sigma.float, tau, spot.float)
  const stable = Pool.getStableGivenRisky(strike.float, sigma.float, tau, risky)
  const reserve = {
    reserveRisky: risky ? parseWei(risky, token0.decimals).toString() : '0',
    reserveStable: stable ? parseWei(stable, token1.decimals).toString() : '0',
    liquidity: parseWei(1, 18).toString()
  }
  const pool = Pool.from(
    {
      name: 'Pool',
      image: '',
      license: '',
      creator: '',
      description: 'Regular pool',
      properties: {
        factory: AddressZero,
        risky: { ...token0 },
        stable: { ...token1 },
        invariant: '0',
        calibration: {
          strike: strike.toString(),
          sigma: sigma.toString(),
          maturity: maturity.toString(),
          gamma: gamma.toString(),
          lastTimestamp: lastTimestamp.toString()
        },
        reserve: { ...reserve }
      }
    },
    spot.float,
    token0.chainId
  )
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
  const risky = Pool.getRiskyReservesGivenReferencePrice(strike.float, sigma.float, tau, spot.float)
  const stable = Pool.getStableGivenRisky(strike.float, sigma.float, tau, risky)
  const reserve = {
    reserveRisky: risky ? parseWei(risky, token0.decimals).toString() : '0',
    reserveStable: stable ? parseWei(stable, token1.decimals).toString() : '0',
    liquidity: parseWei(1, 18).toString()
  }
  const pool = Pool.from(
    {
      name: 'Pool',
      image: '',
      license: '',
      creator: '',
      description: 'Regular pool',
      properties: {
        factory: AddressZero,
        risky: { ...token0 },
        stable: { ...token1 },
        invariant: '0',
        calibration: {
          strike: strike.toString(),
          sigma: sigma.toString(),
          maturity: maturity.toString(),
          gamma: gamma.toString(),
          lastTimestamp: lastTimestamp.toString()
        },
        reserve
      }
    },
    spot.float,
    token0.chainId
  )
  return pool
}
