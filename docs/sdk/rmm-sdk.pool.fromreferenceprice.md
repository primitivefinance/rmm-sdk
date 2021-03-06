<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@primitivefi/rmm-sdk](./rmm-sdk.md) &gt; [Pool](./rmm-sdk.pool.md) &gt; [fromReferencePrice](./rmm-sdk.pool.fromreferenceprice.md)

## Pool.fromReferencePrice() method

> This API is provided as a preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.
> 

Constructs a Pool entity using a reference price, which is used to compute the reserves of the pool.

<b>Signature:</b>

```typescript
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
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  referencePrice | number |  |
|  factory | string |  |
|  risky | { address: string; decimals: string \| number; name?: string; symbol?: string; } |  |
|  stable | { address: string; decimals: string \| number; name?: string; symbol?: string; } |  |
|  calibration | { strike: string; sigma: string; maturity: string; gamma: string; lastTimestamp?: string; } |  |
|  chainId | number |  |
|  liquidity | string |  |
|  invariant | number |  |

<b>Returns:</b>

[Pool](./rmm-sdk.pool.md)

## Remarks

Defaults to an invariant of 0, since the reserves are computed using an invariant of 0.

