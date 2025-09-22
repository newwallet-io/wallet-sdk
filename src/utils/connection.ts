// src/utils/connection.ts - Shared connection utilities for WalletConnect standard

import {
  PostMessageRequest,
  PostMessageResponse,
  CONNECTION_METHODS,
  EIP155_METHODS,
  SOLANA_METHODS,
  CHAIN_IDS,
  ErrorCode,
  ProviderError,
  isErrorResponse,
  createPostMessageRequest,
} from '../types';
import { openPopup } from './index';

/**
 * Connection result from wallet
 */
export interface ConnectionResult {
  accounts: { [namespace: string]: string[] };
  chains: { [namespace: string]: string };
  methods: string[];
}

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
 * Request wallet connection with WalletConnect standard
 */
export async function requestWalletConnection(
  walletUrl: string,
  requiredNamespaces: any
): Promise<ConnectionResult> {
  return new Promise((resolve, reject) => {
    const popup = openPopup(walletUrl);
    if (!popup) {
      reject(new ProviderError(ErrorCode.INTERNAL_ERROR, 'Failed to open popup'));
      return;
    }

    let isReady = false;
    let requestSent = false;

    const handleMessage = (event: MessageEvent) => {
      // Security: Check origin
      const walletOrigin = new URL(walletUrl).origin;
      if (event.origin !== walletOrigin) return;

      const data = event.data;

      // Handle READY message
      if (data?.type === 'READY' && !requestSent) {
        isReady = true;

        // Create connection request
        const request = createPostMessageRequest(
          CONNECTION_METHODS.WALLET_REQUEST_CONNECTION,
          undefined, // No params for connection
          undefined, // No chainId for connection
          requiredNamespaces
        );

        // Send to wallet
        popup.postMessage(request, walletOrigin);
        requestSent = true;
        return;
      }

      // Handle connection response (JSON-RPC format)
      if (
        data?.jsonrpc === '2.0' &&
        data?.method === CONNECTION_METHODS.WALLET_REQUEST_CONNECTION
      ) {
        cleanup();
        popup.close();

        const response = data as PostMessageResponse;

        if (isErrorResponse(response)) {
          const error = response.error;
          reject(
            new ProviderError((error.code as ErrorCode) || ErrorCode.UNKNOWN_ERROR, error.message)
          );
        } else {
          // Success - extract accounts and chains
          const result = response.result as ConnectionResult;
          resolve(result);
        }
      }
    };

    const handleClose = () => {
      cleanup();
      if (!requestSent) {
        reject(new ProviderError(ErrorCode.USER_REJECTED, 'User closed the wallet window'));
      }
    };

    const cleanup = () => {
      clearInterval(windowChecker);
      window.removeEventListener('message', handleMessage);
    };

    // Check if popup is closed
    const windowChecker = setInterval(() => {
      if (popup.closed) handleClose();
    }, 500);

    // Listen for messages
    window.addEventListener('message', handleMessage);

    // Timeout if wallet doesn't respond
    setTimeout(() => {
      if (!isReady) {
        cleanup();
        popup.close();
        reject(new ProviderError(ErrorCode.INTERNAL_ERROR, 'Wallet did not respond'));
      }
    }, 10000); // 10 second timeout
  });
}

/**
 * Extract accounts for a specific namespace
 */
export function extractAccountsForNamespace(
  connectionResult: ConnectionResult,
  namespace: 'eip155' | 'solana'
): string[] {
  return connectionResult.accounts[namespace] || [];
}

/**
 * Extract chain ID for a specific namespace
 */
export function extractChainForNamespace(
  connectionResult: ConnectionResult,
  namespace: 'eip155' | 'solana'
): string | null {
  return connectionResult.chains?.[namespace] || null; // Add optional chaining
}
/**
 * Convert chain ID to hex for Ethereum compatibility
 */
export function chainIdToHex(chainId: string): string {
  const [namespace, reference] = chainId.split(':');

  if (namespace === 'eip155') {
    const numericId = parseInt(reference);
    return '0x' + numericId.toString(16);
  }

  // For non-EVM chains, return as-is
  return chainId;
}
