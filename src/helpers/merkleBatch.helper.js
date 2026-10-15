
const { ethers } = require('ethers');
const { MerkleTree } = require('merkletreejs');
const { randomBytes } = require('crypto');

const BYTES32_REGEX = /^0x[0-9a-fA-F]{64}$/;

/**
 * Hash a passport number exactly as the Solidity contract does:
 *
 * keccak256(abi.encodePacked(passportNumber))
 *
 * Do not pass an already-hashed value here.
 */
const hashPassportNumber = (passportNumber) => {
  if (typeof passportNumber !== 'string') {
    throw new TypeError('Passport number must be a string');
  }

  if (passportNumber.trim().length === 0) {
    throw new Error('Passport number cannot be empty');
  }

  // Intentionally hash the original string, without trimming or
  // changing its case, to preserve Solidity hashing compatibility.
  return ethers.keccak256(ethers.toUtf8Bytes(passportNumber));
};

/**
 * merkletreejs expects a hash function that returns a Buffer.
 * ethers.keccak256 returns a hex string, so convert it to bytes.
 */
const keccak256Buffer = (data) => {
  return Buffer.from(
    ethers.getBytes(ethers.keccak256(data))
  );
};

const assertBytes32 = (value, fieldName) => {
  if (typeof value !== 'string' || !BYTES32_REGEX.test(value)) {
    throw new Error(`${fieldName} must be a valid bytes32 hex string`);
  }
};

/**
 * Generate a random bytes32 batch ID.
 * The ID is used as the on-chain Merkle batch identifier.
 */
const generateBatchId = () => {
  return ethers.hexlify(randomBytes(32));
};

/**
 * Build a Merkle tree from passport hashes.
 *
 * Important:
 * - Leaves are the passport hashes directly.
 * - hashLeaves is false: do not hash leaves a second time.
 * - sortPairs is true: matches OpenZeppelin MerkleProof.
 * - Duplicate passport hashes are rejected.
 *
 * @param {string[]} passportNumbers
 * @returns {{
 *   batchId: string,
 *   merkleRoot: string,
 *   passportCount: number,
 *   passports: Array<{
 *     passportNumber: string,
 *     passportHash: string,
 *     proof: string[]
 *   }>
 * }}
 */
const buildMerkleBatch = (passportNumbers) => {
  if (!Array.isArray(passportNumbers) || passportNumbers.length === 0) {
    throw new Error('At least one passport number is required');
  }

  const passports = passportNumbers.map((passportNumber) => ({
    passportNumber,
    passportHash: hashPassportNumber(passportNumber),
  }));

  // Detect duplicates using the exact hash that will be used as a leaf.
  const seenHashes = new Set();

  for (const passport of passports) {
    const normalizedHash = passport.passportHash.toLowerCase();

    if (seenHashes.has(normalizedHash)) {
      throw new Error(
        `Duplicate passport number in batch: ${passport.passportNumber}`
      );
    }

    seenHashes.add(normalizedHash);
  }

  const leaves = passports.map((passport) =>
    Buffer.from(ethers.getBytes(passport.passportHash))
  );

  const tree = new MerkleTree(leaves, keccak256Buffer, {
    sortPairs: true,
    hashLeaves: false,
  });

  const merkleRoot = tree.getHexRoot();

  if (!BYTES32_REGEX.test(merkleRoot)) {
    throw new Error('Failed to generate a valid Merkle root');
  }

  const passportsWithProofs = passports.map((passport) => {
    const leaf = Buffer.from(
      ethers.getBytes(passport.passportHash)
    );

    const proof = tree.getHexProof(leaf);

    // Fail early if the generated proof does not validate locally.
    const isValid = tree.verify(
      proof,
      leaf,
      Buffer.from(ethers.getBytes(merkleRoot))
    );

    if (!isValid) {
      throw new Error(
        `Generated Merkle proof is invalid for ${passport.passportNumber}`
      );
    }

    return {
      ...passport,
      proof,
    };
  });

  return {
    batchId: generateBatchId(),
    merkleRoot,
    passportCount: passportsWithProofs.length,
    passports: passportsWithProofs,
  };
};

/**
 * Verify a passport hash and proof locally, using the same hashing
 * configuration as buildMerkleBatch().
 *
 * This does not query the blockchain. On-chain verification will be
 * integrated in a later phase.
 */
const verifyPassportProof = ({ passportHash, merkleRoot, proof }) => {
  assertBytes32(passportHash, 'passportHash');
  assertBytes32(merkleRoot, 'merkleRoot');

  if (!Array.isArray(proof)) {
    throw new TypeError('Proof must be an array');
  }

  for (const proofElement of proof) {
    assertBytes32(proofElement, 'proof element');
  }

  const leaf = Buffer.from(ethers.getBytes(passportHash));
  const root = Buffer.from(ethers.getBytes(merkleRoot));

  return MerkleTree.verify(
    proof,
    leaf,
    root,
    keccak256Buffer,
    { sortPairs: true }
  );
};

module.exports = {
  hashPassportNumber,
  generateBatchId,
  buildMerkleBatch,
  verifyPassportProof,
};
