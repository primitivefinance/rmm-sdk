import { Pool } from '../../src/entities/pool'
import { Token, WETH9 } from '@uniswap/sdk-core'
import { parseWei, Time } from 'web3-units'
import { AddressZero } from '@ethersproject/constants'
import { callDelta, getStableGivenRiskyApproximation } from '@primitivefinance/v2-math'

export function usePoolWithDecimals(decimals: number): Pool {
  const [strike, sigma, maturity, lastTimestamp, gamma, spot] = [10, 1, Time.YearInSeconds + 1, 1, 1 - 0.0015, 10]
  const tau = new Time(maturity - lastTimestamp).years
  const delta = callDelta(strike, sigma, tau, spot)
  const risky = parseWei(1 - delta, decimals)
  const stable = parseWei(getStableGivenRiskyApproximation(risky.float, strike, sigma, tau), decimals)
  const pool = new Pool(
    AddressZero,
    new Token(1, AddressZero, decimals),
    new Token(1, AddressZero, decimals),
    strike,
    sigma,
    maturity,
    gamma,
    lastTimestamp,
    risky,
    stable,
    parseWei(1),
    spot
  )
  return pool
}

export function usePool(): Pool {
  const [strike, sigma, maturity, lastTimestamp, gamma, spot] = [10, 1, Time.YearInSeconds + 1, 1, 1 - 0.0015, 10]
  const tau = new Time(maturity - lastTimestamp).years
  const delta = callDelta(strike, sigma, tau, spot)
  const risky = parseWei(1 - delta, 18)
  const stable = parseWei(getStableGivenRiskyApproximation(risky.float, strike, sigma, tau), 18)
  const pool = new Pool(
    AddressZero,
    new Token(1, AddressZero, 18),
    new Token(1, AddressZero, 18),
    strike,
    sigma,
    maturity,
    gamma,
    lastTimestamp,
    risky,
    stable,
    parseWei(1),
    spot
  )
  return pool
}

export function useWethPool(): Pool {
  const [strike, sigma, maturity, lastTimestamp, gamma, spot] = [10, 1, Time.YearInSeconds + 1, 1, 1 - 0.0015, 10]
  const tau = new Time(maturity - lastTimestamp).years
  const delta = callDelta(strike, sigma, tau, spot)
  const risky = parseWei(1 - delta, 18)
  const stable = parseWei(getStableGivenRiskyApproximation(risky.float, strike, sigma, tau), 18)
  const pool = new Pool(
    AddressZero,
    WETH9[1],
    new Token(1, AddressZero, 18),
    strike,
    sigma,
    maturity,
    gamma,
    lastTimestamp,
    risky,
    stable,
    parseWei(1),
    spot
  )
  return pool
}
