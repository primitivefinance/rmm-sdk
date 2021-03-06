<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@primitivefi/rmm-sdk](./rmm-sdk.md) &gt; [computeEngineAddress](./rmm-sdk.computeengineaddress.md)

## computeEngineAddress() function

> This API is provided as a preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.
> 

Statically computes an Engine address.

<b>Signature:</b>

```typescript
export declare function computeEngineAddress(factory: string, risky: string, stable: string, contractBytecode: string): string;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  factory | string | Deployer of the Engine contract. |
|  risky | string | Risky token address. |
|  stable | string | Stable token address. |
|  contractBytecode | string | Bytecode of the PrimitiveEngine.sol smart contract. |

<b>Returns:</b>

string

engine address.

## Remarks

Verify `contractBytecode` is up-to-date.

