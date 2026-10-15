// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

contract DigitalBatteryPassport is Ownable {
    // =============================================================
    //                           STRUCTS
    // =============================================================

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

    struct MerkleBatch {
        bytes32 merkleRoot;
        uint256 passportCount;
        address issuer;
        uint256 createdAt;
        bool exists;
        bool active;
    }

    // =============================================================
    //                           STORAGE
    // =============================================================

    // Individual passport records
    mapping(bytes32 => Passport) private passports;

    // Authorized company wallets
    mapping(address => bool) public authorizedCompanies;

    // Merkle batch records
    mapping(bytes32 => MerkleBatch) private merkleBatches;

    // =============================================================
    //                            EVENTS
    // =============================================================

    event CompanyAuthorized(
        address indexed company
    );

    event CompanyRemoved(
        address indexed company
    );

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

    event PassportBatchCreated(
        bytes32 indexed batchId,
        bytes32 indexed merkleRoot,
        uint256 passportCount,
        address indexed issuer,
        uint256 timestamp
    );

    event PassportBatchDeactivated(
        bytes32 indexed batchId,
        uint256 timestamp
    );

    // =============================================================
    //                          MODIFIERS
    // =============================================================

    modifier onlyAuthorizedCompany() {
        require(
            authorizedCompanies[msg.sender],
            "Not an authorized company"
        );
        _;
    }

    // =============================================================
    //                        CONSTRUCTOR
    // =============================================================

    constructor(address initialOwner) Ownable(initialOwner) {}

    // =============================================================
    //                  COMPANY AUTHORIZATION
    // =============================================================

    function addAuthorizedCompany(
        address company
    ) external onlyOwner {
        require(
            company != address(0),
            "Invalid company address"
        );

        authorizedCompanies[company] = true;

        emit CompanyAuthorized(company);
    }

    function removeAuthorizedCompany(
        address company
    ) external onlyOwner {
        authorizedCompanies[company] = false;

        emit CompanyRemoved(company);
    }

    // =============================================================
    //                    INDIVIDUAL PASSPORT
    // =============================================================

    function createPassport(
        string calldata passportNumber,
        bytes32 dataHash
    ) external onlyAuthorizedCompany {
        require(
            bytes(passportNumber).length > 0,
            "Invalid passport number"
        );

        bytes32 passportHash = keccak256(
            abi.encodePacked(passportNumber)
        );

        require(
            !passports[passportHash].exists,
            "Passport already exists"
        );

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
        require(
            newVersion > 0,
            "Invalid version"
        );

        bytes32 passportHash = keccak256(
            abi.encodePacked(passportNumber)
        );

        Passport storage passport = passports[passportHash];

        require(
            passport.exists,
            "Passport not found"
        );

        require(
            passport.responsibleEntity == msg.sender,
            "Not responsible entity"
        );

        require(
            newVersion > passport.currentVersion,
            "Version must be greater than current version"
        );

        passport.latestDataHash = newDataHash;
        passport.currentVersion = newVersion;
        passport.updatedAt = block.timestamp;

        emit PassportUpdated(
            passportHash,
            passportNumber,
            newDataHash,
            newVersion,
            msg.sender,
            block.timestamp
        );
    }

    // =============================================================
    //                  RESPONSIBILITY TRANSFER
    // =============================================================

    function transferResponsibility(
        string calldata passportNumber,
        address newResponsibleEntity
    ) external onlyAuthorizedCompany {
        require(
            newResponsibleEntity != address(0),
            "Invalid responsible entity"
        );

        require(
            authorizedCompanies[newResponsibleEntity],
            "New entity not authorized"
        );

        bytes32 passportHash = keccak256(
            abi.encodePacked(passportNumber)
        );

        Passport storage passport = passports[passportHash];

        require(
            passport.exists,
            "Passport not found"
        );

        require(
            passport.responsibleEntity == msg.sender,
            "Not responsible entity"
        );

        address previousEntity = passport.responsibleEntity;

        passport.responsibleEntity = newResponsibleEntity;
        passport.updatedAt = block.timestamp;

        emit ResponsibilityTransferred(
            passportHash,
            passportNumber,
            previousEntity,
            newResponsibleEntity,
            block.timestamp
        );
    }

    // =============================================================
    //                    MERKLE BATCH CREATION
    // =============================================================

    function createPassportBatch(
        bytes32 batchId,
        bytes32 merkleRoot,
        uint256 passportCount
    ) external onlyAuthorizedCompany {
        require(
            batchId != bytes32(0),
            "Invalid batch ID"
        );

        require(
            merkleRoot != bytes32(0),
            "Invalid Merkle root"
        );

        require(
            passportCount > 0,
            "Passport count must be greater than zero"
        );

        require(
            !merkleBatches[batchId].exists,
            "Batch already exists"
        );

        merkleBatches[batchId] = MerkleBatch({
            merkleRoot: merkleRoot,
            passportCount: passportCount,
            issuer: msg.sender,
            createdAt: block.timestamp,
            exists: true,
            active: true
        });

        emit PassportBatchCreated(
            batchId,
            merkleRoot,
            passportCount,
            msg.sender,
            block.timestamp
        );
    }

    // =============================================================
    //                    MERKLE PASSPORT VERIFY
    // =============================================================

    function verifyPassport(
        bytes32 batchId,
        bytes32 passportHash,
        bytes32[] calldata proof
    ) external view returns (bool) {
        MerkleBatch memory batch = merkleBatches[batchId];

        require(
            batch.exists,
            "Batch not found"
        );

        require(
            batch.active,
            "Batch is inactive"
        );

        return MerkleProof.verify(
            proof,
            batch.merkleRoot,
            passportHash
        );
    }

    // =============================================================
    //                  MERKLE BATCH INFORMATION
    // =============================================================

    function getMerkleBatch(
        bytes32 batchId
    ) external view returns (MerkleBatch memory) {
        require(
            merkleBatches[batchId].exists,
            "Batch not found"
        );

        return merkleBatches[batchId];
    }

    // =============================================================
    //                  DEACTIVATE MERKLE BATCH
    // =============================================================

    function deactivateMerkleBatch(
        bytes32 batchId
    ) external onlyAuthorizedCompany {
        MerkleBatch storage batch = merkleBatches[batchId];

        require(
            batch.exists,
            "Batch not found"
        );

        require(
            batch.issuer == msg.sender,
            "Not batch issuer"
        );

        require(
            batch.active,
            "Batch already inactive"
        );

        batch.active = false;

        emit PassportBatchDeactivated(
            batchId,
            block.timestamp
        );
    }

    // =============================================================
    //                     PASSPORT READ METHODS
    // =============================================================

    function getPassport(
        string calldata passportNumber
    ) external view returns (Passport memory) {
        bytes32 passportHash = keccak256(
            abi.encodePacked(passportNumber)
        );

        require(
            passports[passportHash].exists,
            "Passport not found"
        );

        return passports[passportHash];
    }

    function getPassportByHash(
        bytes32 passportHash
    ) external view returns (Passport memory) {
        require(
            passports[passportHash].exists,
            "Passport not found"
        );

        return passports[passportHash];
    }

    function getPassportHash(
        string calldata passportNumber
    ) external pure returns (bytes32) {
        return keccak256(
            abi.encodePacked(passportNumber)
        );
    }

    // =============================================================
    //                    PASSPORT EXISTENCE
    // =============================================================

    function passportExists(
        bytes32 passportHash
    ) external view returns (bool) {
        return passports[passportHash].exists;
    }

    // =============================================================
    //                    BATCH EXISTENCE
    // =============================================================

    function merkleBatchExists(
        bytes32 batchId
    ) external view returns (bool) {
        return merkleBatches[batchId].exists;
    }

    // =============================================================
    //                         OWNER HELPERS
    // =============================================================

    function isAuthorizedCompany(
        address company
    ) external view returns (bool) {
        return authorizedCompanies[company];
    }
}