import { utils, BigNumber } from 'ethers'
import { Token } from '@uniswap/sdk-core'
import { parseWei, Percentage, Time, Wei, parsePercentage } from 'web3-units'
import { Engine } from './engine'
import invariant from 'tiny-invariant'
const { keccak256, solidityPack } = utils

/**
 * @notice Formats the number values into proper types for Calibration
 * @param factory Address of the PrimitiveFactory
 * @param risky A token entity for the Risky asset
 * @param stable A token entity for the Stable asset
 * @param strike Strike price as a float
 * @param sigma Implied volatility as a float
 * @param maturity Timestamp of expiry in seconds
 * @param gamma 1 - fee % of the pool as a float
 * @returns Calibration Entity instantiated with float values converted to proper types
 */
export function parseCalibration(
  factory: string,
  risky: Token,
  stable: Token,
  strike: number,
  sigma: number,
  maturity: number,
  gamma: number
): Calibration {
  let parsed: any = {
    strike: parseWei(strike, stable.decimals),
    sigma: parsePercentage(sigma),
    maturity: new Time(maturity), // in seconds, because `block.timestamp` is in seconds
    gamma: parsePercentage(gamma)
  }
  return new Calibration(factory, risky, stable, parsed.strike, parsed.sigma, parsed.maturity, parsed.gamma)
}

/**
 * @notice Calibration Struct; Class representation of each Curve's parameters
 */
export class Calibration extends Engine {
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
   *
   * @param strike Strike price as a `Wei` class with decimals the same as `stable.decimals`
   * @param sigma Implied Volatility as a `Percentage` class with a raw value scaled by 1e4
   * @param maturity Timestamp of expiry as a `Time` class, in seconds
   * @param gamma The 1 - fee % multiplier applied to input amounts on swaps as a `Percentage` class
   */
  constructor(
    factory: string,
    risky: Token,
    stable: Token,
    strike: Wei,
    sigma: Percentage,
    maturity: Time,
    gamma: Percentage
  ) {
    super(factory, risky, stable)
    invariant(sigma.float <= 1000 && sigma.float >= 0.01, 'Sigma Error: Implied volatility outside of bounds')
    invariant(gamma.float < 1 && gamma.float > 0, 'Gamma Error: Fee outside of bounds')
    this.strike = strike
    this.sigma = sigma
    this.maturity = maturity // in seconds, because `block.timestamp` is in seconds
    this.gamma = gamma
  }

  /**
   * @notice Keccak256 hash of the calibration parameters and the engine address
   */
  get poolId(): string {
    return Calibration.computePoolId(this.address, this.strike.raw, this.sigma.raw, this.maturity.raw, this.gamma.raw)
  }

  public static computePoolId(
    engine: string,
    strike: string | BigNumber,
    sigma: string | BigNumber,
    maturity: string | number,
    gamma: string | BigNumber
  ): string {
    return keccak256(
      solidityPack(['address', 'uint128', 'uint32', 'uint32', 'uint32'], [engine, strike, sigma, maturity, gamma])
    )
  }
}
