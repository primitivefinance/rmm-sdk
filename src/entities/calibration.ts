import { utils, BigNumber } from 'ethers'
import { Token } from '@uniswap/sdk-core'
import { parseWei, Percentage, Time, Wei, parsePercentage } from 'web3-units'
import { Engine } from './engine'
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
   *
   * @param strike Strike price as a float with precision equal to stable token decimals
   * @param sigma Volatility percentage as a float, e.g. 1 = 100%
   * @param maturity Timestamp in seconds
   */
  constructor(factory: string, risky: Token, stable: Token, strike: number, sigma: number, maturity: number) {
    super(factory, risky, stable)
    this.strike = parseWei(strike, stable.decimals)
    this.sigma = parsePercentage(sigma)
    this.maturity = new Time(maturity) // in seconds, because `block.timestamp` is in seconds
  }

  /**
   * @notice Keccak256 hash of the calibration parameters and the engine address
   */
  get poolId(): string {
    return Calibration.computePoolId(this.address, this.strike.raw, this.sigma.raw, this.maturity.raw)
  }

  public static computePoolId(
    engine: string,
    strike: string | BigNumber,
    sigma: string | BigNumber,
    maturity: string | number
  ): string {
    return keccak256(solidityPack(['address', 'uint128', 'uint32', 'uint32'], [engine, strike, sigma, maturity]))
  }
}
