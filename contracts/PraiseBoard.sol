// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract PraiseBoard {
    struct Tip {
        address supporter;
        uint256 amount;
        string note;
        uint256 timestamp;
    }

    error ZeroTip();
    error EmptyNote();
    error NoteTooLong(uint256 length);
    error NotOwner();
    error NothingToWithdraw();
    error WithdrawalFailed();
    error ReentrantCall();

    address public immutable owner;
    uint256 public totalTipCount;
    uint256 public totalAmountReceived;
    uint256 private withdrawalStatus;
    Tip[] private tips;

    event TipReceived(address indexed supporter, uint256 amount, string note, uint256 timestamp);

    constructor() {
        owner = msg.sender;
        withdrawalStatus = 1;
    }

    function tip(string calldata note) external payable {
        if (msg.value == 0) revert ZeroTip();
        uint256 noteLength = bytes(note).length;
        if (noteLength == 0) revert EmptyNote();
        if (noteLength > 280) revert NoteTooLong(noteLength);
        bool hasVisibleCharacter;
        for (uint256 i; i < noteLength; i++) {
            bytes1 character = bytes(note)[i];
            if (character != 0x20 && character != 0x09 && character != 0x0a && character != 0x0d) {
                hasVisibleCharacter = true;
                break;
            }
        }
        if (!hasVisibleCharacter) revert EmptyNote();

        tips.push(Tip(msg.sender, msg.value, note, block.timestamp));
        totalTipCount += 1;
        totalAmountReceived += msg.value;

        emit TipReceived(msg.sender, msg.value, note, block.timestamp);
    }

    function getTip(uint256 index) external view returns (Tip memory) {
        return tips[index];
    }

    function getTotalTipCount() external view returns (uint256) {
        return totalTipCount;
    }

    function withdraw() external {
        if (msg.sender != owner) revert NotOwner();
        if (withdrawalStatus != 1) revert ReentrantCall();

        uint256 amount = address(this).balance;
        if (amount == 0) revert NothingToWithdraw();

        withdrawalStatus = 2;
        (bool success, ) = payable(owner).call{value: amount}("");
        if (!success) revert WithdrawalFailed();
        withdrawalStatus = 1;
    }
}
