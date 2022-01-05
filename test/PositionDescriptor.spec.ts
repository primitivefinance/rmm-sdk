import { PositionDescriptorManager } from '../src/positionDescriptorManager'
import { ContractFactory } from 'ethers'

describe('PositionDescriptorManager', function() {
  describe('#getFactory', function() {
    it('getFactory returns the ethers factory', async function() {
      expect(PositionDescriptorManager.getFactory()).toStrictEqual(
        new ContractFactory(PositionDescriptorManager.INTERFACE, PositionDescriptorManager.BYTECODE)
      )
    })
  })
})
