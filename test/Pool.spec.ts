import { Token } from '@uniswap/sdk-core'
import { parseWei, Time } from 'web3-units'

import { Pool, PoolSides } from '../src/entities/pool'
import { AddressOne, EMPTY_CALIBRATION } from './shared'
import { usePool } from './shared/fixture'

describe('Test pool', function() {
  let pool: Pool

  beforeEach(async function() {
    pool = usePool()
  })

  it('from', async function() {
    const token0 = new Token(1, AddressOne, 18)
    const token1 = new Token(1, AddressOne, 18)
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
    const invariant = '3.345867008995041e+21'
    const pool = Pool.from(
      {
        name: 'Pool',
        image: '',
        license: '',
        creator: '',
        description: 'Regular pool',
        properties: {
          factory: AddressOne,
          risky: { ...token0 },
          stable: { ...token1 },
          invariant: invariant,
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
    expect(pool.poolId).toBeDefined()
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
