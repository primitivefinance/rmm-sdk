import { utils, BigNumber } from 'ethers'
import { isAddress } from '@ethersproject/address'
import invariant from 'tiny-invariant'
import { Token } from '@uniswap/sdk-core'
import { Percentage, Time, Wei, toBN } from 'web3-units'

import { Engine } from './engine'
import { weiToWei } from '../utils'
const { keccak256, solidityPack } = utils

/**
 * @returns Keccak256 hash of a solidity packed array of engine address and calibration struct
 */
export function hashParametersForPoolId(
  engine: string,
  strike: string,
  sigma: string,
  maturity: string,
  gamma: string
): string {
  return keccak256(
    solidityPack(['address', 'uint128', 'uint32', 'uint32', 'uint32'], [engine, strike, sigma, maturity, gamma])
  )
}

export function isValidSigma(sigma: string): boolean {
  return parseFloat(sigma) <= Calibration.MAX_SIGMA && parseFloat(sigma) >= Calibration.MIN_SIGMA
}

export function isValidGamma(gamma: string): boolean {
  return parseFloat(gamma) <= Calibration.MAX_GAMMA && parseFloat(gamma) >= Calibration.MIN_GAMMA
}

export function isValidMaturity(maturity: string): boolean {
  return parseFloat(maturity) < 2e32 - 1 && parseFloat(maturity) > 0
}

export function isValidStrike(strike: string): boolean {
  return parseFloat(strike) < 2e128 - 1 && Math.floor(parseFloat(strike)) > 0
}

/**
 * @notice Constructs a Calibration entity from on-chain data
 * @param factory Address of the factory contract, used to compute Engine
 * @param risky ERC-20 token metadata and address of risky asset
 * @param stable ERC-20 token metadata and address of stable asset
 * @param cal On-chain data of calibration, converted to strings
 * @param chainId An optional chainId for the Token entity, defaults to 1
 */
export function parseCalibration(
  factory: string,
  risky: { address: string; decimals: string | number; name?: string; symbol?: string },
  stable: { address: string; decimals: string | number; name?: string; symbol?: string },
  cal: { strike: string; sigma: string; maturity: string; gamma: string; lastTimestamp?: string },
  chainId?: number
): Calibration {
  const token0 = new Token(chainId ?? 1, risky.address, +risky.decimals, risky?.symbol, risky?.name)
  const token1 = new Token(chainId ?? 1, stable.address, +stable.decimals, stable?.symbol, stable?.name)
  return new Calibration(factory, token0, token1, cal.strike, cal.sigma, cal.maturity, cal.gamma)
}

/**
 * @notice Calibration Struct; Class representation of each Curve's parameters
 * @dev    Can be stateless and used to compute poolId of arbitrary parameters
 */
export class Calibration extends Engine {
  /**
   * @notice Minimum sigma value inclusive, equal to 1 basis point, or 0.01%
   */
  static readonly MIN_SIGMA = 1
  /**
   * @notice Maximum sigma value inclusive, equal to 10_000_000 basis points, or 1_000.00%
   */
  static readonly MAX_SIGMA = Percentage.BasisPoints * 1e3
  /**
   * @notice Minimum gamma value inclusive, equal to 9000 basis points, or 90.00%
   */
  static readonly MIN_GAMMA = Percentage.BasisPoints - 1e3
  /**
   * @notice Maximum gamma value inclusive, equal to 9999 basis points, or 99.99%
   */
  static readonly MAX_GAMMA = Percentage.BasisPoints - 1

  /**
   * @notice Strike price with the same precision as the stable asset
   */
  public readonly strike: Wei
  /**
   * @notice Volatility as a Percentage instance with 4 precision
   */
  public readonly sigma: Percentage
  /**
   * @notice Time class with a raw value in seconds
   */
  public readonly maturity: Time
  /**
   * @notice Gamma, equal to 1 - fee %, as a Percentage instance with 4 precision
   */
  public readonly gamma: Percentage

  /**
   * @param factory Address of the factory contract, used to compute Engine address, which is used to compute poolId
   * @param strike Strike price, returned from a smart contract or calibration.strike.toString()
   * @param sigma Implied volatility in basis points, returned from a smart contract or calibration.sigma.toString()
   * @param maturity Timestamp of expiry, in seconds
   * @param gamma Basis points multiplier less than 10_000 to apply a fee on swaps, e.g. 1% fee = 9900 gamma
   */
  constructor(
    factory: string,
    risky: Token,
    stable: Token,
    strike: string,
    sigma: string,
    maturity: string,
    gamma: string
  ) {
    super(factory, risky, stable)
    invariant(isValidStrike(strike), `Strike must be an integer in units of wei: ${strike}`)
    invariant(
      isValidSigma(sigma),
      `Sigma Error: Implied volatility outside of bounds 1-10_000_000 basis points: ${sigma}`
    )
    invariant(isValidMaturity(maturity), `Maturity out of bounds > 0 && < 2^32 -1: ${maturity}`)
    invariant(isValidGamma(gamma), `Gamma Error: Fee outside of bounds 1-9_9999 basis points: ${gamma}`)

    this.strike = weiToWei(strike, stable.decimals)
    this.sigma = new Percentage(toBN(sigma))
    this.maturity = new Time(parseFloat(maturity))
    this.gamma = new Percentage(toBN(gamma))
  }

  /**
   * @notice Keccak256 hash of the calibration parameters and the engine address
   */
  get poolId(): string {
    return Calibration.computePoolId(this.address, this.strike.raw, this.sigma.raw, this.maturity.raw, this.gamma.raw)
  }

  /**
   * @notice Computes deterministic poolIds from hashing calibration parameters, throws on invalid parameter
   */
  public static computePoolId(
    engine: string,
    strike: string | BigNumber,
    sigma: string | BigNumber,
    maturity: string | number,
    gamma: string | BigNumber
  ): string {
    strike = typeof strike !== 'string' ? strike.toString() : strike
    sigma = typeof sigma !== 'string' ? sigma.toString() : sigma
    maturity = typeof maturity !== 'string' ? maturity.toString() : maturity
    gamma = typeof gamma !== 'string' ? gamma.toString() : gamma
    invariant(isAddress(engine), 'Invalid address when computing pool id')
    invariant(isValidStrike(strike), `Strike must be an integer in units of wei: ${strike}`)
    invariant(
      isValidSigma(sigma),
      `Sigma Error: Implied volatility outside of bounds 1-10_000_000 basis points: ${sigma}`
    )
    invariant(isValidMaturity(maturity), `Maturity out of bounds > 0 && < 2^32 -1: ${maturity}`)
    invariant(isValidGamma(gamma), `Gamma Error: Fee outside of bounds 1-9_9999 basis points: ${gamma}`)
    return hashParametersForPoolId(engine, strike, sigma, maturity, gamma)
  }
}
