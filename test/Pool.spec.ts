import { Token } from '@uniswap/sdk-core'
import { parseWei, Time } from 'web3-units'
import { AddressZero } from '@ethersproject/constants'
import { callDelta, callPremium, getStableGivenRiskyApproximation } from '@primitivefinance/v2-math'

import { Pool } from '../src/entities/pool'

describe('Test pool', function() {
  let pool: Pool,
    strike: number,
    sigma: number,
    maturity: number,
    gamma: number,
    lastTimestamp: number,
    spot: number,
    tau: number

  beforeEach(async function() {
    ;[strike, sigma, maturity, lastTimestamp, gamma, spot] = [10, 1, Time.YearInSeconds + 1, 1, 1 - 0.0015, 10]
    tau = new Time(maturity - lastTimestamp).years
    const delta = callDelta(strike, sigma, tau, spot)
    const risky = parseWei(1 - delta, 18)
    const stable = parseWei(getStableGivenRiskyApproximation(risky.float, strike, sigma, tau), 18)
    pool = new Pool(
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
  })

  it('gets the theoretical liquidity value', async function() {
    const theoretical = pool.getTheoreticalLiquidityValue()
    expect(theoretical).toBeCloseTo(strike - callPremium(strike, sigma, tau, spot))
  })

  it('gets the current liquidity value', async function() {
    const current = pool.getCurrentLiquidityValue(spot)
    expect(current.valuePerLiquidity.float).toBeCloseTo(pool.getTheoreticalLiquidityValue(lastTimestamp))
  })

  it('new Pool(...).poolId', async function() {
    const main = new Pool(
      AddressZero,
      new Token(1, AddressZero, 18),
      new Token(1, AddressZero, 18),
      strike,
      sigma,
      maturity,
      gamma,
      lastTimestamp,
      parseWei(0.5),
      parseWei(5),
      parseWei(1),
      spot
    )

    expect(main).toBeDefined()
  })

  it('pool.liquidityQuote()', async function() {
    const amount = parseWei('0.5')
    const liquidityQuote = pool.liquidityQuote(amount, pool.risky)
    const delStable = liquidityQuote.delLiquidity.mul(pool.reserveStable).div(pool.liquidity)
    expect(liquidityQuote.delStable.float).toBeCloseTo(delStable.float)
  })

  it('pool.liquidityQuote() with a fresh pool', async function() {
    const amount = parseWei('0.5')
    const liquidityQuote = pool.liquidityQuote(amount, pool.risky, true)
    const delStable = liquidityQuote.delLiquidity.mul(pool.reserveStable).div(pool.liquidity)
    expect(liquidityQuote.delStable.float).toBeCloseTo(delStable.float)
  })
})
