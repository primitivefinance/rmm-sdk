<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@primitivefi/rmm-sdk](./rmm-sdk.md) &gt; [Swaps](./rmm-sdk.swaps.md)

## Swaps class

Static functions to compute swap in/out amounts and marginal prices.

<b>Signature:</b>

```typescript
export declare class Swaps 
```

## Methods

|  Method | Modifiers | Description |
|  --- | --- | --- |
|  [exactRiskyInput(amountIn, decimalsRisky, decimalsStable, reserveRiskyFloating, reserveStableFloating, reserveLiquidityFloating, strikeFloating, sigmaFloating, gammaFloating, tauYears)](./rmm-sdk.swaps.exactriskyinput.md) | <code>static</code> | <b><i>(BETA)</i></b> Gets output amount of stable tokens given an exact amount of risky tokens in.[https://github.com/primitivefinance/rmms-py](https://github.com/primitivefinance/rmms-py) |
|  [exactRiskyOutput(amountOut, decimalsRisky, decimalsStable, reserveRiskyFloating, reserveStableFloating, reserveLiquidityFloating, strikeFloating, sigmaFloating, gammaFloating, tauYears)](./rmm-sdk.swaps.exactriskyoutput.md) | <code>static</code> | <b><i>(BETA)</i></b> Gets input amount of stable tokens given an exact amount of risky tokens out.[https://github.com/primitivefinance/rmms-py](https://github.com/primitivefinance/rmms-py) |
|  [exactStableInput(amountIn, decimalsRisky, decimalsStable, reserveRiskyFloating, reserveStableFloating, reserveLiquidityFloating, strikeFloating, sigmaFloating, gammaFloating, tauYears)](./rmm-sdk.swaps.exactstableinput.md) | <code>static</code> | <b><i>(BETA)</i></b> Gets output amount of risky tokens given an exact amount of stable tokens in.[https://github.com/primitivefinance/rmms-py](https://github.com/primitivefinance/rmms-py) |
|  [exactStableOutput(amountOut, decimalsRisky, decimalsStable, reserveRiskyFloating, reserveStableFloating, reserveLiquidityFloating, strikeFloating, sigmaFloating, gammaFloating, tauYears)](./rmm-sdk.swaps.exactstableoutput.md) | <code>static</code> | <b><i>(BETA)</i></b> Gets input amount of risky tokens given an exact amount of stable tokens out.[https://github.com/primitivefinance/rmms-py](https://github.com/primitivefinance/rmms-py) |
|  [getMarginalPriceSwapRiskyIn(reserveRiskyFloating, strikeFloating, sigmaFloating, tauYears, gammaFloating, amountIn)](./rmm-sdk.swaps.getmarginalpriceswapriskyin.md) | <code>static</code> | <b><i>(BETA)</i></b> Gets marginal price after an exact trade in of the risky asset with size <code>amountIn</code>.[https://arxiv.org/pdf/2012.08040.pdf](https://arxiv.org/pdf/2012.08040.pdf) |
|  [getMarginalPriceSwapStableIn(invariantFloating, reserveStableFloating, strikeFloating, sigmaFloating, tauYears, gammaFloating, amountIn)](./rmm-sdk.swaps.getmarginalpriceswapstablein.md) | <code>static</code> | <b><i>(BETA)</i></b> Gets marginal price after an exact trade in of the stable asset with size <code>amountIn</code>.[https://arxiv.org/pdf/2012.08040.pdf](https://arxiv.org/pdf/2012.08040.pdf) |
|  [getReportedPriceOfRisky(reserveRiskyFloating, strikeFloating, sigmaFloating, tauYears)](./rmm-sdk.swaps.getreportedpriceofrisky.md) | <code>static</code> | Gets price of risky token denominated in stable token. |
|  [getRiskyGivenStable(strikeFloating, sigmaFloating, tauYears, reserveStableFloating, invariantFloating)](./rmm-sdk.swaps.getriskygivenstable.md) | <code>static</code> | <b><i>(BETA)</i></b> Gets risky reserves given stable reserves, for 1 unit of liquidity. |
|  [getRiskyReservesGivenReferencePrice(strikeFloating, sigmaFloating, tauYears, referencePriceOfRisky)](./rmm-sdk.swaps.getriskyreservesgivenreferenceprice.md) | <code>static</code> | <b><i>(BETA)</i></b> Gets estimated risky token reserves given a reference price of the risky asset, for 1 unit of liquidity. |
|  [getStableGivenRisky(strikeFloating, sigmaFloating, tauYears, reserveRiskyFloating, invariantFloating)](./rmm-sdk.swaps.getstablegivenrisky.md) | <code>static</code> | <b><i>(BETA)</i></b> Gets estimated stable token reserves given risky token reserves, for 1 unit of liquidity. |

