<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@primitivefi/rmm-sdk](./rmm-sdk.md) &gt; [Swaps](./rmm-sdk.swaps.md) &gt; [getMarginalPriceSwapRiskyIn](./rmm-sdk.swaps.getmarginalpriceswapriskyin.md)

## Swaps.getMarginalPriceSwapRiskyIn() method

> This API is provided as a preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.
> 

Gets marginal price after an exact trade in of the risky asset with size `amountIn`<!-- -->.

[https://arxiv.org/pdf/2012.08040.pdf](https://arxiv.org/pdf/2012.08040.pdf)

<b>Signature:</b>

```typescript
static getMarginalPriceSwapRiskyIn(reserveRiskyFloating: number, strikeFloating: number, sigmaFloating: number, tauYears: number, gammaFloating: number, amountIn: number): number;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  reserveRiskyFloating | number | Amount of risky tokens in reserve as a floating point decimal number. |
|  strikeFloating | number | Strike price as a floating point number in decimal format. |
|  sigmaFloating | number | Implied volatility as a floating point number in decimal format. |
|  tauYears | number | Time until expiry in years. |
|  gammaFloating | number | Equal to 10\_000 - fee, in basis points as a floating point number in decimal format. |
|  amountIn | number | Amount of risky token to add to risky reserve. |

<b>Returns:</b>

number

