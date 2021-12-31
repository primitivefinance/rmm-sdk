/**
 * Data structure of the Primitive Engine Calibration struct, which is used for Pool curves.
 *
 * @beta
 */
export interface CalibrationStruct {
  /** {@inheritdoc ICalibration.strike} */
  strike: string

  /** {@inheritdoc ICalibration.sigma} */
  sigma: string

  /** {@inheritdoc ICalibration.maturity} */
  maturity: string

  /** {@inheritdoc ICalibration.lastTimestamp} */
  lastTimestamp: string

  /** {@inheritdoc ICalibration.gamma} */
  gamma: string
}

/**
 * Data structure of the Primitive Engine Reserve struct, which is used tracking tokens in Pool.
 *
 * @beta
 */
export interface ReserveStruct {
  /** Blocktimestamp of the previous block which updated cumulative reserves. */
  blockTimestamp?: string

  /** Cumulative sum of liquidity. */
  cumulativeLiquidity?: string

  /** Cumulative sum of risky token reserves. */
  cumulativeRisky?: string

  /** Cumulative sum of stable token reserves. */
  cumulativeStable?: string

  /** {@inheritdoc IPool.liquidity} */
  liquidity: string

  /** {@inheritdoc IPool.reserveRisky} */
  reserveRisky: string

  /** {@inheritdoc IPool.reserveStable} */
  reserveStable: string
}

/**
 * Data structure of PrimitiveManager ERC-1155 Uniform Resource Identifier ("URI").
 *
 * @remarks
 * Calling the PrimitiveManager.uri(poolId) function returns encoded json of this data.
 *
 * @beta
 */
export interface PoolInterface {
  /** Title of token. */
  name?: string

  /** Token simplified into an identifiable symbol. */
  symbol?: string

  /** Base64 encoded image or link to an image file. */
  image?: string

  /** License on the token info or image. */
  license?: string

  /** Canonical deployer of the contract. */
  creator?: string

  /** Brief explanation of the data or token. */
  description?: string

  /** All meta-data related to the Primitive Engine's pool for this token id. */
  properties: {
    /** {@inheritdoc IEngine.factory} */
    factory: string

    /** {@inheritdoc IEngine.risky} */
    risky: {
      address: string
      decimals: string | number
      symbol?: string
      name?: string
    }

    /** {@inheritdoc IEngine.stable} */
    stable: {
      address: string
      decimals: string | number
      symbol?: string
      name?: string
    }

    /** {@inheritdoc IPool.invariant} */
    invariant?: string

    /** {@inheritdoc CalibrationStruct} */
    calibration: {
      strike: string
      sigma: string
      maturity: string
      lastTimestamp: string
      gamma: string
    }

    /** {@inheritdoc ReserveStruct} */
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
