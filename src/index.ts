// src/index.ts - Main entry point for NewWallet SDK

import { EthereumProvider } from './providers/ethereum';
import { SolanaProvider } from './providers/solana';
import {
  // Types
  Network,
  PostMessageRequest,
  PostMessageResponse,

  // Method constants
  CONNECTION_METHODS,
  EIP155_METHODS,
  SOLANA_METHODS,

  // Chain IDs
  CHAIN_IDS,

  // Error handling
  ErrorCode,
  ProviderError,
  getErrorMessage,

  // Utility functions
  createPostMessageRequest,
  createSuccessResponse,
  createErrorResponse,
  parseWalletConnectChainId,
  toWalletConnectChainId,
  isConnectionMethod,
  getNamespaceFromMethod,
  buildRequiredNamespaces,
  isErrorResponse,
  isSuccessResponse,
} from './types';

/**
 * NewWallet SDK configuration options
 */
export interface NewWalletOptions {
  /** Custom wallet URL (defaults to https://newwallet.io/transaction_signing) */
  walletUrl?: string;
}

/**
 * Main NewWallet class
 * Provides access to all blockchain providers
 */
class NewWallet {
  /** Ethereum provider - handles Ethereum, BSC, and Base chains */
  readonly ethereum: EthereumProvider;

  /** Solana provider - handles Solana mainnet and testnet */
  readonly solana: SolanaProvider;

  private _walletUrl: string;

  constructor(options: NewWalletOptions = {}) {
    // Set wallet URL with default
    this._walletUrl = options.walletUrl || 'https://newwallet.io/transaction_signing';

    // Initialize providers
    this.ethereum = new EthereumProvider(this._walletUrl);
    this.solana = new SolanaProvider(this._walletUrl);
  }

  /**
   * Check if NewWallet is installed
   * Always returns true for web-based wallet
   */
  isInstalled(): boolean {
    return true;
  }

  /**
   * Get the wallet URL being used
   */
  getWalletUrl(): string {
    return this._walletUrl;
  }

  /**
   * Connect to Ethereum (convenience method)
   * Equivalent to: wallet.ethereum.request({ method: 'eth_requestAccounts' })
   */
  async connectEthereum(): Promise<string[]> {
    return this.ethereum.request({
      method: CONNECTION_METHODS.ETH_REQUEST_ACCOUNTS,
    });
  }

  /**
   * Connect to Solana (convenience method)
   * Equivalent to: wallet.solana.connect()
   */
  async connectSolana(): Promise<string> {
    return this.solana.connect();
  }
}

// Default export - main class
export default NewWallet;

// Named exports - all providers and utilities
export {
  // Providers
  EthereumProvider,
  SolanaProvider,

  // Types
  Network,
  PostMessageRequest,
  PostMessageResponse,

  // Method constants for direct usage
  CONNECTION_METHODS,
  EIP155_METHODS,
  SOLANA_METHODS,

  // Chain IDs for reference
  CHAIN_IDS,

  // Error handling
  ErrorCode,
  ProviderError,
  getErrorMessage,

  // Utility functions
  createPostMessageRequest,
  createSuccessResponse,
  createErrorResponse,
  parseWalletConnectChainId,
  toWalletConnectChainId,
  isConnectionMethod,
  getNamespaceFromMethod,
  buildRequiredNamespaces,
  isErrorResponse,
  isSuccessResponse,
};

// Re-export types from providers
export type { ConnectionResult } from './utils/connection';
