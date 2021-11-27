import { Token } from '@uniswap/sdk-core'
import { parseWei, Percentage, Time, toBN, Wei } from 'web3-units'
import { AddressZero } from '@ethersproject/constants'
import { callDelta, getStableGivenRiskyApproximation } from '@primitivefinance/v2-math'

import { Pool, PoolSides } from '../src/entities/pool'
import { parseCalibration } from '../src/entities/calibration'

describe('Test pool', function() {
  let pool: Pool,
    token0: Token,
    token1: Token,
    strike: Wei,
    sigma: Percentage,
    maturity: Time,
    gamma: Percentage,
    lastTimestamp: Time,
    spot: Wei,
    tau: number

  beforeEach(async function() {
    token0 = new Token(1, AddressZero, 18)
    token1 = new Token(1, AddressZero, 18)
    ;[strike, sigma, maturity, gamma] = [
      parseWei(10),
      new Percentage(toBN('1000')),
      new Time(Time.YearInSeconds),
      new Percentage(toBN('9985'))
    ]

    lastTimestamp = new Time(Time.now)
    tau = new Time(Number(maturity) - Number(lastTimestamp)).years
    const delta = callDelta(strike.float, sigma.float, tau, spot.float)
    const risky = parseWei(1 - delta, 18)
    const stable = parseWei(getStableGivenRiskyApproximation(risky.float, strike.float, sigma.float, tau), 18)

    const calibration = parseCalibration(AddressZero, token0, token1, {
      strike: strike.toString(),
      sigma: sigma.toString(),
      maturity: maturity.toString(),
      gamma: gamma.toString()
    })
    calibration.poolId
    const reserve = {
      reserveRisky: risky.toString(),
      reserveStable: stable.toString(),
      liquidity: parseWei(1, 18).toString()
    }

    pool = Pool.from({
      name: 'Pool',
      image: '',
      license: '',
      creator: '',
      description: 'Regular pool',
      properties: {
        factory: '',
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
    })
  })

  it('gets the current liquidity value', async function() {
    const current = pool.getCurrentLiquidityValue(spot.float)
    expect(current.valuePerLiquidity.float).toBeGreaterThan(0)
  })

  /* it('new Pool(...).poolId', async function() {
    const cal = parseCalibration(
      AddressZero,
      new Token(1, AddressZero, 18),
      new Token(1, AddressZero, 18),
      strike,
      sigma,
      maturity,
      gamma
    )
    const main = new Pool(
      AddressZero,
      new Token(1, AddressZero, 18),
      new Token(1, AddressZero, 18),
      cal.strike,
      cal.sigma,
      cal.maturity,
      cal.gamma,
      new Time(lastTimestamp),
      parseWei(0.5),
      parseWei(5),
      parseWei(1),
      spot
    )

    expect(main).toBeDefined()
  }) */

  it('pool.liquidityQuote()', async function() {
    const amount = parseWei('0.5')
    const liquidityQuote = pool.liquidityQuote(amount, PoolSides.RISKY)
    const delStable = liquidityQuote.delLiquidity.mul(pool.reserveStable).div(pool.liquidity)
    expect(liquidityQuote.delStable.float).toBeCloseTo(delStable.float)
  })

  it('pool.liquidityQuote() with a fresh pool', async function() {
    const amount = parseWei('0.5')
    const liquidityQuote = pool.liquidityQuote(amount, PoolSides.RISKY)
    const delStable = liquidityQuote.delLiquidity.mul(pool.reserveStable).div(pool.liquidity)
    expect(liquidityQuote.delStable.float).toBeCloseTo(delStable.float)
  })
})
