// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "../CPO.sol";

import "./mocks/CounterV1.sol";
import "./mocks/CounterV2.sol";

import "./lib/test.sol";

interface Vm {
    function etch(address where, bytes memory what) external;
}

contract CPOTest is DSTest {
    CPO cpo;

    address logic1;
    address logic2;

    Vm vm = Vm(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);

    function setUp() public {
        cpo = new CPO(address(this));
        
        logic1 = address(new CounterV1());
        logic2 = address(new CounterV2());
    }

    function test_cpo_upgradable() public {
        string memory name = "feet";
        bytes32 salt = bytes32(uint256(0xf337));

        // Creates the new proxy
        address proxy = cpo.createProxy(name, salt, logic1);
        assertEq(cpo.proxies(name), proxy);
        assertEq(cpo.implementations(name), logic1);

        // Checks the version
        string memory version;
        version = CounterV1(proxy).version();
        assertEq(version, "v1");

        uint256 value;
        value = CounterV1(proxy).value();
        assertEq(value, 0);
        CounterV1(proxy).increase();
        value = CounterV1(proxy).value();
        assertGt(value, 0);

        // Destroy the contract
        cpo.destroyProxy(name);
        assertEq(cpo.proxies(name), address(0));

        // https://forum.openzeppelin.com/t/selfdestruct-and-redeploy-in-the-same-transaction-using-create2-fails/8797
        // Can't simulate another tx in forge/dapp, so this will be sufficient for now
    }

    function test_get_offset() public {
        string memory name = "hello";
        bytes32 salt = bytes32(0);
        address impl = 0x8888888888888888888888888888888888888888;

        address a = cpo.createProxy(name, salt, impl);

        bytes memory bytecode = getCodeAt(a);
        address extractedAddress;
        uint256 offset = 0;

        for (uint256 i = 0; i < bytecode.length; i++) {
            assembly {
                extractedAddress := mload(add(add(bytecode, 20), i))
            }

            if (extractedAddress == impl) {
                offset = i;
                break;
            }
        }

        emit log_string("immutable address offset");
        emit log_uint(offset);

        // Uncomment to get creation code
        // emit log_string("proxy creation code");
        // emit log_bytes(type(Proxy).creationCode);

        // emit log_string("proxy runtime code");
        // emit log_bytes(bytecode);

        assertGt(offset, 0);
    }

    function getCodeAt(address _addr)
        internal
        view
        returns (bytes memory o_code)
    {
        assembly {
            // retrieve the size of the code, this needs assembly
            let size := extcodesize(_addr)
            // allocate output byte array - this could also be done without assembly
            // by using o_code = new bytes(size)
            o_code := mload(0x40)
            // new "memory end" including padding
            mstore(
                0x40,
                add(o_code, and(add(add(size, 0x20), 0x1f), not(0x1f)))
            )
            // store length in memory
            mstore(o_code, size)
            // actually retrieve the code, this needs assembly
            extcodecopy(_addr, add(o_code, 0x20), 0, size)
        }
    }
}
