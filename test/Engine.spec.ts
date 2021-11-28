import { Token } from '@uniswap/sdk-core'
import { AddressZero } from '@ethersproject/constants'

import { Engine } from '../src/entities/engine'

describe('Engine entity', function() {
  let engine: Engine, token0: Token, token1: Token, token2: Token

  beforeEach(async function() {
    token0 = new Token(1, AddressZero, 18)
    token1 = new Token(1, AddressZero, 18)
    token2 = new Token(2, AddressZero, 18)
    engine = new Engine(AddressZero, token0, token1)
  })

  it('#scaleFactor - 18 decimals', async function() {
    expect(engine.scaleFactorRisky.raw.toNumber()).toStrictEqual(1)
    expect(engine.scaleFactorStable.raw.toNumber()).toStrictEqual(1)
  })

  it('#involvesToken successful', async function() {
    expect(engine.involvesToken(token0)).toBe(true)
    expect(engine.involvesToken(token1)).toBe(true)
  })

  it('#involvesToken fail', async function() {
    expect(engine.involvesToken(token2)).toBe(false)
  })

  it('#MIN_LIQUIDITY', async function() {
    const expected = token0.decimals / Engine.MIN_LIQUIDITY_FACTOR
    expect(engine.MIN_LIQUIDITY).toBe(expected)
  })

  it('#computeEngineAddress', async function() {
    const expected = Engine.computeEngineAddress(AddressZero, token0.address, token1.address, Engine.BYTECODE)
    expect(engine.address).toBe(expected)
  })
})
