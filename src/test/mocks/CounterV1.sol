// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

contract CounterV1 {
    uint256 public value = 0;

    function reset() public {
        value = 0;
    }

    function increase() public {
        value += 1;
    }

    function version() public pure returns (string memory) {
        return "v1";
    }
}
