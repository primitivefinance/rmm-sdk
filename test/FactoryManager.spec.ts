import { Token } from '@uniswap/sdk-core'
import { FactoryManager } from '../src/factoryManager'
import { AddressZero } from '@ethersproject/constants'
import { AddressOne, AddressTwo } from './shared'

function decode(frag: string, data: any) {
  return FactoryManager.INTERFACE.decodeFunctionData(frag, data)
}

describe('FactoryManager', function() {
  let token0: Token, token1: Token, zeroToken: Token
  beforeEach(async function() {
    token0 = new Token(1, AddressOne, 18)
    token1 = new Token(1, AddressTwo, 18)
    zeroToken = new Token(1, AddressZero, 18)
  })

  describe('#encodeDeploy', function() {
    it('successful', async function() {
      const data = [token0.address, token1.address]
      const calldata = FactoryManager.encodeDeploy(data[0], data[1])
      const decoded = decode('deploy', calldata)
      data.forEach((item, i) => expect(item).toStrictEqual(decoded[i]))
    })

    it('fails with a risky token with address zero', async function() {
      expect(() => FactoryManager.encodeDeploy(zeroToken.address, token1.address)).toThrow()
    })

    it('fails with a stable token with address zero', async function() {
      expect(() => FactoryManager.encodeDeploy(token0.address, zeroToken.address)).toThrow()
    })

    it('fails with a risky and stable token that have the same address', async function() {
      expect(() => FactoryManager.encodeDeploy(token0.address, token0.address)).toThrow()
    })
  })
})
