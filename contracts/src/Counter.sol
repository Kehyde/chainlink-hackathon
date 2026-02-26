// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

/// @title Counter
/// @notice Simple contract to track a count value with increment/decrement functionality.
contract Counter {
    uint256 private count;

    /// @notice Returns the current count.
    function getCount() public view returns (uint256) {
        return count;
    }

    /// @notice Increments the counter by one.
    function inc() public {
        count += 1;
    }

    /// @notice Decrements the counter by one.  Will revert if count is zero.
    function dec() public {
        require(count > 0, "Counter: underflow");
        count -= 1;
    }

    /// @notice Resets the counter to zero.
    function reset() public {
        count = 0;
    }
}
