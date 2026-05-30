// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

interface IEventRewardToken {
    function mintTokens(address student, uint256 amount) external;
}

contract EventRegistry is AccessControl {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant ORGANIZER_ROLE = keccak256("ORGANIZER_ROLE");

    address public tokenContract;

    struct Event {
        uint256 id;
        string name;
        string description;
        address organizer;
        uint256 maxRewards;
        uint256 totalMinted;
        uint256 createdAt;
        bool active;
    }

    uint256 private _eventCounter;
    mapping(uint256 => Event) private _events;
    mapping(address => uint256[]) private _organizerEvents;
    mapping(uint256 => mapping(address => bool)) private _studentJoined;
    mapping(address => uint256[]) private _studentEvents;

    event EventRegistered(uint256 indexed eventId, address indexed organizer, string name, uint256 maxRewards);
    event EventDeactivated(uint256 indexed eventId);
    event RewardRecorded(uint256 indexed eventId, address indexed student, uint256 amount);

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _setRoleAdmin(ORGANIZER_ROLE, ADMIN_ROLE);
    }

    function setTokenContract(address _tokenContract) external onlyAdmin {
        require(_tokenContract != address(0), "Invalid token contract address");
        tokenContract = _tokenContract;
    }

    modifier onlyOrganizer() {
        require(hasRole(ORGANIZER_ROLE, msg.sender), "Caller is not an organizer");
        _;
    }

    modifier onlyAdmin() {
        require(hasRole(ADMIN_ROLE, msg.sender), "Caller is not an admin");
        _;
    }

    function registerEvent(
        string calldata name,
        string calldata description,
        uint256 maxRewards
    ) external onlyOrganizer returns (uint256) {
        require(bytes(name).length > 0, "Event name required");
        require(maxRewards > 0, "Max rewards must be greater than 0");

        _eventCounter++;
        uint256 eventId = _eventCounter;

        _events[eventId] = Event({
            id: eventId,
            name: name,
            description: description,
            organizer: msg.sender,
            maxRewards: maxRewards,
            totalMinted: 0,
            createdAt: block.timestamp,
            active: true
        });

        _organizerEvents[msg.sender].push(eventId);

        emit EventRegistered(eventId, msg.sender, name, maxRewards);
        return eventId;
    }

    function getEventDetails(uint256 eventId) external view returns (Event memory) {
        require(eventId > 0 && eventId <= _eventCounter, "Event does not exist");
        return _events[eventId];
    }

    function getOrganizerEvents(address organizer) external view returns (uint256[] memory) {
        return _organizerEvents[organizer];
    }

    function getTotalEvents() external view returns (uint256) {
        return _eventCounter;
    }

    function recordReward(uint256 eventId, address student, uint256 amount) external onlyOrganizer {
        require(eventId > 0 && eventId <= _eventCounter, "Event does not exist");
        require(_events[eventId].active, "Event is not active");
        require(_events[eventId].organizer == msg.sender, "Not event organizer");
        require(
            _events[eventId].totalMinted + amount <= _events[eventId].maxRewards,
            "Exceeds max rewards"
        );

        _events[eventId].totalMinted += amount;
        emit RewardRecorded(eventId, student, amount);
    }

    function recordStudentAttendance(uint256 eventId, uint256 amount) external {
        require(eventId > 0 && eventId <= _eventCounter, "Event does not exist");
        require(_events[eventId].active, "Event is not active");
        require(amount > 0, "Reward amount must be greater than 0");
        require(!_studentJoined[eventId][msg.sender], "Already joined this event");
        require(
            _events[eventId].totalMinted + amount <= _events[eventId].maxRewards,
            "Exceeds max rewards for this event"
        );

        _events[eventId].totalMinted += amount;
        _studentJoined[eventId][msg.sender] = true;
        _studentEvents[msg.sender].push(eventId);

        // Mint tokens to the student
        if (tokenContract != address(0)) {
            IEventRewardToken(tokenContract).mintTokens(msg.sender, amount);
        }

        emit RewardRecorded(eventId, msg.sender, amount);
    }

    function deactivateEvent(uint256 eventId) external {
        require(eventId > 0 && eventId <= _eventCounter, "Event does not exist");
        require(
            _events[eventId].organizer == msg.sender || hasRole(ADMIN_ROLE, msg.sender),
            "Not authorized"
        );
        _events[eventId].active = false;
        emit EventDeactivated(eventId);
    }

    function getAllEvents() external view returns (Event[] memory) {
        Event[] memory allEvents = new Event[](_eventCounter);
        for (uint256 i = 1; i <= _eventCounter; i++) {
            allEvents[i - 1] = _events[i];
        }
        return allEvents;
    }

    function hasStudentJoined(uint256 eventId, address student) external view returns (bool) {
        return _studentJoined[eventId][student];
    }

    function getStudentEvents(address student) external view returns (uint256[] memory) {
        return _studentEvents[student];
    }
}
