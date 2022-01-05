import { AddressZero } from '@ethersproject/constants'
import { parsePercentage, parseWei, Percentage, Time, toBN } from 'web3-units'

import { Pool } from '../src/entities/pool'
import { SwapManager } from '../src/swapManager'

import { usePool } from './shared/fixture'
import { AddressOne } from './shared/constants'
import { ContractFactory } from 'ethers'

function decode(frag: string, data: any) {
  return SwapManager.INTERFACE.decodeFunctionData(frag, data)
}

describe('Swap Manager', function() {
  let pool: Pool

  beforeEach(async function() {
    pool = usePool()
  })

  it('getFactory returns the ethers factory', async function() {
    expect(SwapManager.getFactory()).toStrictEqual(new ContractFactory(SwapManager.INTERFACE, SwapManager.BYTECODE))
  })

  describe('#swapCallParameters', function() {
    it('successful', async function() {
      const riskyForStable = true
      const deltaIn = parseWei(0.3, pool.risky.decimals)
      const deltaOut = parseWei(3.0, pool.stable.decimals)
      const fromMargin = false
      const toMargin = false
      const recipient = AddressOne
      const deadline = toBN(Time.YearInSeconds)
      const slippageTolerance = parsePercentage(3 / 100)
      const options = {
        riskyForStable,
        deltaIn,
        deltaOut,
        fromMargin,
        toMargin,
        recipient,
        deadline,
        slippageTolerance
      }

      const { calldata, value } = SwapManager.swapCallParameters(pool, options)

      const data = [
        recipient,
        pool.risky.address,
        pool.stable.address,
        pool.poolId,
        riskyForStable,
        deltaIn.raw,
        deltaOut.raw,
        fromMargin,
        toMargin,
        deadline
      ]
      const decoded = decode('swap', calldata)
      data.forEach((item, i) => expect(item).toStrictEqual(decoded[0][i]))
      expect(value).toBe('0x00')
    })

    it('fails when recipient is address zero', async function() {
      const riskyForStable = true
      const deltaIn = parseWei(0.3, pool.risky.decimals)
      const deltaOut = parseWei(3.0, pool.stable.decimals)
      const fromMargin = false
      const toMargin = false
      const recipient = AddressZero
      const deadline = toBN(Time.YearInSeconds)
      const slippageTolerance = parsePercentage(3 / 100)
      const options = {
        riskyForStable,
        deltaIn,
        deltaOut,
        fromMargin,
        toMargin,
        recipient,
        deadline,
        slippageTolerance
      }
      expect(() => SwapManager.swapCallParameters(pool, options)).toThrow()
    })

    it('fails when deltaIn decimals does not match in token amount decimals', async function() {
      const riskyForStable = true
      const deltaIn = parseWei(0.3, pool.risky.decimals - 1)
      const deltaOut = parseWei(3.0, pool.stable.decimals)
      const fromMargin = false
      const toMargin = false
      const recipient = AddressZero
      const deadline = toBN(Time.YearInSeconds)
      const slippageTolerance = parsePercentage(3 / 100)
      const options = {
        riskyForStable,
        deltaIn,
        deltaOut,
        fromMargin,
        toMargin,
        recipient,
        deadline,
        slippageTolerance
      }
      expect(() => SwapManager.swapCallParameters(pool, options)).toThrow()
    })

    it('fails when deltaOut decimals does not match out token amount decimals', async function() {
      const riskyForStable = true
      const deltaIn = parseWei(0.3, pool.risky.decimals)
      const deltaOut = parseWei(3.0, pool.stable.decimals - 1)
      const fromMargin = false
      const toMargin = false
      const recipient = AddressZero
      const deadline = toBN(Time.YearInSeconds)
      const slippageTolerance = parsePercentage(3 / 100)
      const options = {
        riskyForStable,
        deltaIn,
        deltaOut,
        fromMargin,
        toMargin,
        recipient,
        deadline,
        slippageTolerance
      }
      expect(() => SwapManager.swapCallParameters(pool, options)).toThrow()
    })
  })

  describe('#minimumAmountOut', function() {
    it('successful', async function() {
      const slippageTolerance = parsePercentage(3 / 100)
      const amountOut = parseWei(1, 18)
      const expected = amountOut
        .mul(Math.pow(10, Percentage.Mantissa))
        .div(Math.pow(10, Percentage.Mantissa) + +slippageTolerance.raw)
      expect(SwapManager.minimumAmountOut(slippageTolerance, amountOut).raw).toStrictEqual(expected.raw)
    })

    it('fails if slippage tolernace is less than 0', async function() {
      const slippageTolerance = parsePercentage(-0.1)
      const amountOut = parseWei(1, 18)
      expect(() => SwapManager.minimumAmountOut(slippageTolerance, amountOut).raw).toThrow()
    })
  })
})
