import { Token } from '@uniswap/sdk-core'
import { AddressZero } from '@ethersproject/constants'
import { parseWei, Percentage, Time } from 'web3-units'
import { formatUnits } from '@ethersproject/units'

import { Engine } from '../src/entities/engine'
import { Calibration, parseCalibration } from '../src/entities/calibration'

describe('Calibration', function() {
  let cal: Calibration, token0: Token, token1: Token, strike: string, sigma: string, maturity: string, gamma: string

  beforeEach(async function() {
    token0 = new Token(1, AddressZero, 18)
    token1 = new Token(1, AddressZero, 18)
    ;[strike, sigma, maturity, gamma] = [parseWei(10).toString(), '1000', Time.YearInSeconds.toString(), '9985']
    cal = parseCalibration(AddressZero, token0, token1, { strike, sigma, maturity, gamma })
  })

  it('#poolId', async function() {
    const expected = Calibration.computePoolId(
      Engine.computeEngineAddress(AddressZero, token0.address, token1.address, Engine.BYTECODE),
      strike,
      sigma,
      maturity,
      gamma
    )
    expect(cal.poolId).toBe(expected)
  })

  it('#strike', async function() {
    expect(cal.strike.float).toBe(parseFloat(formatUnits(strike, token1.decimals)))
  })

  it('#sigma', async function() {
    expect(cal.sigma.float).toBe(parseFloat(sigma) / Percentage.BasisPoints)
  })

  it('#maturity', async function() {
    expect(cal.maturity.raw).toBe(parseFloat(maturity))
  })

  it('#gamma', async function() {
    expect(cal.gamma.float).toBe(parseFloat(gamma) / Percentage.BasisPoints)
  })

  it('#gamma fails out of bounds', async function() {
    expect(() => parseCalibration(AddressZero, token0, token1, { strike, sigma, maturity, gamma: '0' })).toThrow()
    expect(() =>
      parseCalibration(AddressZero, token0, token1, { strike, sigma, maturity, gamma: (1e8).toString() })
    ).toThrow()
  })
  it('#gamma succeeds on bounds', async function() {
    expect(() => parseCalibration(AddressZero, token0, token1, { strike, sigma, maturity, gamma: '1' })).toBeDefined()
    expect(() =>
      parseCalibration(AddressZero, token0, token1, { strike, sigma, maturity, gamma: (1e7).toString() })
    ).toBeDefined()
  })
})
