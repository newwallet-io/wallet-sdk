import {
  SolanaMessageType,
  ErrorCode,
  MessageRequest,
  MessageResponse,
  getErrorMessage,
  ProviderError,
} from '../types';
import { openPopup } from '../utils';

export class SolanaProvider {
  private _targetWalletUrl: string;
  private _targetWalletOrigin: string;
  private _connected: boolean = false;
  private _publicKey: string | null = null;
  private _eventListeners: { [event: string]: Function[] } = {};

  constructor(targetWalletUrl: string) {
    this._targetWalletUrl = targetWalletUrl;
    this._targetWalletOrigin = new URL(targetWalletUrl).origin;
  }

  private _buildRequest(type: SolanaMessageType, payload?: any): MessageRequest {
    return {
      type,
      network: 'solana',
      timestamp: Date.now(),
      payload,
    };
  }

  /**
   * Connect to the wallet
   * @returns A promise that resolves to the public key of the connected wallet
   */
  async connect(): Promise<string> {
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
          data.type === SolanaMessageType.READY &&
          origin === this._targetWalletOrigin &&
          !posted
        ) {
          const request = this._buildRequest(SolanaMessageType.CONNECT_WALLET);
          popup.postMessage(request, this._targetWalletOrigin);
          posted = true;
        }

        if (data.type === SolanaMessageType.CONNECT_WALLET && origin === this._targetWalletOrigin) {
          cleanup();
          popup.close();

          if (data.payload.success) {
            // Get the public key from the response
            const publicKey = data.payload.result.publicKey;

            // Update internal state
            this._connected = true;
            this._publicKey = publicKey;

            // Emit the connect event
            this._emit('connect', publicKey);

            // Resolve the promise with the public key
            resolve(publicKey);
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

  /**
   * Disconnect from the wallet
   */
  async disconnect(): Promise<void> {
    if (this._connected) {
      this._connected = false;
      this._publicKey = null;
      this._emit('disconnect');
    }
  }

  /**
   * Check if wallet is connected
   * @returns true if connected, false otherwise
   */
  isConnected(): boolean {
    return this._connected;
  }

  /**
   * Get the public key of the connected wallet
   * @returns The public key as a string, or null if not connected
   */
  getPublicKey(): string | null {
    return this._publicKey;
  }

  /**
   * Sign a message
   * @param message The message to sign, as a Uint8Array
   * @returns A promise that resolves to the signature
   */
  async signMessage(message: Uint8Array): Promise<string> {
    if (!this._connected) {
      throw new ProviderError(ErrorCode.DISCONNECTED, 'Not connected. Please connect first.');
    }

    if (!this._publicKey) {
      throw new ProviderError(
        ErrorCode.UNAUTHORIZED,
        'No public key available. Please connect first.'
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
          data.type === SolanaMessageType.READY &&
          origin === this._targetWalletOrigin &&
          !posted
        ) {
          // Convert Uint8Array to a format suitable for postMessage
          const messageBase64 = btoa(String.fromCharCode.apply(null, [...message]));

          const request = this._buildRequest(SolanaMessageType.SIGN_MESSAGE, {
            message: messageBase64,
            encoding: 'base64',
          });

          popup.postMessage(request, this._targetWalletOrigin);
          posted = true;
        }

        if (data.type === SolanaMessageType.SIGN_MESSAGE && origin === this._targetWalletOrigin) {
          cleanup();
          popup.close();

          if (data.payload.success) {
            // Return just the signature to match Phantom's interface
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

  /**
   * Verify that a transaction can be signed by the connected account
   * @param transaction The transaction to verify (Transaction or VersionedTransaction)
   * @throws ProviderError if the transaction doesn't belong to the connected account
   */
  private _verifyTransactionOwnership(transaction: any): void {
    if (!this._publicKey) {
      throw new ProviderError(
        ErrorCode.UNAUTHORIZED,
        'No public key available. Please connect first.'
      );
    }

    // Simple case: check if the feePayer matches our public key
    if (transaction.feePayer) {
      const feePayer =
        typeof transaction.feePayer === 'string'
          ? transaction.feePayer
          : transaction.feePayer.toString();

      if (feePayer !== this._publicKey) {
        throw new ProviderError(
          ErrorCode.UNAUTHORIZED,
          'Transaction fee payer does not match connected account.'
        );
      }
      return;
    }

    // For VersionedTransaction with message
    if (
      transaction.version !== undefined &&
      transaction.message &&
      transaction.message.staticAccountKeys &&
      transaction.message.staticAccountKeys.length > 0
    ) {
      const firstKey =
        typeof transaction.message.staticAccountKeys[0] === 'string'
          ? transaction.message.staticAccountKeys[0]
          : transaction.message.staticAccountKeys[0].toString();

      if (firstKey !== this._publicKey) {
        throw new ProviderError(
          ErrorCode.UNAUTHORIZED,
          'Transaction first signer does not match connected account.'
        );
      }
      return;
    }

    // We couldn't verify ownership based on common transaction properties
    throw new ProviderError(
      ErrorCode.UNAUTHORIZED,
      'Unable to verify transaction ownership. Please ensure the transaction is properly constructed.'
    );
  }

  /**
   * Sign a transaction
   * @param transaction The transaction to sign
   * @returns A promise that resolves to the signed transaction
   */
  async signTransaction(transaction: any): Promise<any> {
    if (!this._connected) {
      throw new ProviderError(ErrorCode.DISCONNECTED, 'Not connected. Please connect first.');
    }

    // Verify transaction ownership
    this._verifyTransactionOwnership(transaction);

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
          data.type === SolanaMessageType.READY &&
          origin === this._targetWalletOrigin &&
          !posted
        ) {
          // For simplicity, we'll assume the transaction is already serialized
          // In a real implementation, you might need to handle the serialization here
          const request = this._buildRequest(SolanaMessageType.SIGN_TRANSACTION, {
            transaction: transaction,
          });

          popup.postMessage(request, this._targetWalletOrigin);
          posted = true;
        }

        if (
          data.type === SolanaMessageType.SIGN_TRANSACTION &&
          origin === this._targetWalletOrigin
        ) {
          cleanup();
          popup.close();

          if (data.payload.success) {
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

  /**
   * Sign multiple transactions
   * @param transactions An array of transactions to sign
   * @returns A promise that resolves to an array of signed transactions
   */
  async signAllTransactions(transactions: any[]): Promise<any[]> {
    if (!this._connected) {
      throw new ProviderError(ErrorCode.DISCONNECTED, 'Not connected. Please connect first.');
    }

    // Verify all transactions
    for (let i = 0; i < transactions.length; i++) {
      try {
        this._verifyTransactionOwnership(transactions[i]);
      } catch (error) {
        // Add context about which transaction failed
        if (error instanceof ProviderError) {
          throw new ProviderError(error.code, `Transaction at index ${i}: ${error.message}`);
        }
        throw error;
      }
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
          data.type === SolanaMessageType.READY &&
          origin === this._targetWalletOrigin &&
          !posted
        ) {
          const request = this._buildRequest(SolanaMessageType.SIGN_ALL_TRANSACTIONS, {
            transactions: transactions,
          });

          popup.postMessage(request, this._targetWalletOrigin);
          posted = true;
        }

        if (
          data.type === SolanaMessageType.SIGN_ALL_TRANSACTIONS &&
          origin === this._targetWalletOrigin
        ) {
          cleanup();
          popup.close();

          if (data.payload.success) {
            resolve(data.payload.result.signedTransactions);
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

  /**
   * Sign and send a transaction
   * @param transaction The transaction to sign and send
   * @returns A promise that resolves to the transaction signature
   */
  async signAndSendTransaction(transaction: any): Promise<string> {
    if (!this._connected) {
      throw new ProviderError(ErrorCode.DISCONNECTED, 'Not connected. Please connect first.');
    }

    // Verify transaction ownership
    this._verifyTransactionOwnership(transaction);

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
          data.type === SolanaMessageType.READY &&
          origin === this._targetWalletOrigin &&
          !posted
        ) {
          const request = this._buildRequest(SolanaMessageType.SIGN_AND_SEND_TRANSACTION, {
            transaction: transaction,
          });

          popup.postMessage(request, this._targetWalletOrigin);
          posted = true;
        }

        if (
          data.type === SolanaMessageType.SIGN_AND_SEND_TRANSACTION &&
          origin === this._targetWalletOrigin
        ) {
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

  /**
   * Add an event listener
   * @param event The event name
   * @param listener The event listener
   */
  on(event: string, listener: Function): void {
    if (!this._eventListeners[event]) {
      this._eventListeners[event] = [];
    }
    this._eventListeners[event].push(listener);
  }

  /**
   * Remove an event listener
   * @param event The event name
   * @param listener The event listener to remove
   */
  off(event: string, listener: Function): void {
    if (!this._eventListeners[event]) return;
    this._eventListeners[event] = this._eventListeners[event].filter((l) => l !== listener);
  }

  /**
   * Emit an event
   * @param event The event name
   * @param args Arguments to pass to the listeners
   */
  private _emit(event: string, ...args: any[]): void {
    if (!this._eventListeners[event]) return;
    this._eventListeners[event].forEach((listener) => listener(...args));
  }
}
