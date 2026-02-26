// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReceiverTemplate} from "./interfaces/ReceiverTemplate.sol";

contract RiskOracle is ReceiverTemplate {

    // ================================================================
    // │                            Errors                            │
    // ================================================================

    error InvalidScore();

    // ================================================================
    // │                            Events                            │
    // ================================================================

    event RiskUpdated(address indexed token, uint8 score, uint256 timestamp);

    // ================================================================
    // │                            Storage                           │
    // ================================================================

    struct RiskData {
        uint8 riskScore;
        uint256 lastUpdated;
    }

    mapping(address => RiskData) public risks;

    // ================================================================
    // │                        Constructor                           │
    // ================================================================

    /// @param _forwarderAddress Chainlink KeystoneForwarder address
    /// For Sepolia: 0x15fc6ae953e024d975e77382eeec56a9101f9f88
    constructor(address _forwarderAddress)
        ReceiverTemplate(_forwarderAddress)
    {}

    // ================================================================
    // │                    CRE Entry Point                           │
    // ================================================================

    /// @notice Called automatically via onReport() by the Forwarder
    /// @param report ABI-encoded (address token, uint8 score)
    function _processReport(bytes calldata report) internal override {
        (address token, uint8 score) = abi.decode(report, (address, uint8));

        if (score > 100) revert InvalidScore();

        risks[token] = RiskData({
            riskScore: score,
            lastUpdated: block.timestamp
        });

        emit RiskUpdated(token, score, block.timestamp);
    }
}
