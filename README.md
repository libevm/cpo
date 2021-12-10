# CPO

Chief Proxy Operator

Helps manage and create gas-efficient Proxies -- Proxies that doesn't access the `SLOAD` operator.

## Disclaimer

This is based off an [awesome MVP on efficient proxies](https://forum.openzeppelin.com/t/a-more-gas-efficient-upgradeable-proxy-by-not-using-storage/4111/) by [Santiago Palladino](https://twitter.com/smpalladino).

I'm but a humble searcher, standing on the shoulders of giants.

## Usage

Upgradable control flow:
1. CPO --createProxy--> Proxy
2. On creation, Proxy gets the implementation from CPO and writes impl address into immutable variable
    - Immutable variable is stored at contract code offset 441
    - Compiled with solc 0.8.10, optimization runs: (?) depends on forge
3. To upgrade, call destroyProxy with the same name and recreate it with the same salt but different logic address

## Explainer

A standard [UpgradableProxy](https://github.com/OpenZeppelin/openzeppelin-sdk/blob/master/packages/lib/contracts/upgradeability/BaseUpgradeabilityProxy.sol#L33) will read from a designated storage slot to retrieve the implementation address. Reading from the storage slot requires the use of the `SLOAD` opcode.

According to [this document](https://hackmd.io/@fvictorio/gas-costs-after-berlin), after the Berlin harkfork, accessing the `SLOAD` opcode will now cost 2100 gas on the first run.

![](https://i.imgur.com/knvHlaW.png)

If you're playing short-tail pvp in MEV land, an additional 2100 gas can mean eating ice or chicken tendies for dinner. So, if we can cut down on this 2100 gas, it'll give us an edge over other searchers who uses the standard upgradable proxy.

To avoid accessing the `SLOAD` operator while retrieving the implementation address, a combination of immutable variables, `CODECOPY`, `CREATE2`, and `SELFDESTRUCT` is used.

### Immutable Variables

Our Proxy has two immutables, but the one that we want to pay attention to is the `logic` immutable address, as this will change as we upgrade from implementation to implementation.

```js
contract Proxy {
    address public immutable logic;
    address public immutable cpo;

    // If you ever change this file
    // Or recompile with a new compiler, this offset will probably be different
    // Run test_get_offset() with 3 verbosity to get the offset
    uint256 internal constant offset = 441;

    constructor(address _cpo, string memory _name) {
        cpo = _cpo;
        logic = ICPO(_cpo).implementations(_name);
    }

    ...
}
```

A key thing to note is that immutable variables are not stored in storage, but rather stored **directly in the deployed bytecode**.

![](https://i.imgur.com/f4ZgBZ5.png)
Source: [Solidity Blog](https://blog.soliditylang.org/2020/05/13/immutable-keyword/)

What that means is that with an immutable variable we can do some clever math on the deployed proxy bytecode to retrieve the implementation address. Avoiding `SLOAD` completely.

### CODECOPY

The `CODECOPY` opcode copys the current contract's bytecode into memory. It even accepts an offset, and the length of code it should copy from the current executing contract's bytecode.

![](https://i.imgur.com/6dKvEz1.png)

With some fancy code (check out `test_get_offset` in `CPO.t.sol`) we can calculate the exact offset of the immutable address (this is calculated to be 441 in our specific compiled version) and extract out the implementation (logic) address from our executing bytecode.

```js
uint256 internal constant offset = 441;

fallback() external payable {
    assembly {
        // Extract out immutable variable "logic"
        codecopy(0, offset, 20)
        let impl := mload(0)

        switch iszero(impl)
        case 1 {
            revert(0, 0)
        }
        default {

        }
        ...
    }
}
```

### CREATE2 and SELFDESTRUCT

A picture is worth a thousand words. Something something Sun Zhu art of war I think.

This is how CPO works, in this example:
- CPO = factory
- Template contract A/B = logic
- Contract A / Contract B = Proxy (same address)

![](https://i.imgur.com/RhhRR9d.png)

[Source: @OkCupid](https://twitter.com/cupidhack/status/1468392838035492864)