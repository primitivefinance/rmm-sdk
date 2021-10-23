import { Pool } from '../src/entities/pool'
import { usePool } from './shared/fixture'
import { PeripheryManager } from '../src/peripheryManager'

describe('Periphery Manager', function() {
  let pool: Pool

  beforeEach(async function() {
    pool = usePool()
  })

  it('createCallParameters()', async function() {})

  it('depositCallParameters()', async function() {})

  it('encodeWithdraw()', async function() {})

  it('withdrawCallParameters()', async function() {})

  it('removeCallParameters()', async function() {})
})
