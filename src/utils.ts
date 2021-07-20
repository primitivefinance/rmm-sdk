import bn from 'bignumber.js'
import fs from 'fs'

import { Token } from '../../../typechain'
import { utils, BytesLike, Contract } from 'ethers'
import { Provider } from '@ethersproject/abstract-provider'

// SDK Imports
import * as entities from './entities'
import { parseSetting, parsePosition, parseReserve, parseMargin } from './structs'
// Core Repository Imports
import { PrimitiveEngine, Token } from '../../../typechain'
import { abi as TokenAbi } from '../../../artifacts/contracts/test/Token.sol/Token.json'
import { abi as EngineAbi } from '../../../artifacts/contracts/PrimitiveEngine.sol/PrimitiveEngine.json'


export const getTokenEntityFromContract = async (token: Token): Promise<entities.Token> => {
  return new Token(
    (await token.provider.getNetwork()).chainId,
    token.address,
    await token.decimals(),
    await token.symbol(),
    await token.name()
  )
}

/// @notice Utility function to return the key of a one item array object
export function keyOf(object: Object) {
  return Object.keys(object)[0]
}


/**
 * @return Typechain PrimitiveEngine instance from an address
 */
export function getEngineContractFromAddress(
  engineAddress: string,
  signerOrProvider?: Provider | undefined
): PrimitiveEngine {
  return new Contract(engineAddress, EngineAbi, signerOrProvider) as unknown as PrimitiveEngine
}

/**
 * @return An Engine typescript class using an engine contract
 */
export async function getEngineEntityFromAddress(
  engineAddress: string,
  poolIds: BytesLike[],
  posIds: BytesLike[],
  owners: string[],
  signerOrProvider?: Provider | undefined
): Promise<entities.Engine> {
  const engine = getEngineContractFromAddress(engineAddress, signerOrProvider)
  const risky = new Contract(await engine.risky(), TokenAbi, engine.provider) as unknown as Token
  const stable = new Contract(await engine.stable(), TokenAbi, engine.provider) as unknown as Token

  let settings = {}
  await Promise.all(
    poolIds.map(async (poolId) => {
      let setting = await engine.settings(poolId)
      settings[poolId.toString()] = parseSetting(setting)
    })
  )

  let margins = {}
  await Promise.all(
    owners.map(async (owner) => {
      let margin = await engine.margins(owner)
      margins[owner] = parseMargin(margin)
    })
  )

  let reserves = {}
  await Promise.all(
    poolIds.map(async (poolId) => {
      let reserve = await engine.reserves(poolId)
      reserves[poolId.toString()] = parseReserve(reserve)
    })
  )

  let positions = {}
  await Promise.all(
    posIds.map(async (posId) => {
      let position = await engine.positions(posId)
      positions[posId.toString()] = parsePosition(position)
    })
  )

  const eng = new entities.Engine(await getTokenEntityFromContract(risky), await getTokenEntityFromContract(stable))
  await eng.init(settings, reserves, positions, margins)
  return eng
}