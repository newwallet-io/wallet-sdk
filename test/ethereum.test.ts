// test/providers/ethereum.test.ts

import { EthereumProvider } from '../src/providers/ethereum';
import {
  CONNECTION_METHODS,
  EIP155_METHODS,
  CHAIN_IDS,
  ErrorCode,
} from '../src/types';

// Mock popup object
const mockPopup = {
  postMessage: jest.fn(),
  closed: false,
  close: jest.fn(),
};

// Mock window
Object.defineProperty(window, 'open', {
  writable: true,
  value: jest.fn(() => mockPopup)
});

// Track event listeners
const eventListeners: { [key: string]: Function[] } = {};
window.addEventListener = jest.fn((event: string, callback: Function) => {
  if (!eventListeners[event]) {
    eventListeners[event] = [];
  }
  eventListeners[event].push(callback);
}) as any;

window.removeEventListener = jest.fn() as any;

// Mock timers
global.setInterval = jest.fn(() => 123) as any;
global.clearInterval = jest.fn();

// Helper to simulate wallet messages
function simulateWalletMessage(type: string, data?: any) {
  const mockEvent = {
    origin: 'https://newwallet.io',
    data: type === 'READY' ? { type: 'READY' } : data,
  };
  
  if (eventListeners['message']) {
    eventListeners['message'].forEach(listener => listener(mockEvent));
  }
}

describe('EthereumProvider', () => {
  let provider: EthereumProvider;
  const walletUrl = 'https://newwallet.io/transaction_signing';
  
  beforeEach(() => {
    jest.clearAllMocks();
    mockPopup.closed = false;
    
    // Clear event listeners
    for (const key in eventListeners) {
      eventListeners[key] = [];
    }
    
    provider = new EthereumProvider(walletUrl);
  });

  describe('Connection', () => {
    it('should connect and request all EVM chains', async () => {
      const promise = provider.request({ method: CONNECTION_METHODS.ETH_REQUEST_ACCOUNTS });
      
      // Check popup opened
      expect(window.open).toHaveBeenCalledWith(
        walletUrl,
        expect.any(String),
        expect.any(String)
      );
      
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
              ]
            })
          }
        }),
        'https://newwallet.io'
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
            ]
          },
          chains: {
            eip155: 'eip155:1' // Active chain is Ethereum mainnet
          }
        }
      });

      const accounts = await promise;
      
      // Should return Ethereum mainnet accounts (current chain)
      expect(accounts).toEqual(['0xeth1', '0xeth2']);
      expect(provider.isConnected()).toBe(true);
      expect(provider.getChainId()).toBe('0x1');
      
      // Check accounts per chain
      expect(provider.getAccountsForChain('eip155:1')).toEqual(['0xeth1', '0xeth2']);
      expect(provider.getAccountsForChain('eip155:56')).toEqual(['0xbsc1', '0xbsc2']);
      expect(provider.getAccountsForChain('eip155:8453')).toEqual(['0xbase1']);
    });

    it('should handle wallet with active BSC chain', async () => {
      const promise = provider.request({ method: CONNECTION_METHODS.ETH_REQUEST_ACCOUNTS });
      
      simulateWalletMessage('READY');
      
      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: CONNECTION_METHODS.WALLET_REQUEST_CONNECTION,
        result: {
          accounts: {
            eip155: [
              'eip155:1:0xeth1',
              'eip155:56:0xbsc1',
              'eip155:56:0xbsc2',
            ]
          },
          chains: {
            eip155: 'eip155:56' // Active chain is BSC
          }
        }
      });

      const accounts = await promise;
      
      // Should return BSC accounts
      expect(accounts).toEqual(['0xbsc1', '0xbsc2']);
      expect(provider.getChainId()).toBe('0x38'); // BSC mainnet
    });
  });

  describe('Chain switching', () => {
    beforeEach(async () => {
      // Setup connected state
      const promise = provider.request({ method: CONNECTION_METHODS.ETH_REQUEST_ACCOUNTS });
      
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
            ]
          },
          supportedChains: [
            'eip155:1',
            'eip155:56', 
            'eip155:8453'
          ]
        }
      });
      
      await promise;
    });

    it('should switch chains and update accounts', async () => {
      const chainChangedListener = jest.fn();
      const accountsChangedListener = jest.fn();
      
      provider.on('chainChanged', chainChangedListener);
      provider.on('accountsChanged', accountsChangedListener);
      
      // Initially on Ethereum
      expect(provider.getAccounts()).toEqual(['0xeth1']);
      
      // Switch to BSC
      await provider.request({
        method: CONNECTION_METHODS.WALLET_SWITCH_ETHEREUM_CHAIN,
        params: [{ chainId: '0x38' }] // BSC mainnet
      });
      
      expect(provider.getChainId()).toBe('0x38');
      expect(provider.getAccounts()).toEqual(['0xbsc1']);
      expect(chainChangedListener).toHaveBeenCalledWith('0x38');
      expect(accountsChangedListener).toHaveBeenCalledWith(['0xbsc1']);
    });

    it('should reject unsupported chain', async () => {
      await expect(
        provider.request({
          method: CONNECTION_METHODS.WALLET_SWITCH_ETHEREUM_CHAIN,
          params: [{ chainId: '0x89' }] // Polygon - not supported
        })
      ).rejects.toThrow('not supported');
    });
  });

  describe('Signing methods', () => {
    beforeEach(async () => {
      // Setup connected state with different accounts per chain
      const promise = provider.request({ method: CONNECTION_METHODS.ETH_REQUEST_ACCOUNTS });
      
      simulateWalletMessage('READY');
      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: CONNECTION_METHODS.WALLET_REQUEST_CONNECTION,
        result: {
          accounts: {
            eip155: [
              'eip155:1:0xeth1',
              'eip155:56:0xbsc1',
            ]
          }
        }
      });
      
      await promise;
    });

    it('should sign with current chain account', async () => {
      const promise = provider.request({
        method: EIP155_METHODS.PERSONAL_SIGN,
        params: ['Hello', '0xeth1']
      });
      
      simulateWalletMessage('READY');
      
      // Check chainId is included
      expect(mockPopup.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          method: EIP155_METHODS.PERSONAL_SIGN,
          params: ['Hello', '0xeth1'],
          chainId: 'eip155:1' // Current chain
        }),
        'https://newwallet.io'
      );
      
      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: EIP155_METHODS.PERSONAL_SIGN,
        result: '0xsignature'
      });
      
      const signature = await promise;
      expect(signature).toBe('0xsignature');
    });

    it('should reject signing with wrong chain account', async () => {
      // Currently on Ethereum, try to sign with BSC account
      await expect(
        provider.request({
          method: EIP155_METHODS.PERSONAL_SIGN,
          params: ['Hello', '0xbsc1'] // BSC account on Ethereum chain
        })
      ).rejects.toThrow('not available on chain');
    });

    it('should sign after switching chains', async () => {
      // Switch to BSC
      await provider.request({
        method: CONNECTION_METHODS.WALLET_SWITCH_ETHEREUM_CHAIN,
        params: [{ chainId: '0x38' }]
      });
      
      jest.clearAllMocks();
      
      const promise = provider.request({
        method: EIP155_METHODS.PERSONAL_SIGN,
        params: ['Hello', '0xbsc1']
      });
      
      simulateWalletMessage('READY');
      
      // Check BSC chainId is used
      expect(mockPopup.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          method: EIP155_METHODS.PERSONAL_SIGN,
          params: ['Hello', '0xbsc1'],
          chainId: 'eip155:56' // BSC chain
        }),
        'https://newwallet.io'
      );
      
      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: EIP155_METHODS.PERSONAL_SIGN,
        result: '0xbsc_signature'
      });
      
      const signature = await promise;
      expect(signature).toBe('0xbsc_signature');
    });
  });

  describe('eth_sendTransaction', () => {
    beforeEach(async () => {
      const promise = provider.request({ method: CONNECTION_METHODS.ETH_REQUEST_ACCOUNTS });
      simulateWalletMessage('READY');
      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: CONNECTION_METHODS.WALLET_REQUEST_CONNECTION,
        result: {
          accounts: { eip155: ['eip155:1:0xeth1'] }
        }
      });
      await promise;
    });

    it('should send transaction with current chain', async () => {
      const tx = {
        from: '0xeth1',
        to: '0xrecipient',
        value: '0x1000'
      };
      
      const promise = provider.request({
        method: EIP155_METHODS.ETH_SEND_TRANSACTION,
        params: [tx]
      });
      
      simulateWalletMessage('READY');
      
      expect(mockPopup.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          method: EIP155_METHODS.ETH_SEND_TRANSACTION,
          params: [expect.objectContaining(tx)],
          chainId: 'eip155:1'
        }),
        'https://newwallet.io'
      );
      
      simulateWalletMessage('response', {
        jsonrpc: '2.0',
        method: EIP155_METHODS.ETH_SEND_TRANSACTION,
        result: '0xtxhash'
      });
      
      const txHash = await promise;
      expect(txHash).toBe('0xtxhash');
    });
  });
});