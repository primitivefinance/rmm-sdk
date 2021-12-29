import { BigNumber } from 'ethers'
import { toBN } from 'web3-units'
import { normalize } from '../utils'

const MAX_UINT_256 = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'

/**
 * @notice Floating point Decimal numbers are used to calculate values for RMM pools.
 *
 * However, sometimes the result of these math operations can return a value
 * that has more decimal places than the token which the amount represents the value of.
 *
 * Higher decimal values on lower decimal tokens will truncate the amount
 * once it reaches on-chain. This is because truncation is used in computing when
 * division is done with integers (e.g. in the EVM) and the answer must be an integer.
 *
 * This class is aware of this and will truncate after any math operation.
 */
export class Floating {
  static readonly INFINITY = BigNumber.from(MAX_UINT_256)
  static readonly ZERO = Floating.from(0)
  static readonly HALF = Floating.from(0.5)
  static readonly ONE = Floating.from(1)

  readonly _raw: number
  readonly decimals: number

  static from(value: number, decimals = 18): Floating {
    return new Floating(value, decimals)
  }

  private constructor(value: number, decimals: number) {
    this._raw = value
    this.decimals = decimals
  }

  get isZero(): boolean {
    return toBN(this.scaled).isZero()
  }

  get isInfinity(): boolean {
    return toBN(this.scaled).gte(Floating.INFINITY)
  }

  get raw(): number {
    return this._raw
  }

  /**
   * @notice Truncated to this decimal places
   */
  get normalized(): number {
    return normalize(this._raw, this.decimals)
  }

  /**
   * @notice Scalar value to multiply numbers before math operations
   */
  get scaleFactor(): number {
    return Math.pow(10, this.decimals)
  }

  /**
   * @notice Raw value scaled by scale factor and floored
   */
  get scaled(): number {
    return this.upscaleInteger(this._raw)
  }

  /**
   * @notice Multiplies `value` by this scale factor and floors it
   */
  upscaleInteger(value: number): number {
    return Math.floor(value * this.scaleFactor)
  }

  /**
   * @notice Divides `value` by this scale factor and truncates it to this decimals
   */
  downscaleInteger(value: number): number {
    return normalize(value / this.scaleFactor, this.decimals)
  }

  toString(): string {
    return this._raw.toString()
  }

  toFixed(decimals: number): string {
    return this.normalized.toFixed(decimals)
  }

  /**
   * @notice Scales up, adds scaled values, downscales back
   */
  add(adder: number | Floating): Floating {
    const scaled = adder instanceof Floating ? adder.scaled : this.upscaleInteger(adder)
    const x = scaled + this.scaled
    return new Floating(this.downscaleInteger(x), this.decimals)
  }

  /**
   * @dev Scales up, subtracts scaled values, downscales back
   */
  sub(subtractor: number | Floating): Floating {
    const scaled = subtractor instanceof Floating ? subtractor.scaled : this.upscaleInteger(subtractor)
    const x = this.scaled - scaled
    return new Floating(this.downscaleInteger(x), this.decimals)
  }

  /**
   * @notice Multiplies scaled multiplier and this value, downscales back
   */
  mul(multiplier: number | Floating): Floating {
    const scaled = multiplier instanceof Floating ? multiplier.scaled : this.upscaleInteger(multiplier)
    const numerator = Math.floor(this.scaled * scaled)
    const denominator = this.scaleFactor
    return new Floating(this.downscaleInteger(numerator / denominator), this.decimals)
  }

  /**
   * @notice Multiplies scaled multiplier and this value, divides by scaled divider, downscales back
   */
  mulDiv(multiplier: number | Floating, divider: number | Floating): Floating {
    const scaled = multiplier instanceof Floating ? multiplier.scaled : this.upscaleInteger(multiplier)
    const numerator = Math.floor(this.scaled * scaled)
    const denominator = divider instanceof Floating ? divider.scaled : this.upscaleInteger(divider)
    return new Floating(this.downscaleInteger(numerator / denominator), this.decimals)
  }

  /**
   * @notice Divides this scaled by scaled divider
   */
  div(divider: number | Floating): Floating {
    const numerator = this.scaled
    const denominator = divider instanceof Floating ? divider.scaled : this.upscaleInteger(divider)
    return new Floating(numerator / denominator, this.decimals)
  }

  divCeil(divider: number | Floating): Floating {
    const numerator = this.scaled
    const denominator = divider instanceof Floating ? divider.scaled : this.upscaleInteger(divider)
    return new Floating(numerator + (+divider?.toString() - 1) / denominator, this.decimals)
  }
}
