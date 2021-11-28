import { parseWei } from 'web3-units'

import { Pool, PoolSides } from '../src/entities/pool'
import { usePool } from './shared/fixture'

describe('Test pool', function() {
  let pool: Pool

  beforeEach(async function() {
    pool = usePool()
  })

  it('gets the current liquidity value', async function() {
    const current = pool.getCurrentLiquidityValue(pool?.referencePriceOfRisky?.float ?? 1)
    expect(current.valuePerLiquidity.float).toBeGreaterThan(0)
  })

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
