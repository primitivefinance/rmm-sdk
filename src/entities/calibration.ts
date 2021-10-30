import { utils, BigNumber } from 'ethers'
import { Token } from '@uniswap/sdk-core'
import { parseWei, Percentage, Time, Wei, parsePercentage } from 'web3-units'
import { Engine } from './engine'
import invariant from 'tiny-invariant'
const { keccak256, solidityPack } = utils

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
   * @param strike Strike price as a float with precision equal to stable token decimals
   * @param sigma Volatility percentage as a float, e.g. 1 = 100%
   * @param maturity Timestamp in seconds
   * @param gamma 1 - fee, as a float
   */
  constructor(
    factory: string,
    risky: Token,
    stable: Token,
    strike: number,
    sigma: number,
    maturity: number,
    gamma: number
  ) {
    super(factory, risky, stable)
    invariant(sigma <= 1000 && sigma >= 0.01, 'Sigma Error: Implied volatility outside of bounds')
    invariant(gamma < 1 && gamma > 0, 'Gamma Error: Fee outside of bounds')
    this.strike = parseWei(strike, stable.decimals)
    this.sigma = parsePercentage(sigma)
    this.maturity = new Time(maturity) // in seconds, because `block.timestamp` is in seconds
    this.gamma = parsePercentage(gamma)
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
