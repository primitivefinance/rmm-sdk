import { PositionRendererManager } from '../src/positionRendererManager'
import { ContractFactory } from 'ethers'

describe('PositionRendererManager', function() {
  describe('#getFactory', function() {
    it('successful', async function() {
      expect(PositionRendererManager.getFactory()).toStrictEqual(
        new ContractFactory(PositionRendererManager.INTERFACE, PositionRendererManager.BYTECODE)
      )
    })
  })
})
