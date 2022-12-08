<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@primitivefi/rmm-sdk](./rmm-sdk.md) &gt; [PeripheryManager](./rmm-sdk.peripherymanager.md) &gt; [removeCallParameters](./rmm-sdk.peripherymanager.removecallparameters.md)

## PeripheryManager.removeCallParameters() method

> This API is provided as a preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.
> 

Gets calldata and value to send to remove liquidity from a Pool through Primitive Manager.

<b>Signature:</b>

```typescript
static removeCallParameters(pool: Pool, options: RemoveOptions): MethodParameters;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  pool | [Pool](./rmm-sdk.pool.md) | [IPool](./rmm-sdk.ipool.md) Uses poolId and tokens of Pool entity for remove arguments. |
|  options | [RemoveOptions](./rmm-sdk.removeoptions.md) | [RemoveOptions](./rmm-sdk.removeoptions.md) Remove argument details. |

<b>Returns:</b>

[MethodParameters](./rmm-sdk.methodparameters.md)

## Exceptions

Throws if [LiquidityOptions.delLiquidity](./rmm-sdk.liquidityoptions.delliquidity.md) is zero. Throws if [LiquidityOptions](./rmm-sdk.liquidityoptions.md) amount decimals does not match respective token decimals.
