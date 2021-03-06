<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@primitivefi/rmm-sdk](./rmm-sdk.md) &gt; [validateAndParseAddress](./rmm-sdk.validateandparseaddress.md)

## validateAndParseAddress() function

> This API is provided as a preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.
> 

Validates an address and returns the parsed (checksummed) version of that address.

<b>Signature:</b>

```typescript
export declare function validateAndParseAddress(address: string): string;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  address | string | the unchecksummed hex address. |

<b>Returns:</b>

string

## Exceptions

Throws if `address` is an invalid hex address.

