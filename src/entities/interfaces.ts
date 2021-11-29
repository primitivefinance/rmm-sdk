/**
 * @notice Representing the Primitive Engine calibration struct which defines a pool's curve
 * @param strike Raw wei value of strike price
 * @param sigma Implied volatility in basis points
 * @param maturity UNIX timestamp in seconds of expiration
 * @param lastTimestamp Timestamp logged on last time a state update on reserves occurred
 * @param gamma Equal to 10_000 basis points less the fee, in basis points, e.g. 10_000 - 100 = 9_900
 */
export interface CalibrationInterface {
  strike: string
  sigma: string
  maturity: string
  lastTimestamp?: string
  gamma: string
}

/**
 * @notice Calling the `uri` function on the PrimitiveHouse contract returns this api
 * @param name Title of token
 * @param symbol Token simplified into an identifiable symbol
 * @param image Encoded image or link to an image file
 * @param license License on the token info or image
 * @param creator  Canonical deployer of the contract
 * @param description Brief explanation of the data or token
 * @param properties All meta-data related to the Primitive Engine's pool for this token id
 */
export interface PoolInterface {
  name?: string
  symbol?: string
  image?: string
  license?: string
  creator?: string
  description?: string
  properties: {
    factory: string
    risky: {
      address: string
      decimals: string | number
      symbol?: string
      name?: string
    }
    stable: {
      address: string
      decimals: string | number
      symbol?: string
      name?: string
    }
    invariant?: string
    calibration: {
      strike: string
      sigma: string
      maturity: string
      lastTimestamp?: string
      gamma: string
    }
    reserve: {
      blockTimestamp?: string
      cumulativeLiquidity?: string
      cumulativeRisky?: string
      cumulativeStable?: string
      liquidity: string
      reserveRisky: string
      reserveStable: string
    }
  }
}
