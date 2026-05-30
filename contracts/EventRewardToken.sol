// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract EventRewardToken is ERC20, AccessControl, Pausable, ReentrancyGuard {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant ORGANIZER_ROLE = keccak256("ORGANIZER_ROLE");
    bytes32 public constant STUDENT_ROLE = keccak256("STUDENT_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    // Track rewards per organizer
    mapping(address => uint256) private _organizerRewards;
    // Track redemptions per student
    mapping(address => uint256) private _studentRedemptions;

    event TokenMinted(address indexed organizer, address indexed student, uint256 amount, uint256 timestamp);
    event TokensRedeemed(address indexed student, uint256 amount, string perkName, uint256 timestamp);
    event TokensBurned(address indexed admin, address indexed student, uint256 amount, uint256 timestamp);

    constructor(address admin) ERC20("EventRewardToken", "ERT") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _setRoleAdmin(ORGANIZER_ROLE, ADMIN_ROLE);
        _setRoleAdmin(STUDENT_ROLE, ADMIN_ROLE);
        _setRoleAdmin(MINTER_ROLE, ADMIN_ROLE);
    }

    modifier onlyAdmin() {
        require(hasRole(ADMIN_ROLE, msg.sender), "Caller is not an admin");
        _;
    }

    modifier onlyOrganizer() {
        require(hasRole(ORGANIZER_ROLE, msg.sender), "Caller is not an organizer");
        _;
    }

    modifier onlyStudent() {
        require(hasRole(STUDENT_ROLE, msg.sender), "Caller is not a student");
        _;
    }

    function mintTokens(address student, uint256 amount)
        external
        whenNotPaused
        nonReentrant
    {
        require(
            hasRole(ORGANIZER_ROLE, msg.sender) || hasRole(MINTER_ROLE, msg.sender),
            "Caller is not authorized to mint"
        );
        require(student != address(0), "Invalid student address");
        require(amount > 0, "Amount must be greater than 0");

        _mint(student, amount);
        _organizerRewards[msg.sender] += amount;

        emit TokenMinted(msg.sender, student, amount, block.timestamp);
    }

    function burnTokens(address student, uint256 amount)
        external
        onlyAdmin
        nonReentrant
    {
        require(student != address(0), "Invalid student address");
        require(amount > 0, "Amount must be greater than 0");
        require(balanceOf(student) >= amount, "Insufficient student balance");

        _burn(student, amount);

        emit TokensBurned(msg.sender, student, amount, block.timestamp);
    }

    function redeemTokens(uint256 amount, string calldata perkName)
        external
        onlyStudent
        whenNotPaused
        nonReentrant
    {
        require(amount > 0, "Amount must be greater than 0");
        require(balanceOf(msg.sender) >= amount, "Insufficient balance");
        require(bytes(perkName).length > 0, "Perk name required");

        _burn(msg.sender, amount);
        _studentRedemptions[msg.sender] += amount;

        emit TokensRedeemed(msg.sender, amount, perkName, block.timestamp);
    }

    function pause() external onlyAdmin {
        _pause();
    }

    function unpause() external onlyAdmin {
        _unpause();
    }

    function getStudentBalance(address student) external view returns (uint256) {
        return balanceOf(student);
    }

    function getOrganizerRewards(address organizer) external view returns (uint256) {
        return _organizerRewards[organizer];
    }

    function getStudentRedemptions(address student) external view returns (uint256) {
        return _studentRedemptions[student];
    }

    function getUserRole(address account) external view returns (string memory) {
        if (hasRole(ADMIN_ROLE, account)) return "ADMIN";
        if (hasRole(ORGANIZER_ROLE, account)) return "ORGANIZER";
        if (hasRole(STUDENT_ROLE, account)) return "STUDENT";
        return "NONE";
    }

    // Override transfer to respect pause
    function _beforeTokenTransfer(address from, address to, uint256 amount)
        internal
        override
        whenNotPaused
    {
        super._beforeTokenTransfer(from, to, amount);
    }
}
