// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

contract DigitalBatteryPassport is Ownable {
    struct Passport {
        string passportNumber;
        bytes32 latestDataHash;
        uint32 currentVersion;
        uint256 createdAt;
        uint256 updatedAt;
        address issuer;
        address responsibleEntity;
        bool exists;
    }

    mapping(bytes32 => Passport) private passports;

    mapping(address => bool) public authorizedCompanies;

    event CompanyAuthorized(address indexed company);
    event CompanyRemoved(address indexed company);

    event PassportCreated(
        bytes32 indexed passportHash,
        string passportNumber,
        bytes32 dataHash,
        address indexed issuer,
        uint256 timestamp
    );

    event PassportUpdated(
        bytes32 indexed passportHash,
        string passportNumber,
        bytes32 dataHash,
        uint32 version,
        address indexed updatedBy,
        uint256 timestamp
    );

    event ResponsibilityTransferred(
        bytes32 indexed passportHash,
        string passportNumber,
        address indexed previousEntity,
        address indexed newEntity,
        uint256 timestamp
    );

    constructor(address initialOwner) Ownable(initialOwner) {}

    modifier onlyAuthorizedCompany() {
        require(authorizedCompanies[msg.sender], "Not an authorized company");
        _;
    }

    function addAuthorizedCompany(address company) external onlyOwner {
        authorizedCompanies[company] = true;

        emit CompanyAuthorized(company);
    }

    function removeAuthorizedCompany(address company) external onlyOwner {
        authorizedCompanies[company] = false;

        emit CompanyRemoved(company);
    }

    function createPassport(
        string calldata passportNumber,
        bytes32 dataHash
    ) external onlyAuthorizedCompany {
        bytes32 passportHash = keccak256(abi.encodePacked(passportNumber));

        require(!passports[passportHash].exists, "Passport already exists");

        passports[passportHash] = Passport({
            passportNumber: passportNumber,
            latestDataHash: dataHash,
            currentVersion: 1,
            createdAt: block.timestamp,
            updatedAt: block.timestamp,
            issuer: msg.sender,
            responsibleEntity: msg.sender,
            exists: true
        });

        emit PassportCreated(
            passportHash,
            passportNumber,
            dataHash,
            msg.sender,
            block.timestamp
        );
    }

    function updatePassport(
        string calldata passportNumber,
        bytes32 newDataHash,
        uint32 newVersion
    ) external onlyAuthorizedCompany {
        bytes32 passportHash = keccak256(abi.encodePacked(passportNumber));

        Passport storage passport = passports[passportHash];

        require(passport.exists, "Passport not found");

        require(
            passport.responsibleEntity == msg.sender,
            "Not responsible entity"
        );

        passport.latestDataHash = newDataHash;
        passport.currentVersion = newVersion;
        passport.updatedAt = block.timestamp;

        emit PassportUpdated(
            passportHash,
            passportNumber,
            newDataHash,
            passport.currentVersion,
            msg.sender,
            block.timestamp
        );
    }

    function transferResponsibility(
        string calldata passportNumber,
        address newResponsibleEntity
    ) external onlyAuthorizedCompany {
        require(
            authorizedCompanies[newResponsibleEntity],
            "New entity not authorized"
        );

        bytes32 passportHash = keccak256(abi.encodePacked(passportNumber));

        Passport storage passport = passports[passportHash];

        require(passport.exists, "Passport not found");

        require(
            passport.responsibleEntity == msg.sender,
            "Not responsible entity"
        );

        address oldEntity = passport.responsibleEntity;

        passport.responsibleEntity = newResponsibleEntity;

        passport.updatedAt = block.timestamp;

        emit ResponsibilityTransferred(
            passportHash,
            passportNumber,
            oldEntity,
            newResponsibleEntity,
            block.timestamp
        );
    }

    function getPassport(
        string calldata passportNumber
    ) external view returns (Passport memory) {
        bytes32 passportHash = keccak256(abi.encodePacked(passportNumber));

        require(passports[passportHash].exists, "Passport not found");

        return passports[passportHash];
    }

    function getPassportByHash(
        bytes32 passportHash
    ) external view returns (Passport memory) {
        require(passports[passportHash].exists, "Passport not found");

        return passports[passportHash];
    }

    function getPassportHash(
        string calldata passportNumber
    ) external pure returns (bytes32) {
        return keccak256(abi.encodePacked(passportNumber));
    }
}
