// src/providers/ethereum.ts - Complete implementation for all EVM chains

import {
  PostMessageRequest,
  PostMessageResponse,
  EIP155_METHODS,
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
  chainIdToHex,
  ConnectionResult,
} from '../utils/connection';
import { ethers } from 'ethers';

// All supported EVM chains
const ALL_EVM_CHAINS = [
  CHAIN_IDS.ETHEREUM_MAINNET,
  CHAIN_IDS.ETHEREUM_SEPOLIA,
  CHAIN_IDS.BSC_MAINNET,
  CHAIN_IDS.BSC_TESTNET,
  CHAIN_IDS.BASE_MAINNET,
  CHAIN_IDS.BASE_SEPOLIA,
];

export class EthereumProvider {
  private _targetWalletUrl: string;
  private _targetWalletOrigin: string;
  private _connected: boolean = false;
  private _accountsByChain: { [chainId: string]: string[] } = {};
  private _supportedChains: string[] = [];
  private _currentChainId: string = CHAIN_IDS.ETHEREUM_MAINNET;
  private _currentChainIdHex: string = '0x1';
  private _eventListeners: { [event: string]: Function[] } = {};
  private _connectionResult: ConnectionResult | null = null;

  constructor(targetWalletUrl: string) {
    this._targetWalletUrl = targetWalletUrl;
    this._targetWalletOrigin = new URL(targetWalletUrl).origin;
  }

  /**
   * Get accounts for current chain
   */
  private get _accounts(): string[] {
    return this._accountsByChain[this._currentChainId] || [];
  }

  /**
   * Connect to all EVM chains
   */
  private async _connect(): Promise<string[]> {
    try {
      const namespaces = {
        eip155: {
          chains: ALL_EVM_CHAINS,
          methods: [...Object.values(EIP155_METHODS), 'eth_accounts', 'eth_chainId'],
          events: ['chainChanged', 'accountsChanged'],
        },
      };

      const result = await requestWalletConnection(this._targetWalletUrl, namespaces);

      this._connectionResult = result;

      // Parse accounts by chain
      const allAccounts = extractAccountsForNamespace(result, 'eip155');
      this._accountsByChain = {};

      // Accounts come as 'eip155:1:0x123...', 'eip155:56:0x456...'
      allAccounts.forEach((accountStr) => {
        const parts = accountStr.split(':');
        if (parts.length >= 3) {
          const chainId = `${parts[0]}:${parts[1]}`; // 'eip155:1'
          const address = parts.slice(2).join(':'); // '0x123...'

          if (!this._accountsByChain[chainId]) {
            this._accountsByChain[chainId] = [];
          }
          this._accountsByChain[chainId].push(address);
        }
      });
      // Store supported chains
      // this._supportedChains = result.supportedChains || ALL_EVM_CHAINS;
      this._supportedChains = ALL_EVM_CHAINS;

      // Use wallet's active chain if provided
      const activeChain = extractChainForNamespace(result, 'eip155');
      if (activeChain && this._supportedChains.includes(activeChain)) {
        this._currentChainId = activeChain;
        this._currentChainIdHex = chainIdToHex(activeChain);
      }

      // Check if we have accounts for current chain
      if (!this._accounts.length) {
        throw new ProviderError(ErrorCode.UNAUTHORIZED, 'No accounts available for current chain');
      }

      this._connected = true;

      this._emit('accountsChanged', this._accounts);
      this._emit('chainChanged', this._currentChainIdHex);

      return this._accounts;
    } catch (error) {
      this._connected = false;
      this._accountsByChain = {};
      throw error;
    }
  }

  /**
   * Switch chain - updates current accounts too
   */
  private async _switchChain(params: { chainId: string }): Promise<null> {
    if (!this._connected) {
      throw new ProviderError(ErrorCode.DISCONNECTED, 'Not connected');
    }

    const requestedChainHex = params.chainId;
    const requestedChainNum = parseInt(requestedChainHex, 16);
    const requestedChainWC = `eip155:${requestedChainNum}`;

    if (!this._supportedChains.includes(requestedChainWC)) {
      throw new ProviderError(ErrorCode.INVALID_PARAMS, `Chain ${requestedChainHex} not supported`);
    }

    const previousAccounts = this._accounts;

    this._currentChainId = requestedChainWC;
    this._currentChainIdHex = requestedChainHex;

    // Emit chainChanged event
    this._emit('chainChanged', this._currentChainIdHex);

    // If accounts changed, emit accountsChanged
    const newAccounts = this._accounts;
    if (JSON.stringify(previousAccounts) !== JSON.stringify(newAccounts)) {
      this._emit('accountsChanged', newAccounts);
    }

    return null;
  }

  /**
   * Personal sign - validates against current chain's accounts
   */
  private async _signMessage(message: string, from: string): Promise<string> {
    if (!this._connected) {
      throw new ProviderError(ErrorCode.DISCONNECTED, 'Not connected');
    }

    if (!this._accounts.includes(from)) {
      throw new ProviderError(
        ErrorCode.UNAUTHORIZED,
        `Account ${from} not available on chain ${this._currentChainId}`
      );
    }

    return this._makeSigningRequest(
      EIP155_METHODS.PERSONAL_SIGN,
      [message, from],
      this._currentChainId
    );
  }

  /**
   * Sign transaction
   */
  private async _signTransaction(tx: ethers.TransactionRequest): Promise<string> {
    if (!this._connected) {
      throw new ProviderError(ErrorCode.DISCONNECTED, 'Not connected');
    }

    const from = tx.from?.toString();
    if (!from || !this._accounts.includes(from)) {
      throw new ProviderError(ErrorCode.UNAUTHORIZED, 'From address not connected');
    }

    const plainTx = this._transactionToPlainObject(tx);
    return this._makeSigningRequest(
      EIP155_METHODS.ETH_SIGN_TRANSACTION,
      [plainTx],
      this._currentChainId
    );
  }

  /**
   * Send transaction
   */
  private async _sendTransaction(tx: ethers.TransactionRequest): Promise<string> {
    if (!this._connected) {
      throw new ProviderError(ErrorCode.DISCONNECTED, 'Not connected');
    }

    const from = tx.from?.toString();
    if (!from || !this._accounts.includes(from)) {
      throw new ProviderError(ErrorCode.UNAUTHORIZED, 'From address not connected');
    }

    const plainTx = this._transactionToPlainObject(tx);
    return this._makeSigningRequest(
      EIP155_METHODS.ETH_SEND_TRANSACTION,
      [plainTx],
      this._currentChainId
    );
  }

  /**
   * Sign typed data
   */
  private async _signTypedData(method: string, from: string, data: any): Promise<string> {
    if (!this._connected) {
      throw new ProviderError(ErrorCode.DISCONNECTED, 'Not connected');
    }

    if (!this._accounts.includes(from)) {
      throw new ProviderError(ErrorCode.UNAUTHORIZED, 'Account not connected');
    }

    return this._makeSigningRequest(method, [from, data], this._currentChainId);
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
   * Main request method - EIP-1193 compatible
   */
  async request(args: { method: string; params?: any[] }): Promise<any> {
    const { method, params } = args;

    switch (method) {
      // Connection
      case CONNECTION_METHODS.ETH_REQUEST_ACCOUNTS:
        return this._connect();

      // Account methods
      case EIP155_METHODS.ETH_ACCOUNTS:
        return this._accounts;

      // Chain methods
      case EIP155_METHODS.ETH_CHAIN_ID:
        return this._currentChainIdHex;

      case CONNECTION_METHODS.WALLET_SWITCH_ETHEREUM_CHAIN:
        if (!params || params.length < 1) {
          throw new ProviderError(ErrorCode.INVALID_PARAMS, 'chainId required');
        }
        return this._switchChain(params[0]);

      // Signing methods
      case EIP155_METHODS.PERSONAL_SIGN:
        if (!params || params.length < 2) {
          throw new ProviderError(ErrorCode.INVALID_PARAMS, 'message and address required');
        }
        return this._signMessage(params[0], params[1]);

      case EIP155_METHODS.ETH_SIGN_TRANSACTION:
        if (!params || params.length < 1) {
          throw new ProviderError(ErrorCode.INVALID_PARAMS, 'transaction required');
        }
        return this._signTransaction(params[0]);

      case EIP155_METHODS.ETH_SEND_TRANSACTION:
        if (!params || params.length < 1) {
          throw new ProviderError(ErrorCode.INVALID_PARAMS, 'transaction required');
        }
        return this._sendTransaction(params[0]);

      case EIP155_METHODS.ETH_SIGN_TYPED_DATA:
      case EIP155_METHODS.ETH_SIGN_TYPED_DATA_V3:
      case EIP155_METHODS.ETH_SIGN_TYPED_DATA_V4:
        if (!params || params.length < 2) {
          throw new ProviderError(ErrorCode.INVALID_PARAMS, 'address and data required');
        }
        return this._signTypedData(method, params[0], params[1]);

      default:
        throw new ProviderError(ErrorCode.UNSUPPORTED_METHOD, `Method not supported: ${method}`);
    }
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
   * Convert transaction to plain object
   */
  private _transactionToPlainObject(tx: ethers.TransactionRequest): Record<string, any> {
    const plainTx: Record<string, any> = {};

    if (tx.from) plainTx.from = tx.from.toString();
    if (tx.to) plainTx.to = tx.to.toString();
    if (tx.value) plainTx.value = tx.value.toString();
    if (tx.data) plainTx.data = tx.data;
    if (tx.nonce !== undefined) plainTx.nonce = tx.nonce;
    if (tx.gasLimit) plainTx.gasLimit = tx.gasLimit.toString();
    if (tx.gasPrice) plainTx.gasPrice = tx.gasPrice.toString();
    if (tx.maxFeePerGas) plainTx.maxFeePerGas = tx.maxFeePerGas.toString();
    if (tx.maxPriorityFeePerGas) plainTx.maxPriorityFeePerGas = tx.maxPriorityFeePerGas.toString();
    if (tx.chainId) plainTx.chainId = tx.chainId;

    return plainTx;
  }

  /**
   * Public utility methods
   */
  isConnected(): boolean {
    return this._connected;
  }

  getAccounts(): string[] {
    return this._accounts;
  }

  getAccountsForChain(chainId: string): string[] {
    return this._accountsByChain[chainId] || [];
  }

  getChainId(): string {
    return this._currentChainIdHex;
  }

  getSupportedChains(): string[] {
    return this._supportedChains;
  }

  getCurrentChain(): string {
    return this._currentChainId;
  }
}
