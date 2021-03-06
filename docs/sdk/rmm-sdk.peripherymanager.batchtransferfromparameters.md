<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@primitivefi/rmm-sdk](./rmm-sdk.md) &gt; [PeripheryManager](./rmm-sdk.peripherymanager.md) &gt; [batchTransferFromParameters](./rmm-sdk.peripherymanager.batchtransferfromparameters.md)

## PeripheryManager.batchTransferFromParameters() method

> This API is provided as a preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.
> 

Gets calldata for a transaction to batch transfer multiple ERC-1155 tokens of Primitive Manager.

<b>Signature:</b>

```typescript
static batchTransferFromParameters(options: BatchTransferOptions): MethodParameters;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  options | [BatchTransferOptions](./rmm-sdk.batchtransferoptions.md) | [BatchTransferOptions](./rmm-sdk.batchtransferoptions.md) Safe batch transfer argument details. |

<b>Returns:</b>

[MethodParameters](./rmm-sdk.methodparameters.md)

## Exceptions

Throws if [BatchTransferOptions](./rmm-sdk.batchtransferoptions.md) sender or recipient is an invalid address.

