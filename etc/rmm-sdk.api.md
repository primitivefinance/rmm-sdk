## API Report File for "@primitivefi/rmm-sdk"

> Do not edit this file. It is a report generated by [API Extractor](https://api-extractor.com/).

```ts

import { BigNumber } from 'ethers';
import { FixedPointX64 } from 'web3-units';
import { Interface } from '@ethersproject/abi';
import { NativeCurrency } from '@uniswap/sdk-core';
import { Percentage } from 'web3-units';
import { Time } from 'web3-units';
import { Token } from '@uniswap/sdk-core';
import { Wei } from 'web3-units';

// @public (undocumented)
export interface AllocateOptions extends PermitTokens, LiquidityOptions, RecipientOptions, NativeOptions, Deadline {
    // (undocumented)
    createPool?: boolean;
    // (undocumented)
    fromMargin: boolean;
    // (undocumented)
    slippageTolerance: Percentage;
}

// @public (undocumented)
export interface AllowedPermitArguments {
    // (undocumented)
    expiry: BigNumber;
    // (undocumented)
    nonce: BigNumber;
    // (undocumented)
    r: string;
    // (undocumented)
    s: string;
    // (undocumented)
    v: 0 | 1 | 27 | 28;
}

// @public (undocumented)
export interface BatchTransferOptions {
    // (undocumented)
    amounts: Wei[];
    // (undocumented)
    data?: string;
    // (undocumented)
    ids: string[];
    // (undocumented)
    recipient: string;
    // (undocumented)
    sender: string;
}

// @public
export class Calibration extends Engine {
    constructor(factory: string, risky: Token, stable: Token, strike: string, sigma: string, maturity: string, gamma: string);
    static computePoolId(engine: string, strike: string | BigNumber, sigma: string | BigNumber, maturity: string | number, gamma: string | BigNumber): string;
    readonly gamma: Percentage;
    readonly maturity: Time;
    static readonly MAX_GAMMA: number;
    static readonly MAX_SIGMA: number;
    static readonly MIN_GAMMA: number;
    static readonly MIN_SIGMA = 1;
    get poolId(): string;
    readonly sigma: Percentage;
    readonly strike: Wei;
}

// @public
export interface CalibrationInterface {
    // (undocumented)
    gamma: string;
    // (undocumented)
    lastTimestamp?: string;
    // (undocumented)
    maturity: string;
    // (undocumented)
    sigma: string;
    // (undocumented)
    strike: string;
}

// @public (undocumented)
export function checkDecimals(amount: Wei, token: Token): void;

// @public (undocumented)
export interface Deadline {
    // (undocumented)
    deadline?: BigNumber;
}

// @public (undocumented)
export interface DefaultOptions {
    // (undocumented)
    deadline: BigNumber;
    // (undocumented)
    inputTokenPermit?: PermitOptions;
    // (undocumented)
    recipient: string;
    // (undocumented)
    slippageTolerance: Percentage;
}

// @public
export class Engine extends Token {
    constructor(factory: string, risky: Token, stable: Token);
    // (undocumented)
    static ABI: any;
    static readonly BUFFER: number;
    // (undocumented)
    static BYTECODE: string;
    static computeEngineAddress(factory: string, risky: string, stable: string, contractBytecode: string): string;
    readonly factory: string;
    // (undocumented)
    static INTERFACE: Interface;
    // (undocumented)
    involvesToken(token: Token): boolean;
    get MIN_LIQUIDITY(): number;
    static readonly MIN_LIQUIDITY_FACTOR = 6;
    static readonly PRECISION: Wei;
    readonly risky: Token;
    readonly scaleFactorRisky: Wei;
    readonly scaleFactorStable: Wei;
    readonly stable: Token;
}

// @public (undocumented)
export interface ExactInResult extends SwapResult {
    output: number;
}

// @public (undocumented)
export interface ExactOutResult extends SwapResult {
    input: number;
}

// @public
export class Floating {
    add(adder: number | Floating): Floating;
    // (undocumented)
    readonly decimals: number;
    div(divider: number | Floating): Floating;
    // (undocumented)
    divCeil(divider: number | Floating): Floating;
    downscaleInteger(value: number): number;
    // (undocumented)
    static from(value: number, decimals?: number): Floating;
    // (undocumented)
    static readonly HALF: Floating;
    // (undocumented)
    static readonly INFINITY: BigNumber;
    // (undocumented)
    get isInfinity(): boolean;
    // (undocumented)
    get isZero(): boolean;
    mul(multiplier: number | Floating): Floating;
    mulDiv(multiplier: number | Floating, divider: number | Floating): Floating;
    get normalized(): number;
    // (undocumented)
    static readonly ONE: Floating;
    // (undocumented)
    get raw(): number;
    // (undocumented)
    readonly _raw: number;
    get scaled(): number;
    get scaleFactor(): number;
    sub(subtractor: number | Floating): Floating;
    // (undocumented)
    toFixed(decimals: number): string;
    // (undocumented)
    toString(): string;
    upscaleInteger(value: number): number;
    // (undocumented)
    static readonly ZERO: Floating;
}

// @public (undocumented)
export function getTokenPairSaltHash(token0: string, token1: string): string;

// @public (undocumented)
export function hashParametersForPoolId(engine: string, strike: string, sigma: string, maturity: string, gamma: string): string;

// @public (undocumented)
export function isValidGamma(gamma: string): boolean;

// @public (undocumented)
export function isValidMaturity(maturity: string): boolean;

// @public (undocumented)
export function isValidSigma(sigma: string): boolean;

// @public (undocumented)
export function isValidStrike(strike: string): boolean;

// @public (undocumented)
export interface LiquidityOptions {
    // (undocumented)
    delLiquidity: Wei;
    // (undocumented)
    delRisky: Wei;
    // (undocumented)
    delStable: Wei;
}

// @public (undocumented)
export interface MarginOptions extends PermitTokens, RecipientOptions, NativeOptions {
    // (undocumented)
    amountRisky: Wei;
    // (undocumented)
    amountStable: Wei;
}

// @public
export interface MethodParameters {
    calldata: string;
    value: string;
}

// @public (undocumented)
export interface NativeOptions {
    // (undocumented)
    useNative?: NativeCurrency;
}

// @public
export function normalize(wad: number, decimals: number): number;

// @public
export function parseCalibration(factory: string, risky: {
    address: string;
    decimals: string | number;
    name?: string;
    symbol?: string;
}, stable: {
    address: string;
    decimals: string | number;
    name?: string;
    symbol?: string;
}, cal: {
    strike: string;
    sigma: string;
    maturity: string;
    gamma: string;
    lastTimestamp?: string;
}, chainId?: number): Calibration;

// @public (undocumented)
export abstract class PeripheryManager extends SelfPermit {
    // (undocumented)
    static ABI: any;
    // (undocumented)
    static allocateCallParameters(pool: Pool, options: AllocateOptions): MethodParameters;
    // (undocumented)
    static batchTransferFromParameters(options: BatchTransferOptions): MethodParameters;
    // (undocumented)
    static BYTECODE: string;
    // (undocumented)
    static createCallParameters(pool: Pool, liquidity: Wei, options?: PermitTokens): {
        calldata: string;
        value: string;
    };
    // (undocumented)
    static depositCallParameters(engine: Engine, options: MarginOptions): MethodParameters;
    // (undocumented)
    static encodeCreate(pool: Pool, liquidity: Wei): string;
    // (undocumented)
    static encodeWithdraw(engine: Engine, options: MarginOptions): string[];
    // (undocumented)
    static INTERFACE: Interface;
    // (undocumented)
    static removeCallParameters(pool: Pool, options: RemoveOptions): MethodParameters;
    // (undocumented)
    static safeTransferFromParameters(options: SafeTransferOptions): MethodParameters;
    // (undocumented)
    static withdrawCallParameters(engine: Engine, options: MarginOptions): MethodParameters;
}

// @public (undocumented)
export type PermitOptions = StandardPermitArguments | AllowedPermitArguments;

// @public (undocumented)
export interface PermitTokens {
    // (undocumented)
    permitRisky?: PermitOptions;
    // (undocumented)
    permitStable?: PermitOptions;
}

// @public
export class Pool extends Calibration {
    constructor(chainId: number, factory: string, risky: {
        address: string;
        decimals: string | number;
        name?: string;
        symbol?: string;
    }, stable: {
        address: string;
        decimals: string | number;
        name?: string;
        symbol?: string;
    }, calibration: {
        strike: string;
        sigma: string;
        maturity: string;
        gamma: string;
        lastTimestamp?: string;
    }, reserves: {
        reserveRisky: string;
        reserveStable: string;
        liquidity: string;
    }, invariant?: string, referencePriceOfRisky?: number);
    amountIn(tokenOut: Token, amountOut: number): ExactOutResult;
    amountOut(tokenIn: Token, amountIn: number): ExactInResult;
    // (undocumented)
    get delta(): number | undefined;
    derivativeOut(tokenIn: Token, amountIn: number): number;
    // (undocumented)
    get expired(): boolean;
    static from(pool: PoolInterface, referencePrice?: number, chainId?: number): Pool;
    static fromReferencePrice(referencePrice: number, factory: string, risky: {
        address: string;
        decimals: string | number;
        name?: string;
        symbol?: string;
    }, stable: {
        address: string;
        decimals: string | number;
        name?: string;
        symbol?: string;
    }, calibration: {
        strike: string;
        sigma: string;
        maturity: string;
        gamma: string;
        lastTimestamp?: string;
    }, chainId?: number, liquidity?: string, invariant?: number): Pool;
    getCurrentLiquidityValue(priceOfRisky: number, priceOfStable?: number): {
        valuePerLiquidity: Wei;
        values: Wei[];
    };
    static getLiquidityQuote(amount: Wei, sideOfPool: PoolSides, reserveRisky: Wei, reserveStable: Wei, liquidity: Wei): {
        delRisky: Wei;
        delStable: Wei;
        delLiquidity: Wei;
    };
    // (undocumented)
    get inTheMoney(): boolean | undefined;
    // (undocumented)
    readonly invariant: FixedPointX64;
    set lastTimestamp(x: Time);
    // (undocumented)
    get lastTimestamp(): Time;
    // (undocumented)
    readonly liquidity: Wei;
    liquidityQuote(amount: Wei, sideOfPool: PoolSides): {
        delRisky: Wei;
        delStable: Wei;
        delLiquidity: Wei;
    };
    // (undocumented)
    get premium(): number | undefined;
    set referencePriceOfRisky(x: Wei | undefined);
    get referencePriceOfRisky(): Wei | undefined;
    // (undocumented)
    get remaining(): Time;
    // (undocumented)
    get reportedPriceOfRisky(): Wei | undefined;
    // (undocumented)
    readonly reserveRisky: Wei;
    // (undocumented)
    readonly reserveStable: Wei;
    // (undocumented)
    get swapArgs(): readonly [number, number, number, number, number, number, number, number, number];
    // (undocumented)
    get tau(): Time;
}

// @public
export interface PoolInterface {
    // (undocumented)
    creator?: string;
    // (undocumented)
    description?: string;
    // (undocumented)
    image?: string;
    // (undocumented)
    license?: string;
    // (undocumented)
    name?: string;
    // (undocumented)
    properties: {
        factory: string;
        risky: {
            address: string;
            decimals: string | number;
            symbol?: string;
            name?: string;
        };
        stable: {
            address: string;
            decimals: string | number;
            symbol?: string;
            name?: string;
        };
        invariant?: string;
        calibration: {
            strike: string;
            sigma: string;
            maturity: string;
            lastTimestamp?: string;
            gamma: string;
        };
        reserve: {
            blockTimestamp?: string;
            cumulativeLiquidity?: string;
            cumulativeRisky?: string;
            cumulativeStable?: string;
            liquidity: string;
            reserveRisky: string;
            reserveStable: string;
        };
    };
    // (undocumented)
    symbol?: string;
}

// @public (undocumented)
export enum PoolSides {
    // (undocumented)
    RISKY = "RISKY",
    // (undocumented)
    RMM_LP = "RMM_LP",
    // (undocumented)
    STABLE = "STABLE"
}

// @public (undocumented)
export interface RecipientOptions {
    // (undocumented)
    recipient: string;
}

// @public (undocumented)
export interface RemoveOptions extends LiquidityOptions, RecipientOptions, NativeOptions, Deadline {
    // (undocumented)
    expectedRisky: Wei;
    // (undocumented)
    expectedStable: Wei;
    // (undocumented)
    slippageTolerance: Percentage;
    // (undocumented)
    toMargin: boolean;
}

// @public (undocumented)
export interface SafeTransferOptions {
    // (undocumented)
    amount: Wei;
    // (undocumented)
    data?: string;
    // (undocumented)
    id: string;
    // (undocumented)
    recipient: string;
    // (undocumented)
    sender: string;
}

// @public (undocumented)
export abstract class SelfPermit {
    protected constructor();
    // (undocumented)
    protected static encodePermit(token: Token, options: PermitOptions): string;
    // (undocumented)
    static INTERFACE: Interface;
}

// @public (undocumented)
export interface StandardPermitArguments {
    // (undocumented)
    amount: BigNumber;
    // (undocumented)
    deadline: BigNumber;
    // (undocumented)
    r: string;
    // (undocumented)
    s: string;
    // (undocumented)
    v: 0 | 1 | 27 | 28;
}

// @public (undocumented)
export abstract class SwapManager extends SelfPermit {
    // (undocumented)
    static ABI: any;
    // (undocumented)
    static BYTECODE: string;
    // (undocumented)
    static INTERFACE: Interface;
    static minimumAmountOut(slippageTolerance: Percentage, amountOut: Wei): Wei;
    // (undocumented)
    static swapCallParameters(pool: Pool, options: SwapOptions): MethodParameters;
}

// @public (undocumented)
export interface SwapOptions extends DefaultOptions, NativeOptions {
    // (undocumented)
    deltaIn: Wei;
    // (undocumented)
    deltaOut: Wei;
    // (undocumented)
    fromMargin: boolean;
    // (undocumented)
    riskyForStable: boolean;
    // (undocumented)
    toMargin: boolean;
    // (undocumented)
    toRecipient?: boolean;
}

// @public (undocumented)
export interface SwapResult {
    invariant: number;
    priceIn: string;
}

// @public
export class Swaps {
    static exactRiskyInput(amountIn: number, decimalsRisky: number, decimalsStable: number, reserveRiskyFloating: number, reserveStableFloating: number, reserveLiquidityFloating: number, strikeFloating: number, sigmaFloating: number, gammaFloating: number, tauYears: number): ExactInResult;
    static exactRiskyOutput(amountOut: number, decimalsRisky: number, decimalsStable: number, reserveRiskyFloating: number, reserveStableFloating: number, reserveLiquidityFloating: number, strikeFloating: number, sigmaFloating: number, gammaFloating: number, tauYears: number): ExactOutResult;
    static exactStableInput(amountIn: number, decimalsRisky: number, decimalsStable: number, reserveRiskyFloating: number, reserveStableFloating: number, reserveLiquidityFloating: number, strikeFloating: number, sigmaFloating: number, gammaFloating: number, tauYears: number): ExactInResult;
    static exactStableOutput(amountOut: number, decimalsRisky: number, decimalsStable: number, reserveRiskyFloating: number, reserveStableFloating: number, reserveLiquidityFloating: number, strikeFloating: number, sigmaFloating: number, gammaFloating: number, tauYears: number): ExactOutResult;
    static getMarginalPriceSwapRiskyIn(reserve0Floating: number, strikeFloating: number, sigmaFloating: number, tauYears: number, gammaFloating: number, amountIn: number): number;
    static getMarginalPriceSwapStableIn(invariantFloating: number, reserve1Floating: number, strikeFloating: number, sigmaFloating: number, tauYears: number, gammaFloating: number, amountIn: number): number;
    // (undocumented)
    static getReportedPriceOfRisky(balance0Floating: number, strikeFloating: number, sigmaFloating: number, tauYears: number): number;
    // (undocumented)
    static getRiskyGivenStable(strikeFloating: number, sigmaFloating: number, tauYears: number, reserveStableFloating: number, invariantFloating?: number): number | undefined;
    static getRiskyReservesGivenReferencePrice(strikeFloating: number, sigmaFloating: number, tauYears: number, referencePriceOfRisky: number): number;
    // (undocumented)
    static getStableGivenRisky(strikeFloating: number, sigmaFloating: number, tauYears: number, reserveRiskyFloating: number, invariantFloating?: number): number | undefined;
}

// @public
export function validateAndParseAddress(address: string): string;

// @public
export function weiToWei(wei: string, decimals?: number): Wei;

// (No @packageDocumentation comment for this package)

```