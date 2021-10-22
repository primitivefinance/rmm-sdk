import { utils, BigNumber } from 'ethers'
import { Token } from '@uniswap/sdk-core'
import { callDelta, callPremium } from '@primitivefinance/v2-math'
import { parseWei, Percentage, Time, Wei, parsePercentage } from 'web3-units'
import { Engine } from './engine'
const { keccak256, solidityPack } = utils

/**
 * @notice Calibration Struct; Class representation of each Curve's parameters
 */
export class Calibration extends Engine {
  /**
   * @notice Used to calculate minimum liquidity based on lowest decimals of risky/stable
   */
  public static readonly MIN_LIQUIDITY_FACTOR = 6
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
   * @notice Time until expiry is calculated from the difference of current timestamp and this
   */
  public readonly lastTimestamp: Time
  /**
   * @notice Timestamp of tx which created the pool
   */
  public readonly creationTimestamp: Time
  /**
   * @notice Price of risky token denominated in stable tokens, with the precision of the stable tokens
   */
  public spot: Wei

  /**
   *
   * @param strike Strike price as a float with precision equal to stable token decimals
   * @param sigma Volatility percentage as a float, e.g. 1 = 100%
   * @param maturity Timestamp in seconds
   * @param lastTimestamp Timestamp in seconds
   * @param spot Value of risky asset in units of stable asset
   */
  constructor(
    factory: string,
    risky: Token,
    stable: Token,
    strike: number,
    sigma: number,
    maturity: number,
    lastTimestamp: number,
    creationTimestamp: number,
    spot?: number
  ) {
    super(factory, risky, stable)
    this.strike = parseWei(strike, stable.decimals)
    this.sigma = parsePercentage(sigma)
    this.maturity = new Time(maturity) // in seconds, because `block.timestamp` is in seconds
    this.lastTimestamp = new Time(lastTimestamp) // in seconds, because `block.timestamp` is in seconds
    this.creationTimestamp = new Time(creationTimestamp)
    this.spot = spot ? parseWei(spot, stable.decimals) : parseWei(0, stable.decimals)
  }

  /**
   * @notice Minimum amount of liquidity to supply on calling `create()`
   */
  get MIN_LIQUIDITY(): number {
    return (
      (this.stable.decimals > this.risky.decimals ? this.risky.decimals : this.stable.decimals) /
      Calibration.MIN_LIQUIDITY_FACTOR
    )
  }

  /**
   * @returns Time until expiry in seconds
   */
  get tau(): Time {
    return this.maturity.sub(this.lastTimestamp)
  }

  /**
   * @returns Total lifetime of a pool in seconds
   */
  get lifetime(): Time {
    return this.maturity.sub(this.creationTimestamp)
  }

  /**
   * @returns Total lifetime of a pool in seconds
   */
  get remaining(): Time {
    const now = this.maturity.now
    if (now >= this.maturity.raw) return new Time(0)

    return this.maturity.sub(now)
  }

  /**
   * @returns expired if time until expiry is lte 0
   */
  get expired(): boolean {
    return this.remaining.raw <= 0
  }

  /**
   * @returns Change in pool premium wrt change in underlying spot price
   */
  get delta(): number {
    return this.spot ? callDelta(this.strike.float, this.sigma.float, this.tau.years, this.spot.float) : 0
  }

  /**
   * @returns Black-Scholes implied premium
   */
  get premium(): number {
    return this.spot ? callPremium(this.strike.float, this.sigma.float, this.tau.years, this.spot.float) : 0
  }

  /**
   * @returns Spot price is above strike price
   */
  get inTheMoney(): boolean {
    return this.spot ? this.strike.float >= this.spot.float : false
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
