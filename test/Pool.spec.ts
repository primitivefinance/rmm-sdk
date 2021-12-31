import { Token } from '@uniswap/sdk-core'
import { parseWei, Time } from 'web3-units'

import { Swaps } from '../src/entities/swaps'
import { Pool, PoolSides } from '../src/entities/pool'

import { usePool } from './shared/fixture'
import { AddressOne, EMPTY_CALIBRATION } from './shared'

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
    const risky = Swaps.getRiskyReservesGivenReferencePrice(strike.float, sigma.float, tau, spot.float)
    const stable = Swaps.getStableGivenRisky(strike.float, sigma.float, tau, risky)
    const reserve = {
      reserveRisky: '1.345867008995041e+21',
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

  it('fromReferencePrice', async function() {
    const token0 = new Token(1, AddressOne, 18)
    const token1 = new Token(1, AddressOne, 18)
    const spot = parseWei(10, token1.decimals)

    const { strike, sigma, maturity, gamma } = EMPTY_CALIBRATION
    const lastTimestamp = new Time(1)
    const tau = maturity.sub(lastTimestamp).years
    const risky = Swaps.getRiskyReservesGivenReferencePrice(strike.float, sigma.float, tau, spot.float)
    const stable = Swaps.getStableGivenRisky(strike.float, sigma.float, tau, risky)
    const reserve = {
      reserveRisky: '1.345867008995041e+21',
      reserveStable: stable ? parseWei(stable, token1.decimals).toString() : '0',
      liquidity: parseWei(1, 18).toString()
    }
    const pool = Pool.fromReferencePrice(
      spot.float,
      AddressOne,
      { ...token0 },
      { ...token1 },
      {
        strike: strike.toString(),
        sigma: sigma.toString(),
        maturity: maturity.toString(),
        gamma: gamma.toString(),
        lastTimestamp: lastTimestamp.toString()
      },
      token0.chainId
    )
    expect(pool.poolId).toBeDefined()
    expect(pool.reserveRisky.float).toBeCloseTo(risky)
    expect(pool.liquidity.toString()).toEqual(reserve.liquidity)
  })

  it('gets the current liquidity value', async function() {
    const current = pool.getCurrentLiquidityValue(pool?.referencePriceOfRisky?.float ?? 1)
    expect(current.valuePerLiquidity.float).toBeGreaterThan(0)
  })

  it('#lastTimestamp', async function() {
    const time = new Time(Time.now + 10)
    pool.lastTimestamp = time
    expect(pool.lastTimestamp.raw).toEqual(time.raw)
  })

  it('pool.liquidityQuote() risky', async function() {
    const amount = parseWei('0.5')
    const liquidityQuote = pool.liquidityQuote(amount, PoolSides.RISKY)
    const delStable = liquidityQuote.delLiquidity.mul(pool.reserveStable).div(pool.liquidity)
    expect(liquidityQuote.delStable.float).toBeCloseTo(delStable.float)
  })

  it('pool.liquidityQuote() stable', async function() {
    const amount = parseWei('0.5')
    const liquidityQuote = pool.liquidityQuote(amount, PoolSides.STABLE)
    const delRisky = liquidityQuote.delLiquidity.mul(pool.reserveRisky).div(pool.liquidity)
    expect(liquidityQuote.delRisky.float).toBeCloseTo(delRisky.float)
  })

  it('pool.liquidityQuote() RMM', async function() {
    const amount = parseWei('0.5')
    const liquidityQuote = pool.liquidityQuote(amount, PoolSides.RMM_LP)
    const delStable = liquidityQuote.delLiquidity.mul(pool.reserveStable).div(pool.liquidity)
    expect(liquidityQuote.delStable.float).toBeCloseTo(delStable.float)
  })

  it('pool.liquidityQuote() with a fresh pool', async function() {
    const amount = parseWei('0.5')
    const liquidityQuote = pool.liquidityQuote(amount, PoolSides.RISKY)
    const delStable = liquidityQuote.delLiquidity.mul(pool.reserveStable).div(pool.liquidity)
    expect(liquidityQuote.delStable.float).toBeCloseTo(delStable.float)
  })

  it('#remaining', async function() {
    expect(pool.remaining.raw).toEqual(Time.now >= pool.maturity.raw ? 0 : pool.maturity.sub(pool.lastTimestamp).raw)
  })
  it('#expired', async function() {
    expect(pool.expired).toBe(Time.now >= pool.maturity.raw ? true : false)
  })
  it('#delta', async function() {
    expect(pool.delta).toBeGreaterThan(0)
  })
  it('#premium', async function() {
    expect(pool.premium).toBeGreaterThan(0)
  })
  it('#inTheMoney', async function() {
    expect(pool.inTheMoney).toBe(pool.reportedPriceOfRisky && pool.reportedPriceOfRisky.float >= pool.strike.float)
  })

  it('#reportedPriceOfRisky', async function() {
    expect(pool.reportedPriceOfRisky).toBeDefined()
  })

  it('#swapArgs', async function() {
    const args = pool.swapArgs
    const check = [
      pool.risky.decimals,
      pool.stable.decimals,
      pool.reserveRisky.float,
      pool.reserveStable.float,
      pool.liquidity.float,
      pool.strike.float,
      pool.sigma.float,
      pool.gamma.float,
      pool.tau.add(120).years
    ]
    args.forEach((arg, i) => expect(arg).toStrictEqual(check[i]))
  })
  /* it('#amountIn risky out', async function() {
    const tokenOut = pool.risky
    const amountOut = parseWei(0.0001, pool.risky.decimals).float
    expect(pool.amountIn(tokenOut, amountOut).input).toBeGreaterThan(0)
  })
  it('#amountOut risky in', async function() {
    const tokenIn = pool.risky
    const amountIn = parseWei(0.0001, pool.risky.decimals).float
    expect(pool.amountOut(tokenIn, amountIn).output).toBeGreaterThan(0)
  })
  it('#amountIn stable out', async function() {
    const tokenOut = pool.stable
    const amountOut = parseWei(0.0001, pool.stable.decimals).float
    expect(pool.amountIn(tokenOut, amountOut).input).toBeGreaterThan(0)
  })
  it('#amountOut stable in', async function() {
    const tokenIn = pool.stable
    const amountIn = parseWei(0.0001, pool.stable.decimals).float
    expect(pool.amountOut(tokenIn, amountIn).output).toBeGreaterThan(0)
  }) */
  it('#derivativeOut', async function() {
    const tokenIn = pool.risky
    const amountIn = 0
    expect(pool.derivativeOut(tokenIn, amountIn)).toBeGreaterThan(0)
  })
})
