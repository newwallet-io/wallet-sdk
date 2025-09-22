// src/types/index.ts - Complete rewrite for WalletConnect standard

// ============================================
// WalletConnect Standard Method Names
// ============================================

// Connection methods
export const CONNECTION_METHODS = {
  WALLET_REQUEST_CONNECTION: 'wallet_requestConnection',
  ETH_REQUEST_ACCOUNTS: 'eth_requestAccounts',
  WALLET_REQUEST_PERMISSIONS: 'wallet_requestPermissions',
  WALLET_SWITCH_ETHEREUM_CHAIN: 'wallet_switchEthereumChain',
} as const;

// EIP155 (Ethereum, BSC, Base) methods
export const EIP155_METHODS = {
  PERSONAL_SIGN: 'personal_sign',
  ETH_SIGN_TRANSACTION: 'eth_signTransaction',
  ETH_SIGN_TYPED_DATA: 'eth_signTypedData',
  ETH_SIGN_TYPED_DATA_V3: 'eth_signTypedData_v3',
  ETH_SIGN_TYPED_DATA_V4: 'eth_signTypedData_v4',
  ETH_SEND_TRANSACTION: 'eth_sendTransaction',
  ETH_CHAIN_ID: 'eth_chainId',
  ETH_ACCOUNTS: 'eth_accounts',
} as const;

// Solana methods
export const SOLANA_METHODS = {
  SOLANA_SIGN_MESSAGE: 'solana_signMessage',
  SOLANA_SIGN_TRANSACTION: 'solana_signTransaction',
  SOLANA_SIGN_ALL_TRANSACTIONS: 'solana_signAllTransactions',
  SOLANA_SIGN_AND_SEND_TRANSACTION: 'solana_signAndSendTransaction',
} as const;

// ============================================
// Chain IDs (WalletConnect format)
// ============================================

export const CHAIN_IDS = {
  // EIP155 chains
  ETHEREUM_MAINNET: 'eip155:1',
  ETHEREUM_SEPOLIA: 'eip155:11155111',
  BSC_MAINNET: 'eip155:56',
  BSC_TESTNET: 'eip155:97',
  BASE_MAINNET: 'eip155:8453',
  BASE_SEPOLIA: 'eip155:84532',

  // Solana chains
  SOLANA_MAINNET: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
  SOLANA_TESTNET: 'solana:4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z',
} as const;

// ============================================
// PostMessage Format (matching NewWallet)
// ============================================

/**
 * PostMessage request format following WalletConnect standard
 */
export interface PostMessageRequest {
  // Standard fields
  method: string; // WalletConnect method name
  params?: any; // Method parameters
  chainId?: string; // Chain ID for signing (e.g., 'eip155:1')

  // Connection specific
  requiredNamespaces?: {
    [key: string]: {
      chains?: string[];
      methods?: string[];
      events?: string[];
    };
  };

  // Metadata
  origin: string; // dApp origin
  timestamp?: number; // Request timestamp
  id?: string | number; // Request ID
}

/**
 * PostMessage response format (JSON-RPC 2.0)
 */
export interface PostMessageResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: any; // Success result
  error?: {
    // Error result
    code: number;
    message: string;
    data?: any;
  };
  method?: string; // Include method for clarity
}

// ============================================
// Chain Utilities
// ============================================

/**
 * Network types used internally
 */
export enum Network {
  ETHEREUM = 'ethereum',
  BSC = 'bsc',
  BASE = 'base',
  SOLANA = 'solana',
}

/**
 * Convert network and chain info to WalletConnect format
 */
export function toWalletConnectChainId(network: Network, isTestnet: boolean = false): string {
  switch (network) {
    case Network.ETHEREUM:
      return isTestnet ? CHAIN_IDS.ETHEREUM_SEPOLIA : CHAIN_IDS.ETHEREUM_MAINNET;
    case Network.BSC:
      return isTestnet ? CHAIN_IDS.BSC_TESTNET : CHAIN_IDS.BSC_MAINNET;
    case Network.BASE:
      return isTestnet ? CHAIN_IDS.BASE_SEPOLIA : CHAIN_IDS.BASE_MAINNET;
    case Network.SOLANA:
      return isTestnet ? CHAIN_IDS.SOLANA_TESTNET : CHAIN_IDS.SOLANA_MAINNET;
    default:
      throw new Error(`Unknown network: ${network}`);
  }
}

/**
 * Parse WalletConnect chain ID
 */
export function parseWalletConnectChainId(chainId: string): {
  namespace: string;
  reference: string;
  network?: Network;
} {
  const [namespace, reference] = chainId.split(':');

  let network: Network | undefined;

  if (namespace === 'eip155') {
    const chainNum = parseInt(reference);
    if (chainNum === 1 || chainNum === 11155111) {
      network = Network.ETHEREUM;
    } else if (chainNum === 56 || chainNum === 97) {
      network = Network.BSC;
    } else if (chainNum === 8453 || chainNum === 84532) {
      network = Network.BASE;
    }
  } else if (namespace === 'solana') {
    network = Network.SOLANA;
  }

  return { namespace, reference, network };
}

/**
 * Check if method is for connection
 */
export function isConnectionMethod(method: string): boolean {
  return Object.values(CONNECTION_METHODS).includes(method as any);
}

/**
 * Get namespace from method
 */
export function getNamespaceFromMethod(method: string): 'eip155' | 'solana' | 'unknown' {
  if (
    Object.values(EIP155_METHODS).includes(method as any) ||
    method.startsWith('eth_') ||
    method === 'personal_sign'
  ) {
    return 'eip155';
  }
  if (Object.values(SOLANA_METHODS).includes(method as any) || method.startsWith('solana_')) {
    return 'solana';
  }
  return 'unknown';
}

// ============================================
// Errors (Keep standard error codes)
// ============================================

export enum ErrorCode {
  // User interaction errors
  USER_REJECTED = 4001,
  UNAUTHORIZED = 4100,
  UNSUPPORTED_METHOD = 4200,
  DISCONNECTED = 4900,

  // Standard JSON-RPC errors
  PARSE_ERROR = -32700,
  INVALID_REQUEST = -32600,
  METHOD_NOT_FOUND = -32601,
  INVALID_PARAMS = -32602,
  INTERNAL_ERROR = -32603,

  // Application errors
  INVALID_INPUT = -32000,
  RESOURCE_NOT_FOUND = -32001,
  RESOURCE_UNAVAILABLE = -32002,
  TRANSACTION_REJECTED = -32003,
  METHOD_NOT_SUPPORTED = -32004,
  LIMIT_EXCEEDED = -32005,
  VERSION_NOT_SUPPORTED = -32006,

  UNKNOWN_ERROR = -1,
}

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  [ErrorCode.USER_REJECTED]: 'User rejected the request',
  [ErrorCode.UNAUTHORIZED]: 'The requested method and/or account has not been authorized',
  [ErrorCode.UNSUPPORTED_METHOD]: 'The requested method is not supported',
  [ErrorCode.DISCONNECTED]: 'The provider is disconnected',
  [ErrorCode.PARSE_ERROR]: 'Invalid JSON was received',
  [ErrorCode.INVALID_REQUEST]: 'The JSON sent is not a valid request object',
  [ErrorCode.METHOD_NOT_FOUND]: 'The method does not exist',
  [ErrorCode.INVALID_PARAMS]: 'Invalid method parameter(s)',
  [ErrorCode.INTERNAL_ERROR]: 'Internal JSON-RPC error',
  [ErrorCode.INVALID_INPUT]: 'Missing or invalid parameters',
  [ErrorCode.RESOURCE_NOT_FOUND]: 'Requested resource not found',
  [ErrorCode.RESOURCE_UNAVAILABLE]: 'Requested resource not available',
  [ErrorCode.TRANSACTION_REJECTED]: 'Transaction creation failed',
  [ErrorCode.METHOD_NOT_SUPPORTED]: 'Method is not implemented',
  [ErrorCode.LIMIT_EXCEEDED]: 'Request exceeds defined limit',
  [ErrorCode.VERSION_NOT_SUPPORTED]: 'Version not supported',
  [ErrorCode.UNKNOWN_ERROR]: 'Unknown error',
};

export function getErrorMessage(code: ErrorCode, customMessage?: string): string {
  return customMessage || ERROR_MESSAGES[code] || ERROR_MESSAGES[ErrorCode.UNKNOWN_ERROR];
}

export class ProviderError extends Error {
  code: ErrorCode;
  data?: unknown;

  constructor(code: ErrorCode, message?: string, data?: unknown) {
    super(getErrorMessage(code, message));
    this.code = code;
    this.data = data;
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, ProviderError.prototype);
  }
}

// ============================================
// Helper Functions for Message Creation
// ============================================

/**
 * Build required namespaces for connection request
 * Always requests BOTH mainnet and testnet chains
 */
export function buildRequiredNamespaces(networks: ('ethereum' | 'solana' | 'bsc' | 'base')[]): any {
  const namespaces: any = {};

  // Process EVM networks - always include both mainnet and testnet
  const evmNetworks = networks.filter((n) => n !== 'solana');
  if (evmNetworks.length > 0) {
    const chains: string[] = [];

    evmNetworks.forEach((network) => {
      switch (network) {
        case 'ethereum':
          chains.push(CHAIN_IDS.ETHEREUM_MAINNET, CHAIN_IDS.ETHEREUM_SEPOLIA);
          break;
        case 'bsc':
          chains.push(CHAIN_IDS.BSC_MAINNET, CHAIN_IDS.BSC_TESTNET);
          break;
        case 'base':
          chains.push(CHAIN_IDS.BASE_MAINNET, CHAIN_IDS.BASE_SEPOLIA);
          break;
      }
    });

    // Add all EIP155 methods
    const methods = [...Object.values(EIP155_METHODS), 'eth_accounts', 'eth_chainId'];

    namespaces.eip155 = {
      chains,
      methods,
      events: ['chainChanged', 'accountsChanged'],
    };
  }

  // Process Solana - always include both mainnet and testnet
  if (networks.includes('solana')) {
    namespaces.solana = {
      chains: [CHAIN_IDS.SOLANA_MAINNET, CHAIN_IDS.SOLANA_TESTNET],
      methods: Object.values(SOLANA_METHODS),
      events: ['connect', 'disconnect'],
    };
  }

  return namespaces;
}

/**
 * Create a PostMessage request
 */
export function createPostMessageRequest(
  method: string,
  params?: any,
  chainId?: string,
  requiredNamespaces?: any
): PostMessageRequest {
  return {
    method,
    params,
    chainId,
    requiredNamespaces,
    origin: window.location.origin,
    timestamp: Date.now(),
    id: Date.now(),
  };
}

/**
 * Create a PostMessage response (success)
 */
export function createSuccessResponse(
  id: string | number,
  result: any,
  method?: string
): PostMessageResponse {
  return {
    jsonrpc: '2.0',
    id,
    result,
    method,
  };
}

/**
 * Create a PostMessage response (error)
 */
export function createErrorResponse(
  id: string | number,
  code: ErrorCode,
  message?: string,
  data?: any,
  method?: string
): PostMessageResponse {
  return {
    jsonrpc: '2.0',
    id,
    error: {
      code,
      message: getErrorMessage(code, message),
      data,
    },
    method,
  };
}

// ============================================
// Type Guards
// ============================================

/**
 * Check if response is an error
 */
export function isErrorResponse(
  response: PostMessageResponse
): response is PostMessageResponse & { error: NonNullable<PostMessageResponse['error']> } {
  return 'error' in response && response.error !== undefined;
}

/**
 * Check if response is successful
 */
export function isSuccessResponse(
  response: PostMessageResponse
): response is PostMessageResponse & { result: any } {
  return 'result' in response && !isErrorResponse(response);
}
