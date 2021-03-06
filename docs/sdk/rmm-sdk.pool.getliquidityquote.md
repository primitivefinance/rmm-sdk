<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@primitivefi/rmm-sdk](./rmm-sdk.md) &gt; [Pool](./rmm-sdk.pool.md) &gt; [getLiquidityQuote](./rmm-sdk.pool.getliquidityquote.md)

## Pool.getLiquidityQuote() method

> This API is provided as a preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.
> 

 Calculates the other side of the pool using the known amount of a side of the pool

<b>Signature:</b>

```typescript
static getLiquidityQuote(amount: Wei, sideOfPool: PoolSides, reserveRisky: Wei, reserveStable: Wei, liquidity: Wei): {
        delRisky: Wei;
        delStable: Wei;
        delLiquidity: Wei;
    };
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  amount | Wei | Amount of token |
|  sideOfPool | [PoolSides](./rmm-sdk.poolsides.md) | Token side of the pool that is used to calculate the other side |
|  reserveRisky | Wei |  |
|  reserveStable | Wei |  |
|  liquidity | Wei |  |

<b>Returns:</b>

{ delRisky: Wei; delStable: Wei; delLiquidity: Wei; }

risky token amount, stable token amount, and liquidity amount

