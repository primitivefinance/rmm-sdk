<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@primitivefi/rmm-sdk](./rmm-sdk.md) &gt; [SwapManager](./rmm-sdk.swapmanager.md)

## SwapManager class

> This API is provided as a preview for developers and may change based on feedback that we receive. Do not use this API in a production environment.
> 

Abstract class which implements static methods to encode calldata for swaps.

<b>Signature:</b>

```typescript
export declare abstract class SwapManager extends SelfPermit 
```
<b>Extends:</b> [SelfPermit](./rmm-sdk.selfpermit.md)

## Properties

|  Property | Modifiers | Type | Description |
|  --- | --- | --- | --- |
|  [ABI](./rmm-sdk.swapmanager.abi.md) | <code>static</code> | any | <b><i>(BETA)</i></b> |
|  [BYTECODE](./rmm-sdk.swapmanager.bytecode.md) | <code>static</code> | string | <b><i>(BETA)</i></b> |
|  [INTERFACE](./rmm-sdk.swapmanager.interface.md) | <code>static</code> | Interface | <b><i>(BETA)</i></b> |

## Methods

|  Method | Modifiers | Description |
|  --- | --- | --- |
|  [minimumAmountOut(slippageTolerance, amountOut)](./rmm-sdk.swapmanager.minimumamountout.md) | <code>static</code> | <b><i>(BETA)</i></b> Get the minimum amount that must be received from this trade for the given slippage tolerance. |
|  [swapCallParameters(pool, options)](./rmm-sdk.swapmanager.swapcallparameters.md) | <code>static</code> | <b><i>(BETA)</i></b> Gets calldata and value to send for this swap. |
