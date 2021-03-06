<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@primitivefi/rmm-sdk](./rmm-sdk.md) &gt; [PoolInterface](./rmm-sdk.poolinterface.md) &gt; [properties](./rmm-sdk.poolinterface.properties.md)

## PoolInterface.properties property

> This API is provided as a preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.
> 

All meta-data related to the Primitive Engine's pool for this token id.

<b>Signature:</b>

```typescript
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
            lastTimestamp: string;
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
```
