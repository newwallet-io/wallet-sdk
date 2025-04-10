// Networks.js 
export const SUPPORTED_NETWORKS = {
    ETHEREUM_MAINNET: {
      networkName: "Ethereum",
      chainId: 1,
      coinType: 60,
      coin: "Ether",
      symbol: "ETH",
      rpcUrl: "https://ethereum-rpc.publicnode.com",
      blockExplorerSite: "https://etherscan.io",
      isTestnet: false,
    },
    ETHEREUM_SEPOLIA: {
      networkName: "Ethereum Sepolia",
      chainId: 11155111,
      coinType: 60,
      coin: "Ether",
      symbol: "ETH",
      rpcUrl: "https://ethereum-sepolia-rpc.publicnode.com",
      blockExplorerSite: "https://sepolia.etherscan.io",
      isTestnet: true,
    },
    SOLANA_MAINNET: {
      networkName: "Solana Mainnet Beta",
      chainId: 101,
      coinType: 501,
      coin: "Solana",
      symbol: "SOL",
      rpcUrl: "https://api.zan.top/public/solana-mainnet",
      blockExplorerSite: "https://solscan.io",
      isTestnet: false,
    },
    SOLANA_TESTNET: {
      networkName: "Solana Testnet",
      chainId: 102,
      coinType: 501,
      coin: "Solana",
      symbol: "SOL",
      rpcUrl: "https://api.testnet.solana.com",
      blockExplorerSite: "https://solscan.io/?cluster=testnet",
      isTestnet: true,
    },
  };
  
  // Helper functions to get network information
  export const getEthereumNetworkByChainId = (chainId) => {
    return Object.values(SUPPORTED_NETWORKS).find(
      network => network.coinType === 60 && parseInt(chainId, 16) === network.chainId
    );
  };
  
  export const getSolanaNetwork = (isTestnet) => {
    return isTestnet ? SUPPORTED_NETWORKS.SOLANA_TESTNET : SUPPORTED_NETWORKS.SOLANA_MAINNET;
  };
  
  // Wallet connection URLs
  export const WALLET_URLS = {
    localhost: 'http://localhost:3002',
    testnet: 'https://testnet.newwallet.io/transaction_signing',
    mainnet: 'https://newwallet.io/transaction_signing'
  };
  
  // Default wallet URL
  export const DEFAULT_WALLET_URL = WALLET_URLS.testnet;