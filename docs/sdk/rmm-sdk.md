<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@primitivefi/rmm-sdk](./rmm-sdk.md)

## rmm-sdk package

## Classes

|  Class | Description |
|  --- | --- |
|  [Calibration](./rmm-sdk.calibration.md) | <b><i>(BETA)</i></b> Calibration base class implements [ICalibration](./rmm-sdk.icalibration.md) |
|  [Engine](./rmm-sdk.engine.md) | <b><i>(BETA)</i></b> Engine base class implementation of [IEngine](./rmm-sdk.iengine.md) |
|  [Floating](./rmm-sdk.floating.md) | <b><i>(BETA)</i></b> Floating point Decimal numbers are used to calculate values for RMM pools. |
|  [PeripheryManager](./rmm-sdk.peripherymanager.md) | <b><i>(BETA)</i></b> Abstract class with static methods to build Manager function calldatas. |
|  [Pool](./rmm-sdk.pool.md) | <b><i>(BETA)</i></b> Pool base class implements [IPool](./rmm-sdk.ipool.md)<!-- -->. |
|  [SelfPermit](./rmm-sdk.selfpermit.md) | Abstract class with static methods to encode permit related function calldata. |
|  [SwapManager](./rmm-sdk.swapmanager.md) | <b><i>(BETA)</i></b> Abstract class which implements static methods to encode calldata for swaps. |
|  [Swaps](./rmm-sdk.swaps.md) | Static functions to compute swap in/out amounts and marginal prices. |

## Enumerations

|  Enumeration | Description |
|  --- | --- |
|  [PoolSides](./rmm-sdk.poolsides.md) | <b><i>(BETA)</i></b> Enum for each side of the pool, inclusive of liquidity token. |

## Functions

|  Function | Description |
|  --- | --- |
|  [computeEngineAddress(factory, risky, stable, contractBytecode)](./rmm-sdk.computeengineaddress.md) | <b><i>(BETA)</i></b> Statically computes an Engine address. |
|  [computePoolId(engine, strike, sigma, maturity, gamma)](./rmm-sdk.computepoolid.md) | <b><i>(BETA)</i></b> Computes deterministic poolIds from hashing engine address and calibration parameters. |
|  [getTokenPairSaltHash(token0, token1)](./rmm-sdk.gettokenpairsalthash.md) | <b><i>(BETA)</i></b> Get hash of the token pair addresses is used as the salt in PrimitiveFactory create2 calls. |
|  [isValidGamma(gamma)](./rmm-sdk.isvalidgamma.md) | Checks <code>gamma</code> is within the valid smart contract range. |
|  [isValidMaturity(maturity)](./rmm-sdk.isvalidmaturity.md) | Checks <code>maturity</code> is within the valid smart contract range. |
|  [isValidSigma(sigma)](./rmm-sdk.isvalidsigma.md) | <b><i>(BETA)</i></b> Checks <code>sigma</code> is within the valid smart contract range. |
|  [isValidStrike(strike)](./rmm-sdk.isvalidstrike.md) | Checks <code>strike</code> is within the valid smart contract range. |
|  [normalize(wad, decimals)](./rmm-sdk.normalize.md) | <b><i>(BETA)</i></b> Truncates <code>wad</code> to appropriate decimals then converts to a floating point number. |
|  [parseCalibration(factory, risky, stable, cal, chainId)](./rmm-sdk.parsecalibration.md) | <b><i>(BETA)</i></b> Constructs a Calibration entity from on-chain data. |
|  [validateAndParseAddress(address)](./rmm-sdk.validateandparseaddress.md) | <b><i>(BETA)</i></b> Validates an address and returns the parsed (checksummed) version of that address. |
|  [validateDecimals(amount, token)](./rmm-sdk.validatedecimals.md) | <b><i>(BETA)</i></b> Checks if <code>amount.decimals</code> is equal to <code>token.decimals</code>. |
|  [weiToWei(wei, decimals)](./rmm-sdk.weitowei.md) | <b><i>(BETA)</i></b> Gets a Wei class from a wei string value. |

## Interfaces

|  Interface | Description |
|  --- | --- |
|  [AllocateOptions](./rmm-sdk.allocateoptions.md) | Provide liquidity argument details. |
|  [AllowedPermitArguments](./rmm-sdk.allowedpermitarguments.md) | [https://eips.ethereum.org/EIPS/eip-2612](https://eips.ethereum.org/EIPS/eip-2612) |
|  [BatchTransferOptions](./rmm-sdk.batchtransferoptions.md) | Batch Transfer ERC-1155 liquidity token argument details. |
|  [CalibrationStruct](./rmm-sdk.calibrationstruct.md) | <b><i>(BETA)</i></b> Data structure of the Primitive Engine Calibration struct, which is used for Pool curves. |
|  [Deadline](./rmm-sdk.deadline.md) | Timestamp which will revert the transaction if not yet mined. |
|  [DefaultOptions](./rmm-sdk.defaultoptions.md) | Default arguments in swaps. |
|  [ExactInResult](./rmm-sdk.exactinresult.md) |  |
|  [ExactOutResult](./rmm-sdk.exactoutresult.md) |  |
|  [ICalibration](./rmm-sdk.icalibration.md) | Calibration Struct; Class representation of each Curve's parameters. |
|  [IEngine](./rmm-sdk.iengine.md) | <b><i>(BETA)</i></b> Abstraction of PrimitiveEngine.sol smart contract. |
|  [IPool](./rmm-sdk.ipool.md) | <b><i>(BETA)</i></b> Abstraction of a Primitive RMM Pool |
|  [LiquidityOptions](./rmm-sdk.liquidityoptions.md) | Token amounts to use for allocating liquidity. |
|  [MarginOptions](./rmm-sdk.marginoptions.md) | Token amounts to use for depositing or withdrawing into a margin account. |
|  [MethodParameters](./rmm-sdk.methodparameters.md) | Generated method parameters for executing a call. |
|  [NativeOptions](./rmm-sdk.nativeoptions.md) | Flag to use a native currency in a transaction. |
|  [PermitTokens](./rmm-sdk.permittokens.md) | Permit details on either risky or stable tokens. |
|  [PoolInterface](./rmm-sdk.poolinterface.md) | <b><i>(BETA)</i></b> Data structure of PrimitiveManager ERC-1155 Uniform Resource Identifier ("URI"). |
|  [RecipientOptions](./rmm-sdk.recipientoptions.md) | Recipient address of any tokens which are output from transactions. |
|  [RemoveOptions](./rmm-sdk.removeoptions.md) | Remove liquidity argument details. |
|  [ReserveStruct](./rmm-sdk.reservestruct.md) | <b><i>(BETA)</i></b> Data structure of the Primitive Engine Reserve struct, which is used tracking tokens in Pool. |
|  [RSV](./rmm-sdk.rsv.md) | Valid secp256k1 signature components |
|  [SafeTransferOptions](./rmm-sdk.safetransferoptions.md) | Transfer ERC-1155 liquidity token argument details. |
|  [StandardPermitArguments](./rmm-sdk.standardpermitarguments.md) | [https://eips.ethereum.org/EIPS/eip-2612](https://eips.ethereum.org/EIPS/eip-2612) |
|  [SwapOptions](./rmm-sdk.swapoptions.md) | Swap arguments. |
|  [SwapResult](./rmm-sdk.swapresult.md) | Post-swap invariant and implied price after a swap. |

## Type Aliases

|  Type Alias | Description |
|  --- | --- |
|  [PermitOptions](./rmm-sdk.permitoptions.md) | Either [AllowedPermitArguments](./rmm-sdk.allowedpermitarguments.md) or [StandardPermitArguments](./rmm-sdk.standardpermitarguments.md) |
