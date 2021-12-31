<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@primitivefi/rmm-sdk](./rmm-sdk.md) &gt; [validateDecimals](./rmm-sdk.validatedecimals.md)

## validateDecimals() function

> This API is provided as a preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.
> 

Checks if `amount.decimals` is equal to `token.decimals`<!-- -->.

<b>Signature:</b>

```typescript
export declare function validateDecimals(amount: Wei, token: Token): void;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  amount | Wei | Amount as a Wei class to compare the decimals of to <code>token.decimals</code>. |
|  token | Token | Token to check the <code>amount</code> against for the same decimals. |

<b>Returns:</b>

void

## Exceptions

Throws if token decimals are not equal.
