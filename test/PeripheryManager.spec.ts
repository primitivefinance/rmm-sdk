import { parseWei } from 'web3-units'
import { AddressZero } from '@ethersproject/constants'

import { Pool } from '../src/entities/pool'
import { usePool, usePoolWithDecimals, useWethPool } from './shared/fixture'
import { PeripheryManager } from '../src/peripheryManager'
import { Ether, NativeCurrency } from '@uniswap/sdk-core'

function decode(frag: string, data: any) {
  return PeripheryManager.INTERFACE.decodeFunctionData(frag, data)
}

describe('Periphery Manager', function() {
  let pool: Pool, from: string, wethPool: Pool, useNative: NativeCurrency, lowDecimalPool: Pool

  beforeEach(async function() {
    pool = usePool()
    wethPool = useWethPool()
    lowDecimalPool = usePoolWithDecimals(6)
    from = '0x0000000000000000000000000000000000000001'
    useNative = Ether.onChain(1)
  })

  describe('#encodeCreate', function() {
    it('successful', async function() {
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

      const calldata = PeripheryManager.encodeCreate(pool, liquidity)
      const decoded = decode(frag, calldata)
      data.forEach((item, i) => expect(item).toStrictEqual(decoded[i]))
    })

    it('fails with wrong liquidity decimals', async function() {
      const liquidity = parseWei(1, 9)
      expect(() => PeripheryManager.encodeCreate(pool, liquidity)).toThrow()
    })
  })

  describe('#createCallParameters', function() {
    it('successful', async function() {
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

      const { calldata, value } = PeripheryManager.createCallParameters(pool, liquidity)
      const decoded = decode(frag, calldata)
      data.forEach((item, i) => expect(item).toStrictEqual(decoded[i]))
      expect(value).toBe('0x00')
    })
  })

  describe('#depositCallParameters', function() {
    it('encoded calldata matches decoded arguments', async function() {
      const recipient = from
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

    it('uses native token successfully', async function() {
      const recipient = from
      const amountRisky = parseWei(1)
      const amountStable = parseWei(1)

      expect(
        PeripheryManager.depositCallParameters(wethPool, { recipient, amountRisky, amountStable, useNative }).value
      ).toBe(amountRisky.raw.toHexString())
    })

    it('fails with wrong risky decimals', async function() {
      const recipient = AddressZero
      const amountRisky = parseWei(1)
      const amountStable = parseWei(1, 6)
      expect(() =>
        PeripheryManager.depositCallParameters(lowDecimalPool, { recipient, amountRisky, amountStable })
      ).toThrow()
    })

    it('fails with wrong stable decimals', async function() {
      const recipient = AddressZero
      const amountRisky = parseWei(1, 6)
      const amountStable = parseWei(1)
      expect(() =>
        PeripheryManager.depositCallParameters(lowDecimalPool, { recipient, amountRisky, amountStable })
      ).toThrow()
    })

    it('fails with address zero as recipient', async function() {
      const recipient = AddressZero
      const amountRisky = parseWei(1)
      const amountStable = parseWei(1)
      expect(() => PeripheryManager.depositCallParameters(pool, { recipient, amountRisky, amountStable })).toThrow()
    })

    it('fails with 0 amounts', async function() {
      const recipient = from
      const amountRisky = parseWei(0)
      const amountStable = parseWei(0)
      expect(() => PeripheryManager.depositCallParameters(pool, { recipient, amountRisky, amountStable })).toThrow()
    })

    it('fails with using native on a pool which does not have a wrapped token', async function() {
      const recipient = from
      const amountRisky = parseWei(1)
      const amountStable = parseWei(1)

      expect(() =>
        PeripheryManager.depositCallParameters(pool, { recipient, amountRisky, amountStable, useNative })
      ).toThrow()
    })
  })

  describe('#encodeWithdraw', function() {
    it('successful', async function() {
      const recipient = from
      const amountRisky = parseWei(1)
      const amountStable = parseWei(1)
      const calldatas = PeripheryManager.encodeWithdraw(pool, { recipient, amountRisky, amountStable })
      const decoded = decode('withdraw', calldatas[0])
      const data = [recipient, pool.address, amountRisky.raw, amountStable.raw]
      data.forEach((item, i) => expect(item).toStrictEqual(decoded[i]))
    })

    it('uses native token successfully', async function() {
      const recipient = from
      const amountRisky = parseWei(1)
      const amountStable = parseWei(1)

      const calldatas = PeripheryManager.encodeWithdraw(wethPool, {
        recipient,
        amountRisky,
        amountStable,
        useNative
      })

      const unwrapCalldata = calldatas[1]
      const sweepTokenCalldata = calldatas[2]
      const unwrapDecoded = decode('unwrap', unwrapCalldata)
      const sweepDecoded = decode('sweepToken', sweepTokenCalldata)
      const unwrapData = [amountRisky.raw, recipient]
      const sweepData = [wethPool.stable.address, amountStable.raw, recipient]

      unwrapData.forEach((data, i) => expect(data).toStrictEqual(unwrapDecoded[i]))
      sweepData.forEach((data, i) => expect(data).toStrictEqual(sweepDecoded[i]))
    })

    it('fails with wrong risky decimals', async function() {
      const recipient = AddressZero
      const amountRisky = parseWei(1)
      const amountStable = parseWei(1, 6)
      expect(() => PeripheryManager.encodeWithdraw(lowDecimalPool, { recipient, amountRisky, amountStable })).toThrow()
    })

    it('fails with wrong stable decimals', async function() {
      const recipient = AddressZero
      const amountRisky = parseWei(1, 6)
      const amountStable = parseWei(1)
      expect(() => PeripheryManager.encodeWithdraw(lowDecimalPool, { recipient, amountRisky, amountStable })).toThrow()
    })

    it('fails with address zero as recipient', async function() {
      const recipient = AddressZero
      const amountRisky = parseWei(1)
      const amountStable = parseWei(1)
      expect(() => PeripheryManager.encodeWithdraw(pool, { recipient, amountRisky, amountStable })).toThrow()
    })

    it('fails with both 0 amounts', async function() {
      const recipient = from
      const amountRisky = parseWei(0)
      const amountStable = parseWei(0)
      expect(() => PeripheryManager.encodeWithdraw(pool, { recipient, amountRisky, amountStable })).toThrow()
    })

    it('fails with using native on a pool which does not have a wrapped token', async function() {
      const recipient = from
      const amountRisky = parseWei(1)
      const amountStable = parseWei(1)

      expect(() => PeripheryManager.encodeWithdraw(pool, { recipient, amountRisky, amountStable, useNative })).toThrow()
    })
  })
  describe('#withdrawCallParameters', function() {
    it('successful', async function() {
      const recipient = from
      const amountRisky = parseWei(1)
      const amountStable = parseWei(1)
      const { calldata, value } = PeripheryManager.withdrawCallParameters(pool, {
        recipient,
        amountRisky,
        amountStable
      })

      const data = [recipient, pool.address, amountRisky.raw, amountStable.raw]

      const decoded = decode('withdraw', calldata)
      data.forEach((item, i) => expect(item).toStrictEqual(decoded[i]))
      expect(value).toBe('0x00')
    })

    it('fails with wrong risky decimals', async function() {
      const recipient = AddressZero
      const amountRisky = parseWei(1)
      const amountStable = parseWei(1, 6)
      expect(() =>
        PeripheryManager.withdrawCallParameters(lowDecimalPool, { recipient, amountRisky, amountStable })
      ).toThrow()
    })

    it('fails with wrong stable decimals', async function() {
      const recipient = AddressZero
      const amountRisky = parseWei(1, 6)
      const amountStable = parseWei(1)
      expect(() =>
        PeripheryManager.withdrawCallParameters(lowDecimalPool, { recipient, amountRisky, amountStable })
      ).toThrow()
    })

    it('successful with multicall calldata bundle when using native', async function() {
      const recipient = from
      const amountRisky = parseWei(1)
      const amountStable = parseWei(1)

      const { value } = PeripheryManager.withdrawCallParameters(wethPool, {
        recipient,
        amountRisky,
        amountStable,
        useNative
      })
      expect(value).toBe('0x00')
    })
  })

  describe('#allocateCallParameters', function() {
    it('successful', async function() {
      const recipient = from
      const fromMargin = false
      const delRisky = parseWei(0.3, pool.risky.decimals)
      const delStable = parseWei(3, pool.stable.decimals)
      const delLiquidity = parseWei(1, 18)

      const { calldata, value } = PeripheryManager.allocateCallParameters(pool, {
        recipient,
        fromMargin,
        delRisky,
        delStable,
        delLiquidity
      })
      const data = [pool.poolId, pool.risky.address, pool.stable.address, delRisky.raw, delStable.raw, fromMargin]
      const decoded = decode('allocate', calldata)
      data.forEach((item, i) => expect(item).toStrictEqual(decoded[i]))
      expect(value).toBe('0x00')
    })

    it('successful using native', async function() {
      const recipient = from
      const fromMargin = false
      const delRisky = parseWei(0.3, wethPool.risky.decimals)
      const delStable = parseWei(3, wethPool.stable.decimals)
      const delLiquidity = parseWei(1, 18)

      const { calldata, value } = PeripheryManager.allocateCallParameters(wethPool, {
        recipient,
        fromMargin,
        delRisky,
        delStable,
        delLiquidity,
        useNative
      })

      const allocateData = [
        wethPool.poolId,
        wethPool.risky.address,
        wethPool.stable.address,
        delRisky.raw,
        delStable.raw,
        fromMargin
      ]

      const multicall = decode('multicall', calldata)

      const allocateDecoded = decode('allocate', multicall.data[0])
      allocateData.forEach((item, i) => expect(item).toStrictEqual(allocateDecoded[i]))

      const refundETHDecoded = decode('refundETH', multicall.data[1])
      expect(refundETHDecoded).toBeDefined()
      expect(value).toBe(delRisky.raw.toHexString())
    })

    it('successful when creating pool instead', async function() {
      const recipient = from
      const fromMargin = false
      const createPool = true
      const delRisky = parseWei(0.3, wethPool.risky.decimals)
      const delStable = parseWei(3, wethPool.stable.decimals)
      const delLiquidity = parseWei(1, 18)

      const { calldata, value } = PeripheryManager.allocateCallParameters(wethPool, {
        recipient,
        fromMargin,
        delRisky,
        delStable,
        delLiquidity,
        createPool
      })

      const decimals = pool.risky.decimals
      const delta = parseWei(pool.delta, decimals)
      const riskyPerLp = parseWei(1, decimals).sub(delta)
      const createData = [
        wethPool.risky.address,
        wethPool.stable.address,
        wethPool.strike.raw,
        wethPool.sigma.raw,
        wethPool.maturity.raw,
        riskyPerLp.raw,
        delLiquidity.raw
      ]

      const decoded = decode('create', calldata)
      createData.forEach((item, i) => expect(item).toStrictEqual(decoded[i]))

      expect(value).toBe('0x00')
    })

    it('fails if delRisky is 0', async function() {
      const recipient = from
      const fromMargin = false
      const delRisky = parseWei(0, pool.risky.decimals)
      const delStable = parseWei(3, pool.stable.decimals)
      const delLiquidity = parseWei(1, 18)

      expect(() =>
        PeripheryManager.allocateCallParameters(pool, {
          recipient,
          fromMargin,
          delRisky,
          delStable,
          delLiquidity
        })
      ).toThrow()
    })

    it('fails with wrong risky decimals', async function() {
      const recipient = from
      const fromMargin = false
      const delRisky = parseWei(0.3, lowDecimalPool.risky.decimals + 1)
      const delStable = parseWei(0, lowDecimalPool.stable.decimals)
      const delLiquidity = parseWei(1, 18)
      expect(() =>
        PeripheryManager.allocateCallParameters(lowDecimalPool, {
          recipient,
          fromMargin,
          delRisky,
          delStable,
          delLiquidity
        })
      ).toThrow()
    })

    it('fails with wrong stable decimals', async function() {
      const recipient = from
      const fromMargin = false
      const delRisky = parseWei(0.3, lowDecimalPool.risky.decimals)
      const delStable = parseWei(0, lowDecimalPool.stable.decimals + 1)
      const delLiquidity = parseWei(1, 18)
      expect(() =>
        PeripheryManager.allocateCallParameters(lowDecimalPool, {
          recipient,
          fromMargin,
          delRisky,
          delStable,
          delLiquidity
        })
      ).toThrow()
    })

    it('fails if delStable is 0', async function() {
      const recipient = from
      const fromMargin = false
      const delRisky = parseWei(0.3, pool.risky.decimals)
      const delStable = parseWei(0, pool.stable.decimals)
      const delLiquidity = parseWei(1, 18)

      expect(() =>
        PeripheryManager.allocateCallParameters(pool, {
          recipient,
          fromMargin,
          delRisky,
          delStable,
          delLiquidity
        })
      ).toThrow()
    })

    it('fails if delLiquidity is 0', async function() {
      const recipient = from
      const fromMargin = false
      const delRisky = parseWei(0.3, pool.risky.decimals)
      const delStable = parseWei(3, pool.stable.decimals)
      const delLiquidity = parseWei(0, 18)

      expect(() =>
        PeripheryManager.allocateCallParameters(pool, {
          recipient,
          fromMargin,
          delRisky,
          delStable,
          delLiquidity
        })
      ).toThrow()
    })

    it('fails when createPool and fromMargin are both true', async function() {
      const recipient = from
      const fromMargin = true
      const createPool = true
      const delRisky = parseWei(0.3, pool.risky.decimals)
      const delStable = parseWei(3, pool.stable.decimals)
      const delLiquidity = parseWei(0, 18)

      expect(() =>
        PeripheryManager.allocateCallParameters(pool, {
          recipient,
          fromMargin,
          delRisky,
          delStable,
          delLiquidity,
          createPool
        })
      ).toThrow()
    })
  })

  describe('#removeCallParameters', function() {
    it('successful', async function() {
      const recipient = from
      const toMargin = true
      const delRisky = parseWei(0.3, pool.risky.decimals)
      const delStable = parseWei(3, pool.stable.decimals)
      const delLiquidity = parseWei(1, 18)
      const expectedRisky = delRisky
      const expectedStable = delStable

      const { calldata, value } = PeripheryManager.removeCallParameters(pool, {
        delLiquidity,
        expectedRisky,
        expectedStable,
        toMargin,
        delRisky,
        delStable,
        recipient
      })

      const data = [pool.address, pool.poolId, delLiquidity.raw]
      const decoded = decode('remove', calldata)
      data.forEach((item, i) => expect(item).toStrictEqual(decoded[i]))
      expect(value).toBe('0x00')
    })

    it('fails if delLiquidity is zero', async function() {
      const recipient = from
      const toMargin = false
      const delRisky = parseWei(0.3, pool.risky.decimals)
      const delStable = parseWei(3, pool.stable.decimals)
      const delLiquidity = parseWei(0, 18)
      const expectedRisky = delRisky
      const expectedStable = delStable

      expect(() =>
        PeripheryManager.removeCallParameters(pool, {
          delLiquidity,
          expectedRisky,
          expectedStable,
          toMargin,
          delRisky,
          delStable,
          recipient
        })
      ).toThrow()
    })

    it('fails with wrong risky decimals', async function() {
      const recipient = from
      const toMargin = false
      const delRisky = parseWei(0.3, lowDecimalPool.risky.decimals + 1)
      const delStable = parseWei(3, lowDecimalPool.stable.decimals)
      const delLiquidity = parseWei(1, 18)
      const expectedRisky = delRisky
      const expectedStable = delStable
      expect(() =>
        PeripheryManager.removeCallParameters(lowDecimalPool, {
          delLiquidity,
          expectedRisky,
          expectedStable,
          toMargin,
          delRisky,
          delStable,
          recipient
        })
      ).toThrow()
    })

    it('fails with wrong stable decimals', async function() {
      const recipient = from
      const toMargin = false
      const delRisky = parseWei(0.3, lowDecimalPool.risky.decimals)
      const delStable = parseWei(3, lowDecimalPool.stable.decimals + 1)
      const delLiquidity = parseWei(1, 18)
      const expectedRisky = delRisky
      const expectedStable = delStable
      expect(() =>
        PeripheryManager.removeCallParameters(lowDecimalPool, {
          delLiquidity,
          expectedRisky,
          expectedStable,
          toMargin,
          delRisky,
          delStable,
          recipient
        })
      ).toThrow()
    })

    it('fails with wrong liquidity decimals', async function() {
      const recipient = from
      const toMargin = false
      const delRisky = parseWei(0.3, lowDecimalPool.risky.decimals)
      const delStable = parseWei(3, lowDecimalPool.stable.decimals)
      const delLiquidity = parseWei(1, 6)
      const expectedRisky = delRisky
      const expectedStable = delStable
      expect(() =>
        PeripheryManager.removeCallParameters(lowDecimalPool, {
          delLiquidity,
          expectedRisky,
          expectedStable,
          toMargin,
          delRisky,
          delStable,
          recipient
        })
      ).toThrow()
    })
  })
})
