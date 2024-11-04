// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.18;

contract SniperTrade {
    address public owner;

    constructor() {
        owner = msg.sender;
    }
}