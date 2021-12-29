import { MaxUint256 } from '@ethersproject/constants'
import { toBN } from 'web3-units'
import { normalize } from '../utils'

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
  static readonly INFINITY = Floating.from(MaxUint256.toNumber())
  static readonly ZERO = Floating.from(0)
  static readonly HALF = Floating.from(0.5)
  static readonly ONE = Floating.from(1)

  readonly _raw: number
  readonly decimals: number

  static from(value: number, decimals = 18): Floating {
    return new Floating(value, decimals)
  }

  get isZero(): boolean {
    return toBN(this.scaled).isZero()
  }

  get isInfinity(): boolean {
    return toBN(this.scaled).eq(Floating.INFINITY.scaled)
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

  private constructor(value: number, decimals: number) {
    this._raw = value
    this.decimals = decimals
  }

  /**
   * @notice Scales up, adds scaled values, downscales back
   */
  add(adder: number): Floating {
    const x = this.upscaleInteger(adder) + this.scaled
    return new Floating(this.downscaleInteger(x), this.decimals)
  }

  /**
   * @dev Scales up, subtracts scaled values, downscales back
   */
  sub(subtractor: number): Floating {
    const x = this.scaled - this.upscaleInteger(subtractor)
    return new Floating(this.downscaleInteger(x), this.decimals)
  }

  /**
   * @notice Multiplies scaled multiplier and this value, divides by scaled divider, downscales back
   */
  mulDiv(multiplier: number, divider: number): Floating {
    const numerator = Math.floor(this.scaled * this.upscaleInteger(multiplier))
    const denominator = this.upscaleInteger(divider)
    return new Floating(this.downscaleInteger(numerator / denominator), this.decimals)
  }

  /**
   * @notice Divides this scaled by scaled divider
   */
  div(divider: number): Floating {
    const numerator = this.scaled
    const denominator = this.upscaleInteger(divider)
    return new Floating(this.downscaleInteger(numerator / denominator), this.decimals)
  }

  divCeil(divider: number): Floating {
    const numerator = this.scaled
    const denominator = this.upscaleInteger(divider)
    return new Floating(this.downscaleInteger(numerator + (divider - 1) / denominator), this.decimals)
  }
}
