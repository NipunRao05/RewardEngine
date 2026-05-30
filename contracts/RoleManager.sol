// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

interface IEventRewardToken {
    function grantRole(bytes32 role, address account) external;
    function revokeRole(bytes32 role, address account) external;
}

interface IEventRegistry {
    function grantRole(bytes32 role, address account) external;
    function revokeRole(bytes32 role, address account) external;
}

contract RoleManager is AccessControl {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant ORGANIZER_ROLE = keccak256("ORGANIZER_ROLE");
    bytes32 public constant STUDENT_ROLE = keccak256("STUDENT_ROLE");

    address public tokenContract;
    address public registryContract;

    struct UserInfo {
        address wallet;
        string role;
        uint256 addedAt;
        bool active;
    }

    mapping(address => UserInfo) private _users;
    address[] private _allUsers;

    event OrganizerAdded(address indexed account, address indexed addedBy);
    event StudentAdded(address indexed account, address indexed addedBy);
    event UserRoleRevoked(address indexed account, string role, address indexed revokedBy);
    event ContractsSet(address tokenContract, address registryContract);

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);

        _users[admin] = UserInfo({
            wallet: admin,
            role: "ADMIN",
            addedAt: block.timestamp,
            active: true
        });
        _allUsers.push(admin);
    }

    modifier onlyAdmin() {
        require(hasRole(ADMIN_ROLE, msg.sender), "Caller is not an admin");
        _;
    }

    function setContracts(address _tokenContract, address _registryContract) external onlyAdmin {
        tokenContract = _tokenContract;
        registryContract = _registryContract;
        emit ContractsSet(_tokenContract, _registryContract);
    }

    function addOrganizer(address account) external onlyAdmin {
        require(account != address(0), "Invalid address");
        require(!hasRole(ORGANIZER_ROLE, account), "Already an organizer");

        _grantRole(ORGANIZER_ROLE, account);

        if (tokenContract != address(0)) {
            IEventRewardToken(tokenContract).grantRole(ORGANIZER_ROLE, account);
        }
        if (registryContract != address(0)) {
            IEventRegistry(registryContract).grantRole(ORGANIZER_ROLE, account);
        }

        if (_users[account].wallet == address(0)) {
            _allUsers.push(account);
        }
        _users[account] = UserInfo({
            wallet: account,
            role: "ORGANIZER",
            addedAt: block.timestamp,
            active: true
        });

        emit OrganizerAdded(account, msg.sender);
    }

    function addStudent(address account) external onlyAdmin {
        require(account != address(0), "Invalid address");
        require(!hasRole(STUDENT_ROLE, account), "Already a student");

        _grantRole(STUDENT_ROLE, account);

        if (tokenContract != address(0)) {
            IEventRewardToken(tokenContract).grantRole(STUDENT_ROLE, account);
        }

        if (_users[account].wallet == address(0)) {
            _allUsers.push(account);
        }
        _users[account] = UserInfo({
            wallet: account,
            role: "STUDENT",
            addedAt: block.timestamp,
            active: true
        });

        emit StudentAdded(account, msg.sender);
    }

    function revokeUserRole(address account) external onlyAdmin {
        require(account != address(0), "Invalid address");
        string memory role = _users[account].role;

        if (hasRole(ORGANIZER_ROLE, account)) {
            _revokeRole(ORGANIZER_ROLE, account);
            if (tokenContract != address(0)) {
                IEventRewardToken(tokenContract).revokeRole(ORGANIZER_ROLE, account);
            }
            if (registryContract != address(0)) {
                IEventRegistry(registryContract).revokeRole(ORGANIZER_ROLE, account);
            }
        } else if (hasRole(STUDENT_ROLE, account)) {
            _revokeRole(STUDENT_ROLE, account);
            if (tokenContract != address(0)) {
                IEventRewardToken(tokenContract).revokeRole(STUDENT_ROLE, account);
            }
        }

        _users[account].active = false;
        emit UserRoleRevoked(account, role, msg.sender);
    }

    function getUserRole(address account) external view returns (string memory) {
        if (hasRole(ADMIN_ROLE, account)) return "ADMIN";
        if (hasRole(ORGANIZER_ROLE, account)) return "ORGANIZER";
        if (hasRole(STUDENT_ROLE, account)) return "STUDENT";
        return "NONE";
    }

    function getUserInfo(address account) external view returns (UserInfo memory) {
        return _users[account];
    }

    function getAllUsers() external view onlyAdmin returns (UserInfo[] memory) {
        UserInfo[] memory users = new UserInfo[](_allUsers.length);
        for (uint256 i = 0; i < _allUsers.length; i++) {
            users[i] = _users[_allUsers[i]];
        }
        return users;
    }

    function isOrganizer(address account) external view returns (bool) {
        return hasRole(ORGANIZER_ROLE, account);
    }

    function isStudent(address account) external view returns (bool) {
        return hasRole(STUDENT_ROLE, account);
    }

    function isAdmin(address account) external view returns (bool) {
        return hasRole(ADMIN_ROLE, account);
    }
}
