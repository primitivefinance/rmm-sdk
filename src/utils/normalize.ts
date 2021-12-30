/**
 * Truncates `wad` to appropriate decimals then converts to a floating point number.
 *
 * @param wad Value to truncate.
 * @param decimals Point of truncation.
 *
 * @beta
 */
export function normalize(wad: number, decimals: number): number {
  const x = Math.trunc(wad * 10 ** decimals) / 10 ** decimals
  return x
}
