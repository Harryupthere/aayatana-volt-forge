const { ethers } = require('ethers');

const BYTES32_REGEX = /^0x[0-9a-fA-F]{64}$/;

// Accepts an already-computed 0x-prefixed bytes32 hex hash and returns it as-is,
// otherwise derives a bytes32 keccak256 hash from arbitrary input (string or object).
const toBytes32 = (input) => {
  if (typeof input === 'string' && BYTES32_REGEX.test(input)) return input;

  const text = typeof input === 'string' ? input : JSON.stringify(input);
  return ethers.keccak256(ethers.toUtf8Bytes(text));
};

module.exports = { toBytes32 };
