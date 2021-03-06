<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@primitivefi/rmm-sdk](./rmm-sdk.md) &gt; [IPool](./rmm-sdk.ipool.md) &gt; [liquidityQuote](./rmm-sdk.ipool.liquidityquote.md)

## IPool.liquidityQuote() method

> This API is provided as a preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.
> 

Computes other side(s) of pool and/or liquidity amount, given a known size of one side of the pool.

<b>Signature:</b>

```typescript
liquidityQuote(amount: Wei, sideOfPool: PoolSides): {
        delRisky: Wei;
        delStable: Wei;
        delLiquidity: Wei;
    };
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  amount | Wei | Size of [PoolSides](./rmm-sdk.poolsides.md) |
|  sideOfPool | [PoolSides](./rmm-sdk.poolsides.md) | Risky reserve, stable reserve, or liquidity of pool; [PoolSides](./rmm-sdk.poolsides.md)<!-- -->. |

<b>Returns:</b>

{ delRisky: Wei; delStable: Wei; delLiquidity: Wei; }

## Exceptions

Throws if `liquidity` is zero.

