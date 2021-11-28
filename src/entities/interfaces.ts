export interface CalibrationInterface {
  strike: string
  sigma: string
  maturity: string
  lastTimestamp: string
  gamma: string
}

/**
 * @notice Calling the `uri` function on the PrimitiveHouse contract returns this api
 */
export interface PoolInterface {
  name: string
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
