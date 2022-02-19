import { BigNumber } from '@ethersproject/bignumber'
import invariant from 'tiny-invariant'
import { Token } from '@uniswap/sdk-core'
import { Percentage, Time, Wei, toBN } from 'web3-units'

import { weiToWei, computePoolId } from '../utils'
import { Engine } from './engine'

/**
 * Checks `sigma` is within the valid smart contract range.
 *
 * @param sigma Implied volatility in basis points.
 *
 * @returns true if within bounds of valid sigmas.
 *
 * @beta
 */
export function isValidSigma(sigma: string): boolean {
  return parseFloat(sigma) <= Calibration.MAX_SIGMA && parseFloat(sigma) >= Calibration.MIN_SIGMA
}

/**
 * Checks `gamma` is within the valid smart contract range.
 *
 * @param gamma 10_000 - swap fee, in basis points.
 *
 * @returns true if within bounds of valid gammas.
 */
export function isValidGamma(gamma: string): boolean {
  return parseFloat(gamma) <= Calibration.MAX_GAMMA && parseFloat(gamma) >= Calibration.MIN_GAMMA
}

/**
 * Checks `maturity` is within the valid smart contract range.
 *
 * @param maturity Expiration timestamp in seconds.
 *
 * @returns true if within bounds of valid maturities.
 */
export function isValidMaturity(maturity: string): boolean {
  return parseFloat(maturity) < 2e32 - 1 && parseFloat(maturity) > 0
}

/**
 * Checks `strike` is within the valid smart contract range.
 *
 * @param strike Strike price in wei with decimal places equal the Engine's stable token decimals.
 *
 * @returns true if within bounds of valid strikes.
 */
export function isValidStrike(strike: string): boolean {
  return parseFloat(strike) < 2e128 - 1 && Math.floor(parseFloat(strike)) > 0
}

/**
 * Calibration Struct; Class representation of each Curve's parameters.
 *
 * @remarks
 * Can be stateless and used to compute poolId of arbitrary parameters.
 */
export interface ICalibration {
  /** Strike price with the same precision as the stable asset. */
  readonly strike: Wei

  /** Volatility as a Percentage instance with 4 precision. */
  readonly sigma: Percentage

  /** Time class with a raw value in seconds. */
  readonly maturity: Time

  /** Gamma, equal to 1 - fee %, as a Percentage instance with 4 precision. */
  readonly gamma: Percentage

  /** {@inheritdoc computePoolId} */
  poolId: string
}

/**
 * Calibration base class implements {@link ICalibration}
 *
 * @beta
 */
export class Calibration extends Engine implements ICalibration {
  /** Minimum sigma value inclusive, equal to 1 basis point, or 0.01%. */
  static readonly MIN_SIGMA = 1
  /** Maximum sigma value inclusive, equal to 10_000_000 basis points, or 1_000.00%. */
  static readonly MAX_SIGMA = Percentage.BasisPoints * 1e3
  /** Minimum gamma value inclusive, equal to 9000 basis points, or 90.00%. */
  static readonly MIN_GAMMA = Percentage.BasisPoints - 1e3
  /** Maximum gamma value inclusive, equal to 10_000 basis points, or 100%. */
  static readonly MAX_GAMMA = Percentage.BasisPoints

  /** {@inheritdoc ICalibration.strike} */
  public readonly strike: Wei
  /** {@inheritdoc ICalibration.sigma} */
  public readonly sigma: Percentage
  /** {@inheritdoc ICalibration.maturity} */
  public readonly maturity: Time
  /** {@inheritdoc ICalibration.gamma} */
  public readonly gamma: Percentage

  /**
   *
   * @throws
   * Throws invariant error if a calibration parameter is invalid
   *
   * @param factory Address of the factory contract, used to compute Engine address, which is used to compute poolId
   * @param strike Strike price, returned from a smart contract or calibration.strike.toString()
   * @param sigma Implied volatility in basis points, returned from a smart contract or calibration.sigma.toString()
   * @param maturity Timestamp of expiry, in seconds
   * @param gamma Basis points multiplier less than 10_000 to apply a fee on swaps, e.g. 1% fee = 9900 gamma
   *
   * @beta
   */
  constructor(
    factory: string,
    risky: Token,
    stable: Token,
    strike: string | BigNumber,
    sigma: string | BigNumber,
    maturity: string | BigNumber,
    gamma: string | BigNumber
  ) {
    super(factory, risky, stable)
    strike = typeof strike !== 'string' ? strike.toString() : strike
    sigma = typeof sigma !== 'string' ? sigma.toString() : sigma
    maturity = typeof maturity !== 'string' ? maturity.toString() : maturity
    gamma = typeof gamma !== 'string' ? gamma.toString() : gamma
    invariant(isValidStrike(strike), `Strike must be an integer in units of wei: ${strike}`)
    invariant(
      isValidSigma(sigma),
      `Sigma Error: Implied volatility outside of bounds 1-10_000_000 basis points: ${sigma}`
    )
    invariant(isValidMaturity(maturity), `Maturity out of bounds > 0 && < 2^32 -1: ${maturity}`)
    invariant(isValidGamma(gamma), `Gamma Error: Outside of bounds (9_000, 10_000): ${gamma}`)

    this.strike = weiToWei(strike, stable.decimals)
    this.sigma = new Percentage(toBN(sigma))
    this.maturity = new Time(parseFloat(maturity))
    this.gamma = new Percentage(toBN(gamma))
  }

  /** {@inheritdoc ICalibration.poolId} */
  get poolId(): string {
    return computePoolId(
      this.address,
      this.strike.toString(),
      this.sigma.toString(),
      this.maturity.toString(),
      this.gamma.toString()
    )
  }
}
