import { Token } from '@uniswap/sdk-core'
import { VirtualPool } from '../src/entities'
import { Calibration } from '../src'
import { parseWei, Time } from 'web3-units'
import { callDelta, callPremium } from '@primitivefinance/v2-math'
import { AddressZero } from '@ethersproject/constants'

describe('Test pool', function() {
  let pool: VirtualPool, prices: number[]

  beforeEach(async function() {
    const token = new Token(1, AddressZero, 18)
    const calibration: Calibration = new Calibration(AddressZero, token, token, 10, 1, Time.YearInSeconds + 1, 1, 10)
    pool = new VirtualPool(calibration, parseWei(1 - callDelta(10, 1, 1, 10)), parseWei(1))
    prices = [10, 1]
  })
  it('gets the theoretical liquidity value', async function() {
    const theoretical = pool.getTheoreticalLiquidityValue()
    expect(theoretical).toBeCloseTo(10 - callPremium(10, 1, 1, 10))
  })

  it('gets the current liquidity value', async function() {
    const current = pool.getCurrentLiquidityValue(prices)
    expect(current.valuePerLiquidity.float).toBeCloseTo(pool.getTheoreticalLiquidityValue())
  })

  it('gets the theoretical max fee', async function() {
    const max = pool.getTheoreticalMaxFee(1)
    expect(max).toBeCloseTo(callPremium(10, 1, 1, 10))
  })
})
