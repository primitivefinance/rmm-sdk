<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@primitivefi/rmm-sdk](./rmm-sdk.md) &gt; [PeripheryManager](./rmm-sdk.peripherymanager.md) &gt; [createCallParameters](./rmm-sdk.peripherymanager.createcallparameters.md)

## PeripheryManager.createCallParameters() method

<b>Signature:</b>

```typescript
static createCallParameters(pool: Pool, liquidity: Wei, options?: PermitTokens): {
        calldata: string;
        value: string;
    };
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  pool | [Pool](./rmm-sdk.pool.md) |  |
|  liquidity | Wei |  |
|  options | [PermitTokens](./rmm-sdk.permittokens.md) |  |

<b>Returns:</b>

{ calldata: string; value: string; }
