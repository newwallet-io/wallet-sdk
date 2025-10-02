// test/ethereum.test.js - Updated for WalletConnect namespaces format

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
  if (typeof global.setInterval.mock.calls[0][0] === 'function') {
    global.setInterval.mock.calls[0][0]();
  }
}

const NewWallet = require('../dist/index.js');
const { CONNECTION_METHODS, EIP155_METHODS, CHAIN_IDS, ErrorCode } = NewWallet;

describe('EthereumProvider', () => {
  let wallet;
  const walletUrl = 'http://localhost:3001/transaction_signing';

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockPopup.closed = false;

    for (const key in eventListeners) {
      eventListeners[key] = [];
    }

    wallet = new NewWallet.default({
      walletUrl,
    });
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('Initialization', () => {
    test('SDK should be properly initialized', () => {
      expect(wallet).toBeDefined();
      expect(wallet.ethereum).toBeDefined();
      expect(wallet.isInstalled()).toBe(true);
    });

    test('Ethereum provider should have request method', () => {
      expect(typeof wallet.ethereum.request).toBe('function');
    });
  });

  describe('Connection', () => {
    test('should connect with WalletConnect namespaces format', async () => {
      const connectPromise = wallet.ethereum.request({ method: 'eth_requestAccounts' });

      expect(window.open).toHaveBeenCalledWith(
        'http://localhost:3001/transaction_signing',
        expect.any(String),
        expect.any(String)
      );

      simulateWalletMessage('READY');

      // ✅ NEW: WalletConnect format with namespaces
      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: CONNECTION_METHODS.WALLET_REQUEST_CONNECTION,
        result: {
          namespaces: {  // ✅ Use namespaces structure
            eip155: {
              accounts: [
                'eip155:1:0xeth1',
                'eip155:1:0xeth2',
                'eip155:56:0xbsc1',
                'eip155:56:0xbsc2',
                'eip155:8453:0xbase1',
              ],
              chains: ['eip155:1', 'eip155:56', 'eip155:8453'],
              methods: ['eth_sendTransaction', 'personal_sign'],
              events: ['chainChanged', 'accountsChanged']
            }
          }
        },
      });

      const accounts = await connectPromise;

      expect(accounts).toEqual(['0xeth1', '0xeth2']);
      expect(mockPopup.close).toHaveBeenCalled();
    });

    test('should use chains array from wallet response', async () => {
      const promise = wallet.ethereum.request({ method: CONNECTION_METHODS.ETH_REQUEST_ACCOUNTS });

      simulateWalletMessage('READY');

      // ✅ Wallet returns chains array
      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: CONNECTION_METHODS.WALLET_REQUEST_CONNECTION,
        result: {
          namespaces: {
            eip155: {
              accounts: [
                'eip155:1:0xeth1',
                'eip155:56:0xbsc1',
              ],
              chains: ['eip155:1', 'eip155:56', 'eip155:8453'],  // ✅ Includes Base
              methods: ['eth_sendTransaction', 'personal_sign'],
              events: ['chainChanged', 'accountsChanged']
            }
          }
        },
      });

      const accounts = await promise;

      expect(accounts).toEqual(['0xeth1']);
      expect(wallet.ethereum.isConnected()).toBe(true);
      
      // ✅ Should get chains from response, including Base without account
      const supportedChains = wallet.ethereum.getSupportedChains();
      expect(supportedChains).toEqual(['eip155:1', 'eip155:56', 'eip155:8453']);
      expect(supportedChains.includes('eip155:8453')).toBe(true);
    });

    test('should fallback to deriving chains from accounts if no chains array', async () => {
      const promise = wallet.ethereum.request({ method: CONNECTION_METHODS.ETH_REQUEST_ACCOUNTS });

      simulateWalletMessage('READY');

      // ✅ No chains array provided
      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: CONNECTION_METHODS.WALLET_REQUEST_CONNECTION,
        result: {
          namespaces: {
            eip155: {
              accounts: [
                'eip155:1:0xeth1',
                'eip155:56:0xbsc1',
              ],
              // No chains field
              methods: ['eth_sendTransaction', 'personal_sign'],
              events: ['chainChanged', 'accountsChanged']
            }
          }
        },
      });

      await promise;

      // ✅ Should derive chains from accounts
      const supportedChains = wallet.ethereum.getSupportedChains();
      expect(supportedChains).toContain('eip155:1');
      expect(supportedChains).toContain('eip155:56');
    });

    test('should handle wallet with active BSC chain', async () => {
      const promise = wallet.ethereum.request({ method: CONNECTION_METHODS.ETH_REQUEST_ACCOUNTS });

      simulateWalletMessage('READY');

      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: CONNECTION_METHODS.WALLET_REQUEST_CONNECTION,
        result: {
          namespaces: {
            eip155: {
              accounts: [
                'eip155:1:0xeth1',
                'eip155:56:0xbsc1',
                'eip155:56:0xbsc2'
              ],
              chains: ['eip155:56', 'eip155:1'],  // ✅ BSC first (active)
              methods: ['eth_sendTransaction'],
              events: ['chainChanged']
            }
          }
        },
      });

      const accounts = await promise;

      // ✅ Should use first chain in array as active (BSC)
      expect(accounts).toEqual(['0xbsc1', '0xbsc2']);
      expect(wallet.ethereum.getChainId()).toBe('0x38'); // BSC mainnet
    });

    test('should handle missing eip155 namespace in response', async () => {
      const promise = wallet.ethereum.request({ method: CONNECTION_METHODS.ETH_REQUEST_ACCOUNTS });
      simulateWalletMessage('READY');

      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: CONNECTION_METHODS.WALLET_REQUEST_CONNECTION,
        result: {
          namespaces: {
            solana: {  // Only Solana, no eip155
              accounts: ['solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp:sol1'],
              chains: ['solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp'],
              methods: ['solana_signMessage'],
              events: ['connect']
            }
          }
        },
      });

      await expect(promise).rejects.toThrow('No supported chains returned from wallet');
    });

    test('should handle error response', async () => {
      const promise = wallet.ethereum.request({ method: CONNECTION_METHODS.ETH_REQUEST_ACCOUNTS });
      simulateWalletMessage('READY');

      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: CONNECTION_METHODS.WALLET_REQUEST_CONNECTION,
        error: {
          code: 4001,
          message: 'User denied account access',
        },
      });

      await expect(promise).rejects.toThrow('User denied account access');
    });
  });

  describe('Chain switching', () => {
    beforeEach(async () => {
      const promise = wallet.ethereum.request({ method: CONNECTION_METHODS.ETH_REQUEST_ACCOUNTS });

      simulateWalletMessage('READY');
      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: CONNECTION_METHODS.WALLET_REQUEST_CONNECTION,
        result: {
          namespaces: {
            eip155: {
              accounts: [
                'eip155:1:0xeth1',
                'eip155:56:0xbsc1',
                'eip155:8453:0xbase1'
              ],
              chains: ['eip155:1', 'eip155:56', 'eip155:8453'],
              methods: ['eth_sendTransaction'],
              events: ['chainChanged', 'accountsChanged']
            }
          }
        },
      });

      await promise;
    });

    test('should switch chains and update accounts', async () => {
      const chainChangedListener = jest.fn();
      const accountsChangedListener = jest.fn();

      wallet.ethereum.on('chainChanged', chainChangedListener);
      wallet.ethereum.on('accountsChanged', accountsChangedListener);

      expect(wallet.ethereum.getAccounts()).toEqual(['0xeth1']);

      await wallet.ethereum.request({
        method: CONNECTION_METHODS.WALLET_SWITCH_ETHEREUM_CHAIN,
        params: [{ chainId: '0x38' }], // BSC mainnet
      });

      expect(wallet.ethereum.getChainId()).toBe('0x38');
      expect(wallet.ethereum.getAccounts()).toEqual(['0xbsc1']);
      expect(chainChangedListener).toHaveBeenCalledWith('0x38');
      expect(accountsChangedListener).toHaveBeenCalledWith(['0xbsc1']);
    });

    test('should reject unsupported chain', async () => {
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
      const promise = wallet.ethereum.request({ method: CONNECTION_METHODS.ETH_REQUEST_ACCOUNTS });

      simulateWalletMessage('READY');
      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: CONNECTION_METHODS.WALLET_REQUEST_CONNECTION,
        result: {
          namespaces: {
            eip155: {
              accounts: [
                'eip155:1:0xeth1',
                'eip155:56:0xbsc1'
              ],
              chains: ['eip155:1', 'eip155:56'],
              methods: ['personal_sign', 'eth_sendTransaction'],
              events: ['chainChanged']
            }
          }
        },
      });

      await promise;
    });

    test('should sign with current chain account', async () => {
      const promise = wallet.ethereum.request({
        method: EIP155_METHODS.PERSONAL_SIGN,
        params: ['Hello', '0xeth1'],
      });

      simulateWalletMessage('READY');

      expect(mockPopup.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          method: EIP155_METHODS.PERSONAL_SIGN,
          params: ['Hello', '0xeth1'],
          chainId: 'eip155:1',
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

    test('should reject signing with wrong chain account', async () => {
      await expect(
        wallet.ethereum.request({
          method: EIP155_METHODS.PERSONAL_SIGN,
          params: ['Hello', '0xbsc1'],
        })
      ).rejects.toThrow('not available on chain');
    });

    test('should sign after switching chains', async () => {
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

      expect(mockPopup.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          chainId: 'eip155:56',
        }),
        'http://localhost:3001'
      );

      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: EIP155_METHODS.PERSONAL_SIGN,
        result: '0xbscsig',
      });

      const signature = await promise;
      expect(signature).toBe('0xbscsig');
    });
  });

  describe('personal_sign', () => {
    beforeEach(async () => {
      const promise = wallet.ethereum.request({ method: CONNECTION_METHODS.ETH_REQUEST_ACCOUNTS });
      simulateWalletMessage('READY');
      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: CONNECTION_METHODS.WALLET_REQUEST_CONNECTION,
        result: {
          namespaces: {
            eip155: {
              accounts: [
                'eip155:1:0xeth1',
                'eip155:56:0xbsc1',
                'eip155:8453:0xbase1'
              ],
              chains: ['eip155:1', 'eip155:56', 'eip155:8453'],
              methods: ['personal_sign'],
              events: ['chainChanged']
            }
          }
        },
      });
      await promise;
      jest.clearAllMocks();
    });

    test('should handle empty message', async () => {
      const promise = wallet.ethereum.request({
        method: EIP155_METHODS.PERSONAL_SIGN,
        params: ['', '0xeth1'],
      });

      simulateWalletMessage('READY');
      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: EIP155_METHODS.PERSONAL_SIGN,
        result: '0xemptysig',
      });

      const signature = await promise;
      expect(signature).toBe('0xemptysig');
    });

    test('should handle user rejection', async () => {
      const promise = wallet.ethereum.request({
        method: EIP155_METHODS.PERSONAL_SIGN,
        params: ['Hello', '0xeth1'],
      });

      simulateWalletMessage('READY');
      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: EIP155_METHODS.PERSONAL_SIGN,
        error: { code: 4001, message: 'User rejected' },
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
          namespaces: {
            eip155: {
              accounts: ['eip155:1:0xeth1'],
              chains: ['eip155:1'],
              methods: ['eth_sendTransaction'],
              events: []
            }
          }
        },
      });
      await promise;
    });

    test('should send transaction with current chain', async () => {
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

    test('should reject transaction without from address', async () => {
      await expect(
        wallet.ethereum.request({
          method: EIP155_METHODS.ETH_SEND_TRANSACTION,
          params: [{ to: '0xrecipient', value: '0x1000' }],
        })
      ).rejects.toThrow('From address not connected');
    });
  });
});