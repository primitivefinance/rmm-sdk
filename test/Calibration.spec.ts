import { Token } from '@uniswap/sdk-core'
import { AddressZero } from '@ethersproject/constants'
import { parsePercentage, parseWei, Time } from 'web3-units'

import { Engine } from '../src/entities/engine'
import { Calibration } from '../src/entities/calibration'

describe('Calibration', function() {
  let cal: Calibration, token0: Token, token1: Token, strike: number, sigma: number, maturity: number

  beforeEach(async function() {
    token0 = new Token(1, AddressZero, 18)
    token1 = new Token(1, AddressZero, 18)
    ;[strike, sigma, maturity] = [10, 1, Time.YearInSeconds]
    cal = new Calibration(AddressZero, token0, token1, strike, sigma, maturity)
  })

  it('#poolId', async function() {
    const expected = Calibration.computePoolId(
      Engine.computeEngineAddress(AddressZero, token0.address, token1.address, Engine.BYTECODE),
      parseWei(strike, token1.decimals).raw,
      parsePercentage(sigma).raw,
      maturity
    )
    expect(cal.poolId).toBe(expected)
  })

  it('#strike', async function() {
    expect(cal.strike.float).toBe(strike)
  })

  it('#sigma', async function() {
    expect(cal.sigma.float).toBe(sigma)
  })

  it('#maturity', async function() {
    expect(cal.maturity.raw).toBe(maturity)
  })
})