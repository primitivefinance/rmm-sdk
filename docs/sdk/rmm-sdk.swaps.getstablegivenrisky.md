<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@primitivefi/rmm-sdk](./rmm-sdk.md) &gt; [Swaps](./rmm-sdk.swaps.md) &gt; [getStableGivenRisky](./rmm-sdk.swaps.getstablegivenrisky.md)

## Swaps.getStableGivenRisky() method

> This API is provided as a preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.
> 

Gets estimated stable token reserves given risky token reserves, for 1 unit of liquidity.

<b>Signature:</b>

```typescript
static getStableGivenRisky(strikeFloating: number, sigmaFloating: number, tauYears: number, reserveRiskyFloating: number, invariantFloating?: number): number | undefined;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  strikeFloating | number | Strike price as a floating point number in decimal format. |
|  sigmaFloating | number | Implied volatility as a floating point number in decimal format. |
|  tauYears | number | Time until expiry in years. |
|  reserveRiskyFloating | number | Amount of risky tokens in reserve as a floating point decimal number. |
|  invariantFloating | number | Computed invariant of curve as a floating point decimal number. |

<b>Returns:</b>

number \| undefined
