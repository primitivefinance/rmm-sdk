import { Token } from '@uniswap/sdk-core'
import { Calibration } from '../entities/calibration'

/**
 * Constructs a Calibration entity from on-chain data.
 *
 * @remarks
 * Designed to work easily with `PrimitiveManager.uri(poolId)`.
 *
 * @param factory Address of the factory contract, used to compute Engine.
 * @param risky ERC-20 token metadata and address of risky asset.
 * @param stable ERC-20 token metadata and address of stable asset.
 * @param cal On-chain data of calibration, converted to strings.
 * @param chainId An optional chainId for the Token entity, defaults to 1.
 *
 * @returns calibration entity of the parameters.
 *
 * @beta
 */
export function parseCalibration(
  factory: string,
  risky: { address: string; decimals: string | number; name?: string; symbol?: string },
  stable: { address: string; decimals: string | number; name?: string; symbol?: string },
  cal: { strike: string; sigma: string; maturity: string; gamma: string; lastTimestamp?: string },
  chainId?: number
): Calibration {
  const token0 = new Token(chainId ?? 1, risky.address, +risky.decimals, risky?.symbol, risky?.name)
  const token1 = new Token(chainId ?? 1, stable.address, +stable.decimals, stable?.symbol, stable?.name)
  return new Calibration(factory, token0, token1, cal.strike, cal.sigma, cal.maturity, cal.gamma)
}
