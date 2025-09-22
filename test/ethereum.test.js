// Mock popup object
const mockPopup = {
  postMessage: jest.fn(),
  closed: false,
  close: jest.fn(),
};
global.window = {
  location: {
    origin: 'http://localhost:3000',
    hostname: 'localhost',
  },
  open: jest.fn().mockImplementation(() => mockPopup),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
};
global.TextEncoder = class {
  encode(text) {
    return Buffer.from(text);
  }
};
global.URL = class {
  constructor(url) {
    this.url = url;
    this.origin = 'http://localhost:3001';
  }
};
global.setInterval = jest.fn(() => 123);
global.clearInterval = jest.fn();

// Event listeners handling
const eventListeners = {};
global.window.addEventListener = (event, callback) => {
  if (!eventListeners[event]) {
    eventListeners[event] = [];
  }
  eventListeners[event].push(callback);
};

global.window.removeEventListener = (event, callback) => {
  if (eventListeners[event]) {
    eventListeners[event] = eventListeners[event].filter((cb) => cb !== callback);
  }
};

function simulateWalletMessage(type, data = {}) {
  const mockEvent = {
    origin: 'http://localhost:3001',
    data: type === 'READY' ? { type: 'READY' } : data,
  };

  if (eventListeners['message']) {
    eventListeners['message'].forEach((listener) => listener(mockEvent));
  }
}

function simulatePopupClosed() {
  mockPopup.closed = true;
  // Trigger the interval check manually since we're mocking setInterval
  if (eventListeners['message'] && eventListeners['message'].length > 0) {
    // Force the interval callback to run
    if (typeof global.setInterval.mock.calls[0][0] === 'function') {
      global.setInterval.mock.calls[0][0]();
    }
  }
}
const NewWallet = require('../dist/index.js');
const { CONNECTION_METHODS, EIP155_METHODS, CHAIN_IDS, ErrorCode } = NewWallet;

describe('Ethereumwallet.ethereum', () => {
  let wallet;
  const walletUrl = 'http://localhost:3001/transaction_signing';

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockPopup.closed = false;

    // Clear event listeners
    for (const key in eventListeners) {
      eventListeners[key] = [];
    }

    wallet = new NewWallet.default({
      walletUrl,
    });
  });

  afterEach(() => {
    jest.clearAllTimers(); // Add this
    jest.useRealTimers(); // Add this
  });

  describe('Initialization', () => {
    test('SDK should be properly initialized', () => {
      expect(wallet).toBeDefined();
      expect(wallet.ethereum).toBeDefined();
      expect(wallet.isInstalled()).toBe(true);
    });

    test('Ethereum wallet.ethereum should have request method', () => {
      expect(typeof wallet.ethereum.request).toBe('function');
    });
  });
  describe('Connection', () => {
    test('should open popup and connect successfully', async () => {
      // Start connection process
      const connectPromise = wallet.ethereum.request({ method: 'eth_requestAccounts' });

      // The wallet should have opened a popup
      expect(window.open).toHaveBeenCalledWith(
        'http://localhost:3001/transaction_signing',
        expect.any(String),
        expect.any(String)
      );

      // Simulate the wallet sending a READY message
      simulateWalletMessage('READY');

      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: CONNECTION_METHODS.WALLET_REQUEST_CONNECTION,
        result: {
          accounts: {
            eip155: [
              'eip155:1:0xeth1',
              'eip155:1:0xeth2',
              'eip155:56:0xbsc1',
              'eip155:56:0xbsc2',
              'eip155:8453:0xbase1',
              'solana:1:0xsol1',
            ],
          },
          chains: {
            eip155: 'eip155:1', // Active chain is Ethereum mainnet
          },
        },
      });
      // Wait for the connection promise to resolve
      const accounts = await connectPromise;

      // Check the accounts returned
      expect(accounts).toEqual(['0xeth1', '0xeth2']);
      expect(mockPopup.close).toHaveBeenCalled();
    });
    it('should connect and request all EVM chains', async () => {
      const promise = wallet.ethereum.request({ method: CONNECTION_METHODS.ETH_REQUEST_ACCOUNTS });

      // Check popup opened
      expect(window.open).toHaveBeenCalledWith(walletUrl, expect.any(String), expect.any(String));

      simulateWalletMessage('READY');
      // Check requested all chains
      expect(mockPopup.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          method: CONNECTION_METHODS.WALLET_REQUEST_CONNECTION,
          requiredNamespaces: {
            eip155: expect.objectContaining({
              chains: [
                CHAIN_IDS.ETHEREUM_MAINNET,
                CHAIN_IDS.ETHEREUM_SEPOLIA,
                CHAIN_IDS.BSC_MAINNET,
                CHAIN_IDS.BSC_TESTNET,
                CHAIN_IDS.BASE_MAINNET,
                CHAIN_IDS.BASE_SEPOLIA,
              ],
            }),
          },
        }),
        'http://localhost:3001'
      );
      // Simulate response with different accounts per chain
      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: CONNECTION_METHODS.WALLET_REQUEST_CONNECTION,
        result: {
          accounts: {
            eip155: [
              'eip155:1:0xeth1',
              'eip155:1:0xeth2',
              'eip155:56:0xbsc1',
              'eip155:56:0xbsc2',
              'eip155:8453:0xbase1',
              'solana:1:0xsol1',
            ],
          },
          chains: {
            eip155: 'eip155:1', // Active chain is Ethereum mainnet
          },
        },
      });
      const accounts = await promise;

      // Should return Ethereum mainnet accounts (current chain)
      expect(accounts).toEqual(['0xeth1', '0xeth2']);
      expect(wallet.ethereum.isConnected()).toBe(true);
      expect(wallet.ethereum.getChainId()).toBe('0x1');

      // Check accounts per chain
      expect(wallet.ethereum.getAccountsForChain('eip155:1')).toEqual(['0xeth1', '0xeth2']);
      expect(wallet.ethereum.getAccountsForChain('eip155:56')).toEqual(['0xbsc1', '0xbsc2']);
      expect(wallet.ethereum.getAccountsForChain('eip155:8453')).toEqual(['0xbase1']);
    });

    it('should handle wallet with active BSC chain', async () => {
      const promise = wallet.ethereum.request({ method: CONNECTION_METHODS.ETH_REQUEST_ACCOUNTS });

      simulateWalletMessage('READY');

      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: CONNECTION_METHODS.WALLET_REQUEST_CONNECTION,
        result: {
          accounts: {
            eip155: ['eip155:1:0xeth1', 'eip155:56:0xbsc1', 'eip155:56:0xbsc2'],
          },
          chains: {
            eip155: 'eip155:56', // Active chain is BSC
          },
        },
      });

      const accounts = await promise;

      // Should return BSC accounts
      expect(accounts).toEqual(['0xbsc1', '0xbsc2']);
      expect(wallet.ethereum.getChainId()).toBe('0x38'); // BSC mainnet
    });

    it('should handle missing eip155 namespace in response', async () => {
      const promise = wallet.ethereum.request({ method: CONNECTION_METHODS.ETH_REQUEST_ACCOUNTS });
      simulateWalletMessage('READY');

      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: CONNECTION_METHODS.WALLET_REQUEST_CONNECTION,
        result: {
          accounts: {
            solana: ['sol1']  // Missing eip155
          }
        }
      });

      await expect(promise).rejects.toThrow('No accounts available for current chain');
    });

    it('should handle empty accounts for all chains', async () => {
      const promise = wallet.ethereum.request({ method: CONNECTION_METHODS.ETH_REQUEST_ACCOUNTS });
      simulateWalletMessage('READY');

      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: CONNECTION_METHODS.WALLET_REQUEST_CONNECTION,
        result: {
          accounts: {
            eip155: []  // Empty array
          }
        }
      });

      await expect(promise).rejects.toThrow('No accounts available for current chain');
    });

    it('should handle malformed account addresses', async () => {
      const promise = wallet.ethereum.request({ method: CONNECTION_METHODS.ETH_REQUEST_ACCOUNTS });
      simulateWalletMessage('READY');

      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: CONNECTION_METHODS.WALLET_REQUEST_CONNECTION,
        result: {
          accounts: {
            eip155: [
              'invalid-format',  // Should be 'eip155:1:0x...'
              'eip155:1',  // Missing address part
              ':0x123'  // Missing chain part
            ]
          }
        }
      });

      // Should handle gracefully, filtering out invalid addresses
      await expect(promise).rejects.toThrow('No accounts available for current chain');
    });

    it('should parse mixed chain accounts correctly', async () => {
      const promise = wallet.ethereum.request({ method: CONNECTION_METHODS.ETH_REQUEST_ACCOUNTS });
      simulateWalletMessage('READY');

      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: CONNECTION_METHODS.WALLET_REQUEST_CONNECTION,
        result: {
          accounts: {
            eip155: [
              'eip155:1:0xeth1',
              'eip155:56:0xbsc1',
              'eip155:8453:0xbase1',
              'eip155:1:0xeth2',  // Multiple for same chain
            ]
          }
        }
      });

      await promise;

      expect(wallet.ethereum.getAccountsForChain('eip155:1')).toEqual(['0xeth1', '0xeth2']);
      expect(wallet.ethereum.getAccountsForChain('eip155:56')).toEqual(['0xbsc1']);
      expect(wallet.ethereum.getAccountsForChain('eip155:8453')).toEqual(['0xbase1']);
    });

    it('should handle unsupported chain in active chain', async () => {
      const promise = wallet.ethereum.request({ method: CONNECTION_METHODS.ETH_REQUEST_ACCOUNTS });
      simulateWalletMessage('READY');

      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: CONNECTION_METHODS.WALLET_REQUEST_CONNECTION,
        result: {
          accounts: {
            eip155: ['eip155:1:0xeth1']
          },
          chains: {
            eip155: 'eip155:137'  // Polygon - not supported
          }
        }
      });

      await promise;
      // Should default to Ethereum mainnet
      expect(wallet.ethereum.getChainId()).toBe('0x1');
    });

    it('should handle popup blocked', async () => {
      window.open.mockReturnValueOnce(null);

      await expect(
        wallet.ethereum.request({ method: CONNECTION_METHODS.ETH_REQUEST_ACCOUNTS })
      ).rejects.toThrow('Failed to open popup');
    });

    it('should handle error response', async () => {
      const promise = wallet.ethereum.request({ method: CONNECTION_METHODS.ETH_REQUEST_ACCOUNTS });
      simulateWalletMessage('READY');

      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: CONNECTION_METHODS.WALLET_REQUEST_CONNECTION,
        error: {
          code: 4001,
          message: 'User denied account access'
        }
      });

      await expect(promise).rejects.toThrow('User denied account access');
    });

    it('should handle reconnection after disconnect', async () => {
      // First connection
      let promise = wallet.ethereum.request({ method: CONNECTION_METHODS.ETH_REQUEST_ACCOUNTS });
      simulateWalletMessage('READY');
      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: CONNECTION_METHODS.WALLET_REQUEST_CONNECTION,
        result: {
          accounts: { eip155: ['eip155:1:0xfirst'] }
        }
      });
      await promise;

      expect(wallet.ethereum.isConnected()).toBe(true);

      // Simulate disconnect (would normally be done via events)
      wallet.ethereum._connected = false;
      wallet.ethereum._accountsByChain = {};

      // Reconnect with different accounts
      promise = wallet.ethereum.request({ method: CONNECTION_METHODS.ETH_REQUEST_ACCOUNTS });
      simulateWalletMessage('READY');
      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: CONNECTION_METHODS.WALLET_REQUEST_CONNECTION,
        result: {
          accounts: { eip155: ['eip155:1:0xsecond'] }
        }
      });
      await promise;

      expect(wallet.ethereum.getAccounts()).toEqual(['0xsecond']);
    });
  });

  describe('Chain switching', () => {
    beforeEach(async () => {
      // Setup connected state
      const promise = wallet.ethereum.request({ method: CONNECTION_METHODS.ETH_REQUEST_ACCOUNTS });

      simulateWalletMessage('READY');
      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: CONNECTION_METHODS.WALLET_REQUEST_CONNECTION,
        result: {
          accounts: {
            eip155: ['eip155:1:0xeth1', 'eip155:56:0xbsc1', 'eip155:8453:0xbase1'],
          },
          supportedChains: ['eip155:1', 'eip155:56', 'eip155:8453'],
        },
      });

      await promise;
    });

    it('should switch chains and update accounts', async () => {
      const chainChangedListener = jest.fn();
      const accountsChangedListener = jest.fn();

      wallet.ethereum.on('chainChanged', chainChangedListener);
      wallet.ethereum.on('accountsChanged', accountsChangedListener);

      // Initially on Ethereum
      expect(wallet.ethereum.getAccounts()).toEqual(['0xeth1']);

      // Switch to BSC
      await wallet.ethereum.request({
        method: CONNECTION_METHODS.WALLET_SWITCH_ETHEREUM_CHAIN,
        params: [{ chainId: '0x38' }], // BSC mainnet
      });

      expect(wallet.ethereum.getChainId()).toBe('0x38');
      expect(wallet.ethereum.getAccounts()).toEqual(['0xbsc1']);
      expect(chainChangedListener).toHaveBeenCalledWith('0x38');
      expect(accountsChangedListener).toHaveBeenCalledWith(['0xbsc1']);
    });

    it('should reject unsupported chain', async () => {
      await expect(
        wallet.ethereum.request({
          method: CONNECTION_METHODS.WALLET_SWITCH_ETHEREUM_CHAIN,
          params: [{ chainId: '0x89' }], // Polygon - not supported
        })
      ).rejects.toThrow('not supported');
    });
  });

  describe('Signing methods', () => {
    beforeEach(async () => {
      // Setup connected state with different accounts per chain
      const promise = wallet.ethereum.request({ method: CONNECTION_METHODS.ETH_REQUEST_ACCOUNTS });

      simulateWalletMessage('READY');
      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: CONNECTION_METHODS.WALLET_REQUEST_CONNECTION,
        result: {
          accounts: {
            eip155: ['eip155:1:0xeth1', 'eip155:56:0xbsc1'],
          },
        },
      });

      await promise;
    });

    it('should sign with current chain account', async () => {
      const promise = wallet.ethereum.request({
        method: EIP155_METHODS.PERSONAL_SIGN,
        params: ['Hello', '0xeth1'],
      });

      simulateWalletMessage('READY');

      // Check chainId is included
      expect(mockPopup.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          method: EIP155_METHODS.PERSONAL_SIGN,
          params: ['Hello', '0xeth1'],
          chainId: 'eip155:1', // Current chain
        }),
        'http://localhost:3001'
      );

      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: EIP155_METHODS.PERSONAL_SIGN,
        result: '0xsignature',
      });

      const signature = await promise;
      expect(signature).toBe('0xsignature');
    });

    it('should reject signing with wrong chain account', async () => {
      // Currently on Ethereum, try to sign with BSC account
      await expect(
        wallet.ethereum.request({
          method: EIP155_METHODS.PERSONAL_SIGN,
          params: ['Hello', '0xbsc1'], // BSC account on Ethereum chain
        })
      ).rejects.toThrow('not available on chain');
    });

    it('should sign after switching chains', async () => {
      // Switch to BSC
      await wallet.ethereum.request({
        method: CONNECTION_METHODS.WALLET_SWITCH_ETHEREUM_CHAIN,
        params: [{ chainId: '0x38' }],
      });

      jest.clearAllMocks();

      const promise = wallet.ethereum.request({
        method: EIP155_METHODS.PERSONAL_SIGN,
        params: ['Hello', '0xbsc1'],
      });

      simulateWalletMessage('READY');

      // Check BSC chainId is used
      expect(mockPopup.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          method: EIP155_METHODS.PERSONAL_SIGN,
          params: ['Hello', '0xbsc1'],
          chainId: 'eip155:56', // BSC chain
        }),
        'http://localhost:3001'
      );

      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: EIP155_METHODS.PERSONAL_SIGN,
        result: '0xbsc_signature',
      });

      const signature = await promise;
      expect(signature).toBe('0xbsc_signature');
    });
  });

  describe('personal_sign', () => {
    beforeEach(async () => {
      // Connect with accounts on multiple chains
      const promise = wallet.ethereum.request({ method: CONNECTION_METHODS.ETH_REQUEST_ACCOUNTS });
      simulateWalletMessage('READY');
      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: CONNECTION_METHODS.WALLET_REQUEST_CONNECTION,
        result: {
          accounts: {
            eip155: [
              'eip155:1:0xeth1',
              'eip155:56:0xbsc1',
              'eip155:8453:0xbase1'
            ]
          }
        }
      });
      await promise;
      jest.clearAllMocks();
    });
    it('should handle empty message', async () => {
      const promise = wallet.ethereum.request({
        method: EIP155_METHODS.PERSONAL_SIGN,
        params: ['', '0xeth1']
      });

      simulateWalletMessage('READY');
      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: EIP155_METHODS.PERSONAL_SIGN,
        result: '0xemptysig'
      });

      const signature = await promise;
      expect(signature).toBe('0xemptysig');
    });

    it('should reject signing with wrong chain account', async () => {
      // Currently on Ethereum, try to sign with BSC account
      await expect(
        wallet.ethereum.request({
          method: EIP155_METHODS.PERSONAL_SIGN,
          params: ['Hello', '0xbsc1']
        })
      ).rejects.toThrow('not available on chain');
    });

    it('should sign after switching chains', async () => {
      // Switch to BSC
      await wallet.ethereum.request({
        method: CONNECTION_METHODS.WALLET_SWITCH_ETHEREUM_CHAIN,
        params: [{ chainId: '0x38' }]
      });

      jest.clearAllMocks();

      const promise = wallet.ethereum.request({
        method: EIP155_METHODS.PERSONAL_SIGN,
        params: ['Hello', '0xbsc1']
      });

      simulateWalletMessage('READY');

      expect(mockPopup.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          chainId: 'eip155:56'  // BSC chain
        }),
        'http://localhost:3001'
      );

      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: EIP155_METHODS.PERSONAL_SIGN,
        result: '0xbscsig'
      });

      const signature = await promise;
      expect(signature).toBe('0xbscsig');
    });

    it('should handle hex encoded message', async () => {
      const hexMessage = '0x48656c6c6f'; // "Hello" in hex
      const promise = wallet.ethereum.request({
        method: EIP155_METHODS.PERSONAL_SIGN,
        params: [hexMessage, '0xeth1']
      });

      simulateWalletMessage('READY');
      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: EIP155_METHODS.PERSONAL_SIGN,
        result: '0xhexsig'
      });

      const signature = await promise;
      expect(signature).toBe('0xhexsig');
    });

    it('should handle missing parameters', async () => {
      await expect(
        wallet.ethereum.request({
          method: EIP155_METHODS.PERSONAL_SIGN,
          params: ['message'] // Missing address
        })
      ).rejects.toThrow('message and address required');
    });

    it('should handle user rejection', async () => {
      const promise = wallet.ethereum.request({
        method: EIP155_METHODS.PERSONAL_SIGN,
        params: ['Hello', '0xeth1']
      });

      simulateWalletMessage('READY');
      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: EIP155_METHODS.PERSONAL_SIGN,
        error: { code: 4001, message: 'User rejected' }
      });

      await expect(promise).rejects.toThrow('User rejected');
    });
  });

  describe('eth_sendTransaction', () => {
    beforeEach(async () => {
      const promise = wallet.ethereum.request({ method: CONNECTION_METHODS.ETH_REQUEST_ACCOUNTS });
      simulateWalletMessage('READY');
      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: CONNECTION_METHODS.WALLET_REQUEST_CONNECTION,
        result: {
          accounts: { eip155: ['eip155:1:0xeth1'] },
        },
      });
      await promise;
    });

    it('should send transaction with current chain', async () => {
      const tx = {
        from: '0xeth1',
        to: '0xrecipient',
        value: '0x1000',
      };

      const promise = wallet.ethereum.request({
        method: EIP155_METHODS.ETH_SEND_TRANSACTION,
        params: [tx],
      });

      simulateWalletMessage('READY');

      expect(mockPopup.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          method: EIP155_METHODS.ETH_SEND_TRANSACTION,
          params: [expect.objectContaining(tx)],
          chainId: 'eip155:1',
        }),
        'http://localhost:3001'
      );

      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: EIP155_METHODS.ETH_SEND_TRANSACTION,
        result: '0xtxhash',
      });

      const txHash = await promise;
      expect(txHash).toBe('0xtxhash');
    });

    it('should include chainId in request', async () => {
      const tx = { from: '0xeth1', to: '0xrecipient', value: '0x1000' };
      const promise = wallet.ethereum.request({
        method: EIP155_METHODS.ETH_SEND_TRANSACTION,
        params: [tx]
      });

      simulateWalletMessage('READY');

      expect(mockPopup.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          chainId: 'eip155:1',
          params: [expect.objectContaining(tx)]
        }),
        'http://localhost:3001'
      );

      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: EIP155_METHODS.ETH_SEND_TRANSACTION,
        result: '0xtxhash'
      });

      await promise;
    });

    it('should reject transaction without from address', async () => {
      await expect(
        wallet.ethereum.request({
          method: EIP155_METHODS.ETH_SEND_TRANSACTION,
          params: [{ to: '0xrecipient', value: '0x1000' }]
        })
      ).rejects.toThrow('From address not connected');
    });

    it('should handle transaction with all fields', async () => {
      const tx = {
        from: '0xeth1',
        to: '0xrecipient',
        value: '0x1000',
        data: '0xdeadbeef',
        nonce: 5,
        gasLimit: '21000',
        gasPrice: '1000000000',
        maxFeePerGas: '2000000000',
        maxPriorityFeePerGas: '1000000000',
        chainId: 1
      };

      const promise = wallet.ethereum.request({
        method: EIP155_METHODS.ETH_SEND_TRANSACTION,
        params: [tx]
      });

      simulateWalletMessage('READY');

      expect(mockPopup.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          params: [expect.objectContaining({
            from: '0xeth1',
            data: '0xdeadbeef',
            nonce: 5
          })]
        }),
        'http://localhost:3001'
      );

      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: EIP155_METHODS.ETH_SEND_TRANSACTION,
        result: '0xtxhash'
      });

      await promise;
    });

    it('should handle popup closed during transaction', async () => {
      const promise = wallet.ethereum.request({
        method: EIP155_METHODS.ETH_SEND_TRANSACTION,
        params: [{ from: '0xeth1', to: '0xrecipient', value: '0x1000' }]
      });

      simulateWalletMessage('READY');
      mockPopup.closed = true;
      jest.advanceTimersByTime(500);

      await expect(promise).rejects.toThrow('User closed popup');
    });
  });

  describe('eth_signTransaction', () => {
    beforeEach(async () => {
      jest.clearAllMocks();
      // Reset wallet state completely
      wallet = new NewWallet.default({ walletUrl });

      // Connect with accounts on multiple chains
      const promise = wallet.ethereum.request({ method: CONNECTION_METHODS.ETH_REQUEST_ACCOUNTS });
      simulateWalletMessage('READY');
      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: CONNECTION_METHODS.WALLET_REQUEST_CONNECTION,
        result: {
          accounts: {
            eip155: [
              'eip155:1:0xeth1',
              'eip155:56:0xbsc1',
              'eip155:8453:0xbase1'
            ]
          }
        }
      });
      await promise;
      jest.clearAllMocks();
    });
    it('should sign transaction without sending', async () => {
      const tx = { from: '0xeth1', to: '0xrecipient', value: '0x1000' };
      const promise = wallet.ethereum.request({
        method: EIP155_METHODS.ETH_SIGN_TRANSACTION,
        params: [tx]
      });

      simulateWalletMessage('READY');
      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: EIP155_METHODS.ETH_SIGN_TRANSACTION,
        result: '0xsignedtx'
      });

      const signedTx = await promise;
      expect(signedTx).toBe('0xsignedtx');
    });

    it('should reject when not connected', async () => {
      wallet.ethereum._connected = false;

      await expect(
        wallet.ethereum.request({
          method: EIP155_METHODS.ETH_SIGN_TRANSACTION,
          params: [{ from: '0xeth1', to: '0xrecipient' }]
        })
      ).rejects.toThrow('Not connected');
    });
  });

  describe('eth_signTypedData', () => {
    beforeEach(async () => {
      jest.clearAllMocks();
      // Reset wallet state completely
      wallet = new NewWallet.default({ walletUrl });

      // Connect with accounts on multiple chains
      const promise = wallet.ethereum.request({ method: CONNECTION_METHODS.ETH_REQUEST_ACCOUNTS });
      simulateWalletMessage('READY');
      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: CONNECTION_METHODS.WALLET_REQUEST_CONNECTION,
        result: {
          accounts: {
            eip155: [
              'eip155:1:0xeth1',
              'eip155:56:0xbsc1',
              'eip155:8453:0xbase1'
            ]
          }
        }
      });
      await promise;
      jest.clearAllMocks();
    });
    const typedData = {
      types: {
        EIP712Domain: [
          { name: 'name', type: 'string' },
          { name: 'version', type: 'string' }
        ],
        Message: [
          { name: 'content', type: 'string' }
        ]
      },
      domain: {
        name: 'Test',
        version: '1'
      },
      message: {
        content: 'Hello'
      }
    };

    it('should sign typed data v4', async () => {
      const promise = wallet.ethereum.request({
        method: EIP155_METHODS.ETH_SIGN_TYPED_DATA_V4,
        params: ['0xeth1', JSON.stringify(typedData)]
      });

      simulateWalletMessage('READY');
      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: EIP155_METHODS.ETH_SIGN_TYPED_DATA_V4,
        result: '0xtypedsig'
      });

      const signature = await promise;
      expect(signature).toBe('0xtypedsig');
    });

    it('should handle typed data as object', async () => {
      const promise = wallet.ethereum.request({
        method: EIP155_METHODS.ETH_SIGN_TYPED_DATA_V4,
        params: ['0xeth1', typedData] // Object instead of string
      });

      simulateWalletMessage('READY');
      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: EIP155_METHODS.ETH_SIGN_TYPED_DATA_V4,
        result: '0xtypedsig'
      });

      const signature = await promise;
      expect(signature).toBe('0xtypedsig');
    });

    it('should reject with wrong account', async () => {
      await expect(
        wallet.ethereum.request({
          method: EIP155_METHODS.ETH_SIGN_TYPED_DATA_V4,
          params: ['0xwrong', typedData]
        })
      ).rejects.toThrow('Account not connected');
    });

    it('should handle missing parameters', async () => {
      await expect(
        wallet.ethereum.request({
          method: EIP155_METHODS.ETH_SIGN_TYPED_DATA_V4,
          params: ['0xeth1'] // Missing data
        })
      ).rejects.toThrow('address and data required');
    });
  });
});
