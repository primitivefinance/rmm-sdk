import { parseWei } from 'web3-units'
import { AddressZero } from '@ethersproject/constants'

import { Pool } from '../src/entities/pool'
import { usePool } from './shared/fixture'
import { PeripheryManager } from '../src/peripheryManager'

function decode(frag: string, data: any) {
  return PeripheryManager.INTERFACE.decodeFunctionData(frag, data)
}

describe('Swap Manager', function() {
  let pool: Pool

  beforeEach(async function() {
    pool = usePool()
  })

  it('createCallParameters()', async function() {
    const liquidity = parseWei(1, 18)
    const decimals = pool.risky.decimals
    const delta = parseWei(pool.delta, decimals)
    const riskyPerLp = parseWei(1, decimals).sub(delta)
    const frag = 'create'
    const data = [
      pool.risky.address,
      pool.stable.address,
      pool.strike.raw,
      pool.sigma.raw,
      pool.maturity.raw,
      riskyPerLp.raw,
      liquidity.raw
    ]

    const encoded = PeripheryManager.encodeCreate(pool, liquidity)
    const decoded = decode(frag, encoded)
    data.forEach((item, i) => expect(item).toStrictEqual(decoded[i]))
  })

  it('depositCallParameters()', async function() {
    const recipient = '0x0000000000000000000000000000000000000001'
    const risky = pool.risky
    const stable = pool.stable
    const amountRisky = parseWei(1)
    const amountStable = parseWei(1)
    const data = [recipient, risky.address, stable.address, amountRisky.raw, amountStable.raw]
    const { calldata, value } = PeripheryManager.depositCallParameters(pool, { recipient, amountRisky, amountStable })
    const decoded = decode('deposit', calldata)
    data.forEach((item, i) => expect(item).toStrictEqual(decoded[i]))
    expect(value).toBe('0x00')
  })

  it('encodeWithdraw()', async function() {})

  it('withdrawCallParameters()', async function() {})

  it('removeCallParameters()', async function() {})

  it('fail:depositCallParameters() with address zero', async function() {
    const recipient = AddressZero
    const amountRisky = parseWei(1)
    const amountStable = parseWei(1)
    expect(() => PeripheryManager.depositCallParameters(pool, { recipient, amountRisky, amountStable })).toThrow()
  })
})
