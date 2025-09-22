// src/providers/solana.ts - Updated without isTestnet

import {
  PostMessageRequest,
  PostMessageResponse,
  SOLANA_METHODS,
  CONNECTION_METHODS,
  CHAIN_IDS,
  ErrorCode,
  ProviderError,
  isErrorResponse,
  createPostMessageRequest,
} from '../types';
import { openPopup } from '../utils';
import {
  requestWalletConnection,
  extractAccountsForNamespace,
  extractChainForNamespace,
  ConnectionResult,
} from '../utils/connection';
import { Transaction, VersionedTransaction, SendOptions } from '@solana/web3.js';
import bs58 from 'bs58';
import {
  serializeBase64SolanaTransaction,
  deserializeBase64SolanaTransaction,
} from '../utils/serialization';

// All supported Solana chains
const ALL_SOLANA_CHAINS = [CHAIN_IDS.SOLANA_MAINNET, CHAIN_IDS.SOLANA_TESTNET];

export class SolanaProvider {
  private _targetWalletUrl: string;
  private _targetWalletOrigin: string;
  private _connected: boolean = false;
  private _publicKey: string | null = null;
  private _accounts: string[] = [];
  private _supportedChains: string[] = [];
  private _currentChain: string = CHAIN_IDS.SOLANA_MAINNET;
  private _eventListeners: { [event: string]: Function[] } = {};
  private _connectionResult: ConnectionResult | null = null;

  constructor(targetWalletUrl: string) {
    this._targetWalletUrl = targetWalletUrl;
    this._targetWalletOrigin = new URL(targetWalletUrl).origin;
  }

  /**
   * Connect to wallet - requests both mainnet and testnet
   */
  async connect(): Promise<string> {
    try {
      const namespaces = {
        solana: {
          chains: ALL_SOLANA_CHAINS,
          methods: Object.values(SOLANA_METHODS),
          events: ['connect', 'disconnect'],
        },
      };

      const result = await requestWalletConnection(this._targetWalletUrl, namespaces);

      this._connectionResult = result;
      this._accounts = extractAccountsForNamespace(result, 'solana');
      if (!this._accounts.length) {
        throw new ProviderError(ErrorCode.UNAUTHORIZED, 'No Solana accounts available');
      }

      // Use first account as primary
      this._publicKey = this._accounts[0];

      // Store supported chains (inferred from response)
      this._supportedChains = ALL_SOLANA_CHAINS;

      // Use wallet's active chain if provided
      const activeChain = extractChainForNamespace(result, 'solana');
      if (activeChain && this._supportedChains.includes(activeChain)) {
        this._currentChain = activeChain;
      }

      this._connected = true;
      this._emit('connect', this._publicKey);

      return this._publicKey;
    } catch (error) {
      this._connected = false;
      this._publicKey = null;
      this._accounts = [];
      throw error;
    }
  }

  /**
   * Disconnect from wallet
   */
  async disconnect(): Promise<void> {
    if (this._connected) {
      this._connected = false;
      this._publicKey = null;
      this._accounts = [];
      this._emit('disconnect');
    }
  }

  /**
   * Check connection status
   */
  isConnected(): boolean {
    return this._connected;
  }

  /**
   * Get public key
   */
  getPublicKey(): string | null {
    return this._publicKey;
  }

  /**
   * Get all connected accounts
   */
  getAccounts(): string[] {
    return this._accounts;
  }

  /**
   * Sign a message
   */
  async signMessage(message: Uint8Array | string): Promise<string> {
    if (!this._connected || !this._publicKey) {
      throw new ProviderError(ErrorCode.DISCONNECTED, 'Not connected');
    }

    // Convert message to base58 if it's Uint8Array
    let encodedMessage: string;
    if (message instanceof Uint8Array) {
      encodedMessage = bs58.encode(message);
    } else {
      encodedMessage = message;
    }

    const result = await this._makeSigningRequest(
      SOLANA_METHODS.SOLANA_SIGN_MESSAGE,
      [
        {
          message: encodedMessage,
          pubkey: this._publicKey,
        },
      ],
      this._currentChain
    );
    if (!result || typeof result.signature !== 'string') {
      throw new ProviderError(ErrorCode.INTERNAL_ERROR, 'Invalid response: missing signature');
    }
    return result.signature;
  }

  /**
   * Sign a transaction
   */
  async signTransaction(
    transaction: Transaction | VersionedTransaction
  ): Promise<Transaction | VersionedTransaction> {
    if (!this._connected || !this._publicKey) {
      throw new ProviderError(ErrorCode.DISCONNECTED, 'Not connected');
    }
    // Serialize transaction
    const serialized = serializeBase64SolanaTransaction(transaction);
    const result = await this._makeSigningRequest(
      SOLANA_METHODS.SOLANA_SIGN_TRANSACTION,
      [
        {
          transaction: serialized,
          pubkey: this._publicKey,
        },
      ],
      this._currentChain
    );
    if (!result || typeof result.transaction !== 'string' || typeof result.signature !== 'string') {
      throw new ProviderError(ErrorCode.INTERNAL_ERROR, 'Invalid response: missing signature');
    }
    const deserializedTx = deserializeBase64SolanaTransaction(result.transaction);
    return deserializedTx;
  }

  /**
   * Sign multiple transactions
   */
  async signAllTransactions(
    transactions: (Transaction | VersionedTransaction)[]
  ): Promise<(Transaction | VersionedTransaction)[]> {
    if (!this._connected || !this._publicKey) {
      throw new ProviderError(ErrorCode.DISCONNECTED, 'Not connected');
    }
    // Serialize all transactions
    const serializedTransactions = transactions.map((tx) => {
      return serializeBase64SolanaTransaction(tx);
    });
    const result = await this._makeSigningRequest(
      SOLANA_METHODS.SOLANA_SIGN_ALL_TRANSACTIONS,
      [
        {
          transactions: serializedTransactions,
        },
      ],
      this._currentChain
    );
    if (!result || !Array.isArray(result.transactions)) {
      throw new ProviderError(
        ErrorCode.INTERNAL_ERROR,
        'Invalid response: missing transactions array'
      );
    }
    // Deserialize all signed transactions
    const deserializedTxs = result.transactions.map((tx: string) => {
      return deserializeBase64SolanaTransaction(tx);
    });
    return deserializedTxs;
  }

  /**
   * Sign and send a transaction
   */
  async signAndSendTransaction(
    transaction: Transaction | VersionedTransaction,
    sendOptions?: SendOptions
  ): Promise<string> {
    if (!this._connected || !this._publicKey) {
      throw new ProviderError(ErrorCode.DISCONNECTED, 'Not connected');
    }

    // Serialize transaction
    const serialized = serializeBase64SolanaTransaction(transaction);

    const result = await this._makeSigningRequest(
      SOLANA_METHODS.SOLANA_SIGN_AND_SEND_TRANSACTION,
      [
        {
          transaction: serialized,
          sendOptions,
        },
      ],
      this._currentChain
    );
    if (!result || typeof result.signature !== 'string') {
      throw new ProviderError(ErrorCode.INTERNAL_ERROR, 'Invalid response: missing signature');
    }
    return result.signature;
  }

  /**
   * Event handling
   */
  on(event: string, listener: Function): void {
    if (!this._eventListeners[event]) {
      this._eventListeners[event] = [];
    }
    this._eventListeners[event].push(listener);
  }

  off(event: string, listener: Function): void {
    if (!this._eventListeners[event]) return;
    this._eventListeners[event] = this._eventListeners[event].filter((l) => l !== listener);
  }

  private _emit(event: string, ...args: any[]): void {
    if (!this._eventListeners[event]) return;
    this._eventListeners[event].forEach((listener) => listener(...args));
  }

  /**
   * Generic signing request handler
   */
  private async _makeSigningRequest(method: string, params: any[], chainId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const popup = openPopup(this._targetWalletUrl);
      if (!popup) {
        reject(new ProviderError(ErrorCode.INTERNAL_ERROR, 'Failed to open popup'));
        return;
      }

      let requestSent = false;

      const handleMessage = (event: MessageEvent) => {
        if (event.origin !== this._targetWalletOrigin) return;

        const data = event.data;

        if (data?.type === 'READY' && !requestSent) {
          const request = createPostMessageRequest(method, params, chainId);
          popup.postMessage(request, this._targetWalletOrigin);
          requestSent = true;
        }

        if (data?.jsonrpc === '2.0' && data?.method === method) {
          cleanup();
          popup.close();

          const response = data as PostMessageResponse;
          if (isErrorResponse(response)) {
            reject(new ProviderError(response.error.code as ErrorCode, response.error.message));
          } else {
            resolve(response.result);
          }
        }
      };

      const handleClose = () => {
        cleanup();
        reject(new ProviderError(ErrorCode.USER_REJECTED, 'User closed popup'));
      };

      const cleanup = () => {
        clearInterval(windowChecker);
        window.removeEventListener('message', handleMessage);
      };

      const windowChecker = setInterval(() => {
        if (popup.closed) handleClose();
      }, 500);

      window.addEventListener('message', handleMessage);
    });
  }

  /**
   * Get current chain
   */
  getCurrentChain(): string {
    return this._currentChain;
  }

  /**
   * Get supported chains
   */
  getSupportedChains(): string[] {
    return this._supportedChains;
  }
}
