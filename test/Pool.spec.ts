import { Token } from '@uniswap/sdk-core'
import { Pool } from '../src'
import { parseWei } from 'web3-units'
import { callDelta, callPremium } from '@primitivefinance/v2-math'
import { AddressZero } from '@ethersproject/constants'

describe('Test pool', function() {
  let pool: Pool, priceOfRisky: number

  beforeEach(async function() {
    pool = new Pool(
      AddressZero,
      new Token(1, AddressZero, 18),
      new Token(1, AddressZero, 18),
      10,
      1,
      10,
      1,
      1,
      parseWei(1 - callDelta(10, 1, 1, 10)),
      parseWei(3.8),
      parseWei(1),
      10
    )
  })

  it('gets the theoretical liquidity value', async function() {
    const theoretical = pool.getTheoreticalLiquidityValue()
    expect(theoretical).toBeCloseTo(10 - callPremium(10, 1, 1, 10))
  })

  it('gets the current liquidity value', async function() {
    const current = pool.getCurrentLiquidityValue(priceOfRisky)
    expect(current.valuePerLiquidity.float).toBeCloseTo(pool.getTheoreticalLiquidityValue())
  })

  it('gets the theoretical max fee', async function() {
    const max = pool.getTheoreticalMaxFee(1)
    expect(max).toBeCloseTo(callPremium(10, 1, 1, 10))
  })

  it('new Pool(...).poolId', async function() {
    const main = new Pool(
      AddressZero,
      new Token(1, AddressZero, 18),
      new Token(1, AddressZero, 18),
      10,
      1,
      10,
      1,
      1,
      parseWei(0.5),
      parseWei(5),
      parseWei(1),
      10
    )

    expect(main).toBeDefined
  })

  it('pool.quote()', async function() {
    const amount = parseWei('0.5')
    const quote = pool.liquidityQuote(amount, pool.risky)
    const delStable = quote.delLiquidity.mul(pool.reserveStable).div(pool.liquidity)
    expect(quote.delStable.float).toBeCloseTo(delStable.float)
  })
})
