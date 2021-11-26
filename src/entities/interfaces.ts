/**
 * @notice Calling the `uri` function on the PrimitiveHouse contract returns this api
 */
export interface PoolInterface {
  name: string
  image: string
  license: string
  creator: string
  description: string
  properties: {
    risky: string
    stable: string
    invariant: string
    calibration: {
      strike: string
      sigma: string
      maturity: string
      lastTimestamp: string
      gamma: string
    }
    reserve: {
      blockTimestamp: string
      cumulativeLiquidity: string
      cumulativeRisky: string
      cumulativeStable: string
      liquidity: string
      reserveRisky: string
      reserveStable: string
    }
  }
}
