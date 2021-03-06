<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@primitivefi/rmm-sdk](./rmm-sdk.md) &gt; [Calibration](./rmm-sdk.calibration.md)

## Calibration class

> This API is provided as a preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.
> 

Calibration base class implements [ICalibration](./rmm-sdk.icalibration.md)

<b>Signature:</b>

```typescript
export declare class Calibration extends Engine implements ICalibration 
```
<b>Extends:</b> [Engine](./rmm-sdk.engine.md)

<b>Implements:</b> [ICalibration](./rmm-sdk.icalibration.md)

## Constructors

|  Constructor | Modifiers | Description |
|  --- | --- | --- |
|  [(constructor)(factory, risky, stable, strike, sigma, maturity, gamma)](./rmm-sdk.calibration._constructor_.md) |  | <b><i>(BETA)</i></b> Constructs a new instance of the <code>Calibration</code> class |

## Properties

|  Property | Modifiers | Type | Description |
|  --- | --- | --- | --- |
|  [gamma](./rmm-sdk.calibration.gamma.md) |  | Percentage | <b><i>(BETA)</i></b> Gamma, equal to 1 - fee %, as a Percentage instance with 4 precision. |
|  [maturity](./rmm-sdk.calibration.maturity.md) |  | Time | <b><i>(BETA)</i></b> Time class with a raw value in seconds. |
|  [MAX\_GAMMA](./rmm-sdk.calibration.max_gamma.md) | <code>static</code> | number | <b><i>(BETA)</i></b> Maximum gamma value inclusive, equal to 9999 basis points, or 99.99%. |
|  [MAX\_SIGMA](./rmm-sdk.calibration.max_sigma.md) | <code>static</code> | number | <b><i>(BETA)</i></b> Maximum sigma value inclusive, equal to 10\_000\_000 basis points, or 1\_000.00%. |
|  [MIN\_GAMMA](./rmm-sdk.calibration.min_gamma.md) | <code>static</code> | number | <b><i>(BETA)</i></b> Minimum gamma value inclusive, equal to 9000 basis points, or 90.00%. |
|  [MIN\_SIGMA](./rmm-sdk.calibration.min_sigma.md) | <code>static</code> | (not declared) | <b><i>(BETA)</i></b> Minimum sigma value inclusive, equal to 1 basis point, or 0.01%. |
|  [poolId](./rmm-sdk.calibration.poolid.md) |  | string | <b><i>(BETA)</i></b> Computes deterministic poolIds from hashing engine address and calibration parameters. |
|  [sigma](./rmm-sdk.calibration.sigma.md) |  | Percentage | <b><i>(BETA)</i></b> Volatility as a Percentage instance with 4 precision. |
|  [strike](./rmm-sdk.calibration.strike.md) |  | Wei | <b><i>(BETA)</i></b> Strike price with the same precision as the stable asset. |

