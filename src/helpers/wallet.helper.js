const { ethers } = require('ethers');
const { encrypt, decrypt } = require('./crypto.helper');
const ApiError = require('./ApiError.helper');

// Creates a brand-new custodial wallet. It holds 0 gas until funded.
const generateWallet = () => {
  const wallet = ethers.Wallet.createRandom();
  return { address: wallet.address, encryptedPk: encrypt(wallet.privateKey) };
};

// Imports an existing private key (e.g. an already-funded Amoy testnet wallet).
const importWallet = (privateKey) => {
  try {
    const wallet = new ethers.Wallet(privateKey);
    return { address: wallet.address, encryptedPk: encrypt(wallet.privateKey) };
  } catch (err) {
    throw new ApiError(400, `Invalid private key: ${err.message}`);
  }
};

// Decrypts encrypted_pk and returns a ready-to-use ethers Signer connected to `provider`.
const getSigner = (encryptedPk, provider) => new ethers.Wallet(decrypt(encryptedPk), provider);

module.exports = { generateWallet, importWallet, getSigner };
