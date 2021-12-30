<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@primitivefi/rmm-sdk](./rmm-sdk.md) &gt; [Pool](./rmm-sdk.pool.md) &gt; [from](./rmm-sdk.pool.from.md)

## Pool.from() method

 Constructs a Pool entity from actual reserve data, e.g. on-chain state

<b>Signature:</b>

```typescript
static from(pool: PoolInterface, referencePrice?: number, chainId?: number): Pool;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  pool | [PoolInterface](./rmm-sdk.poolinterface.md) | Returned data from on-chain, reconstructed to match PoolInterface or returned from the <code>house.uri(id)</code> call |
|  referencePrice | number |  |
|  chainId | number |  |

<b>Returns:</b>

[Pool](./rmm-sdk.pool.md)

Pool entity
