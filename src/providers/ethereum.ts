import {
  EthereumMessageType,
  ErrorCode,
  MessageRequest,
  MessageResponse,
  getErrorMessage,
  ProviderError,
} from '../types';
import { openPopup } from '../utils';

export class EthereumProvider {
  private _targetWalletUrl: string;
  private _targetWalletOrigin: string;
  private _connected: boolean = false;
  private _accounts: string[] = [];
  private _chainId: string | null = null;
  private _eventListeners: { [event: string]: Function[] } = {};

  constructor(targetWalletUrl: string) {
    this._targetWalletUrl = targetWalletUrl;
    this._targetWalletOrigin = new URL(targetWalletUrl).origin;
  }

  private _buildRequest(type: EthereumMessageType, payload?: any): MessageRequest {
    return {
      type,
      network: 'ethereum',
      timestamp: Date.now(),
      payload,
    };
  }

  async request(args: { method: string; params?: any[] }): Promise<any> {
    const { method, params } = args;

    // Handle different method types
    switch (method) {
      case 'eth_requestAccounts':
        return this._connect();

      case 'eth_accounts':
        return this._accounts;

      case 'eth_chainId':
        return this._chainId;

      case 'personal_sign':
        return this._signMessage(params?.[0], params?.[1]);

      case 'eth_signTransaction':
        return this._signTransaction(params?.[0]);

      case 'eth_sendTransaction':
        return this._sendTransaction(params?.[0]);

      default:
        throw new ProviderError(ErrorCode.UNSUPPORTED_METHOD, `Method not supported: ${method}`);
    }
  }

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

  private async _connect(): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const popup = openPopup(this._targetWalletUrl);
      if (!popup) {
        reject(new ProviderError(ErrorCode.INTERNAL_ERROR, 'Failed to open popup.'));
        return;
      }

      let posted = false;

      const handleMessage = (event: MessageEvent<MessageResponse>) => {
        const { data, origin } = event;
        if (
          data.type === EthereumMessageType.READY &&
          origin === this._targetWalletOrigin &&
          !posted
        ) {
          const request = this._buildRequest(EthereumMessageType.CONNECT_WALLET);
          popup.postMessage(request, this._targetWalletOrigin);
          posted = true;
        }
        if (
          data.type === EthereumMessageType.CONNECT_WALLET &&
          origin === this._targetWalletOrigin
        ) {
          cleanup();
          popup.close();

          if (data.payload.success) {
            this._connected = true;
            this._accounts = [data.payload.result.address];
            this._chainId = data.payload.result.chainId || '0x1'; // Default to Ethereum mainnet
            this._emit('accountsChanged', this._accounts);
            this._emit('chainChanged', this._chainId);
            resolve(this._accounts);
          } else {
            const errorCode = data.payload.errorCode || ErrorCode.UNKNOWN_ERROR;
            reject(new ProviderError(errorCode, data.payload.message));
          }
        }
      };

      const handleClose = () => {
        cleanup();
        reject(new ProviderError(ErrorCode.USER_REJECTED, 'User closed the wallet window.'));
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

  private async _signMessage(message: string, from: string): Promise<string> {
    if (!this._connected) {
      throw new ProviderError(ErrorCode.DISCONNECTED, 'Not connected. Please connect first.');
    }

    if (!this._accounts.includes(from)) {
      throw new ProviderError(
        ErrorCode.UNAUTHORIZED,
        'Not connected to the requested account. Please connect first.'
      );
    }

    return new Promise((resolve, reject) => {
      const popup = openPopup(this._targetWalletUrl);
      if (!popup) {
        reject(new ProviderError(ErrorCode.INTERNAL_ERROR, 'Failed to open popup.'));
        return;
      }

      let posted = false;

      const handleMessage = (event: MessageEvent<MessageResponse>) => {
        const { data, origin } = event;

        if (
          data.type === EthereumMessageType.READY &&
          origin === this._targetWalletOrigin &&
          !posted
        ) {
          const request = this._buildRequest(EthereumMessageType.SIGN_MESSAGE, { message, from });
          popup.postMessage(request, this._targetWalletOrigin);
          posted = true;
        }

        if (data.type === EthereumMessageType.SIGN_MESSAGE && origin === this._targetWalletOrigin) {
          cleanup();
          popup.close();

          if (data.payload.success) {
            resolve(data.payload.result.signature);
          } else {
            const errorCode = data.payload.errorCode || ErrorCode.UNKNOWN_ERROR;
            reject(new ProviderError(errorCode, data.payload.message));
          }
        }
      };

      const handleClose = () => {
        cleanup();
        reject(new ProviderError(ErrorCode.USER_REJECTED, 'User closed the wallet window.'));
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

  private async _signTransaction(transactionRequest: any): Promise<string> {
    if (!this._connected) {
      throw new ProviderError(ErrorCode.DISCONNECTED, 'Not connected. Please connect first.');
    }

    if (!transactionRequest.from || !this._accounts.includes(transactionRequest.from)) {
      throw new ProviderError(
        ErrorCode.UNAUTHORIZED,
        'From address not connected. Please connect the correct account.'
      );
    }

    return new Promise((resolve, reject) => {
      const popup = openPopup(this._targetWalletUrl);
      if (!popup) {
        reject(new ProviderError(ErrorCode.INTERNAL_ERROR, 'Failed to open popup.'));
        return;
      }

      let posted = false;

      const handleMessage = (event: MessageEvent<MessageResponse>) => {
        const { data, origin } = event;

        if (
          data.type === EthereumMessageType.READY &&
          origin === this._targetWalletOrigin &&
          !posted
        ) {
          const request = this._buildRequest(
            EthereumMessageType.SIGN_TRANSACTION,
            transactionRequest
          );
          popup.postMessage(request, this._targetWalletOrigin);
          posted = true;
        }

        if (
          data.type === EthereumMessageType.SIGN_TRANSACTION &&
          origin === this._targetWalletOrigin
        ) {
          cleanup();
          popup.close();

          if (data.payload.success) {
            // For signTransaction, we're returning the signed transaction data
            // rather than just the hash (which would be from sending the transaction)
            resolve(data.payload.result.signedTransaction);
          } else {
            const errorCode = data.payload.errorCode || ErrorCode.UNKNOWN_ERROR;
            reject(new ProviderError(errorCode, data.payload.message));
          }
        }
      };

      const handleClose = () => {
        cleanup();
        reject(new ProviderError(ErrorCode.USER_REJECTED, 'User closed the wallet window.'));
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

  private async _sendTransaction(transactionRequest: any): Promise<string> {
    if (!this._connected) {
      throw new ProviderError(ErrorCode.DISCONNECTED, 'Not connected. Please connect first.');
    }

    if (!transactionRequest.from || !this._accounts.includes(transactionRequest.from)) {
      throw new ProviderError(
        ErrorCode.UNAUTHORIZED,
        'From address not connected. Please connect the correct account.'
      );
    }

    return new Promise((resolve, reject) => {
      const popup = openPopup(this._targetWalletUrl);
      if (!popup) {
        reject(new ProviderError(ErrorCode.INTERNAL_ERROR, 'Failed to open popup.'));
        return;
      }

      let posted = false;

      const handleMessage = (event: MessageEvent<MessageResponse>) => {
        const { data, origin } = event;

        if (
          data.type === EthereumMessageType.READY &&
          origin === this._targetWalletOrigin &&
          !posted
        ) {
          const request = this._buildRequest(
            EthereumMessageType.SIGN_TRANSACTION,
            transactionRequest
          );
          popup.postMessage(request, this._targetWalletOrigin);
          posted = true;
        }

        if (
          data.type === EthereumMessageType.SIGN_TRANSACTION &&
          origin === this._targetWalletOrigin
        ) {
          cleanup();
          popup.close();

          if (data.payload.success) {
            resolve(data.payload.result.hash);
          } else {
            const errorCode = data.payload.errorCode || ErrorCode.UNKNOWN_ERROR;
            reject(new ProviderError(errorCode, data.payload.message));
          }
        }
      };

      const handleClose = () => {
        cleanup();
        reject(new ProviderError(ErrorCode.USER_REJECTED, 'User closed the wallet window.'));
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
}
