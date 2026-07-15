const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');
const ApiError = require('../helpers/ApiError.helper');

let provider;
let contractAbi;

// Lazily initialized so the API can boot and serve non-blockchain routes even
// before POLYGON_AMOY_RPC_URL / CONTRACT_ADDRESS are configured.
const getProvider = () => {
  if (provider) return provider;

  if (!process.env.POLYGON_AMOY_RPC_URL) {
    throw new ApiError(500, 'POLYGON_AMOY_RPC_URL is not configured');
  }

  provider = new ethers.JsonRpcProvider(process.env.POLYGON_AMOY_RPC_URL, {
    chainId: Number(process.env.CHAIN_ID) || 80002,
    name: 'polygon-amoy',
  });
  return provider;
};

const getContractAbi = () => {
  if (contractAbi) return contractAbi;

  const abiPath = path.resolve(process.cwd(), process.env.CONTRACT_ABI_PATH || './src/contracts/VoltForgeOS.abi.json');
  contractAbi = JSON.parse(fs.readFileSync(abiPath, 'utf-8'));
  return contractAbi;
};

// Pass an ethers Signer to write to the chain, or omit/pass the provider for read-only calls.
const getContract = (signerOrProvider) => {
  if (!process.env.CONTRACT_ADDRESS) {
    throw new ApiError(500, 'CONTRACT_ADDRESS is not configured');
  }

  return new ethers.Contract(process.env.CONTRACT_ADDRESS, getContractAbi(), signerOrProvider || getProvider());
};

module.exports = { getProvider, getContractAbi, getContract };
