# Integrating NewWallet SDK with Web Frameworks

This guide provides examples of how to integrate NewWallet SDK with popular web frameworks.

## Table of Contents
- [React](#react)
  - [Basic Integration](#react-basic-integration)
  - [Custom Hook](#react-custom-hook)
  - [Context Provider](#react-context-provider)
- [Vue.js](#vuejs)
  - [Basic Integration](#vue-basic-integration)
  - [Composable](#vue-composable)
- [Angular](#angular)
  - [Service-based Integration](#angular-service)
- [Next.js](#nextjs)
- [Svelte](#svelte)

## React <a name="react"></a>

### Basic Integration <a name="react-basic-integration"></a>

```jsx
import React, { useState, useEffect } from 'react';
import NewWallet from '@newwallet/wallet-sdk';

function WalletConnection() {
  const [wallet, setWallet] = useState(null);
  const [account, setAccount] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  
  useEffect(() => {
    // Initialize wallet
    const newWallet = new NewWallet();
    setWallet(newWallet);
    
    return () => {
      // Cleanup if needed
    };
  }, []);
  
  useEffect(() => {
    if (!wallet?.ethereum) return;
    
    const handleAccountsChanged = (accounts) => {
      console.log('Accounts changed:', accounts);
      setAccount(accounts[0] || null);
    };
    
    const handleChainChanged = (chainId) => {
      console.log('Chain changed:', chainId);
      setChainId(chainId);
    };
    
    wallet.ethereum.on('accountsChanged', handleAccountsChanged);
    wallet.ethereum.on('chainChanged', handleChainChanged);
    
    // Cleanup on unmount
    return () => {
      wallet.ethereum.off('accountsChanged', handleAccountsChanged);
      wallet.ethereum.off('chainChanged', handleChainChanged);
    };
  }, [wallet]);
  
  const connectWallet = async () => {
    if (!wallet?.ethereum) return;
    
    setIsConnecting(true);
    try {
      const accounts = await wallet.ethereum.request({
        method: 'eth_requestAccounts'
      });
      setAccount(accounts[0]);
      
      const chainId = await wallet.ethereum.request({
        method: 'eth_chainId'
      });
      setChainId(chainId);
    } catch (error) {
      console.error('Connection error:', error);
    } finally {
      setIsConnecting(false);
    }
  };
  
  return (
    <div>
      {!account ? (
        <button onClick={connectWallet} disabled={isConnecting}>
          {isConnecting ? 'Connecting...' : 'Connect Wallet'}
        </button>
      ) : (
        <div>
          <p>Connected Account: {account}</p>
          <p>Chain ID: {chainId}</p>
          <button onClick={() => setAccount(null)}>Disconnect</button>
        </div>
      )}
    </div>
  );
}

export default WalletConnection;
```

### Custom Hook <a name="react-custom-hook"></a>

Create a reusable hook for wallet functionality:

```jsx
// useWallet.js
import { useState, useEffect } from 'react';
import NewWallet from '@newwallet/wallet-sdk';

export function useWallet() {
  const [wallet] = useState(() => new NewWallet());
  const [account, setAccount] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    if (!wallet?.ethereum) return;
    
    const handleAccountsChanged = (accounts) => {
      setAccount(accounts[0] || null);
    };
    
    const handleChainChanged = (chainId) => {
      setChainId(chainId);
    };
    
    wallet.ethereum.on('accountsChanged', handleAccountsChanged);
    wallet.ethereum.on('chainChanged', handleChainChanged);
    
    return () => {
      wallet.ethereum.off('accountsChanged', handleAccountsChanged);
      wallet.ethereum.off('chainChanged', handleChainChanged);
    };
  }, [wallet]);
  
  const connect = async () => {
    if (!wallet?.ethereum) {
      setError(new Error('Wallet not available'));
      return;
    }
    
    setIsConnecting(true);
    setError(null);
    
    try {
      const accounts = await wallet.ethereum.request({
        method: 'eth_requestAccounts'
      });
      setAccount(accounts[0]);
      
      const chainId = await wallet.ethereum.request({
        method: 'eth_chainId'
      });
      setChainId(chainId);
    } catch (error) {
      setError(error);
      console.error('Connection error:', error);
    } finally {
      setIsConnecting(false);
    }
  };
  
  const disconnect = () => {
    setAccount(null);
  };
  
  return {
    wallet,
    account,
    chainId,
    isConnecting,
    error,
    connect,
    disconnect
  };
}
```

Usage:

```jsx
import React from 'react';
import { useWallet } from './useWallet';

function WalletComponent() {
  const { account, chainId, isConnecting, error, connect, disconnect } = useWallet();
  
  return (
    <div>
      {error && <p style={{ color: 'red' }}>{error.message}</p>}
      
      {!account ? (
        <button onClick={connect} disabled={isConnecting}>
          {isConnecting ? 'Connecting...' : 'Connect Wallet'}
        </button>
      ) : (
        <div>
          <p>Connected Account: {account}</p>
          <p>Chain ID: {chainId}</p>
          <button onClick={disconnect}>Disconnect</button>
        </div>
      )}
    </div>
  );
}
```

### Context Provider <a name="react-context-provider"></a>

For application-wide wallet state:

```jsx
// WalletContext.js
import React, { createContext, useContext, useState, useEffect } from 'react';
import NewWallet from '@newwallet/wallet-sdk';

const WalletContext = createContext(null);

export function WalletProvider({ children }) {
  const [wallet] = useState(() => new NewWallet());
  const [account, setAccount] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    if (!wallet?.ethereum) return;
    
    const handleAccountsChanged = (accounts) => {
      setAccount(accounts[0] || null);
    };
    
    const handleChainChanged = (chainId) => {
      setChainId(chainId);
    };
    
    wallet.ethereum.on('accountsChanged', handleAccountsChanged);
    wallet.ethereum.on('chainChanged', handleChainChanged);
    
    return () => {
      wallet.ethereum.off('accountsChanged', handleAccountsChanged);
      wallet.ethereum.off('chainChanged', handleChainChanged);
    };
  }, [wallet]);
  
  const connect = async () => {
    if (!wallet?.ethereum) {
      setError(new Error('Wallet not available'));
      return;
    }
    
    setIsConnecting(true);
    setError(null);
    
    try {
      const accounts = await wallet.ethereum.request({
        method: 'eth_requestAccounts'
      });
      setAccount(accounts[0]);
      
      const chainId = await wallet.ethereum.request({
        method: 'eth_chainId'
      });
      setChainId(chainId);
    } catch (error) {
      setError(error);
    } finally {
      setIsConnecting(false);
    }
  };
  
  const disconnect = () => {
    setAccount(null);
  };
  
  const value = {
    wallet,
    account,
    chainId,
    isConnecting,
    error,
    connect,
    disconnect
  };
  
  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}
```

Usage:

```jsx
// App.js
import React from 'react';
import { WalletProvider } from './WalletContext';
import WalletStatus from './WalletStatus';
import SendTransaction from './SendTransaction';

function App() {
  return (
    <WalletProvider>
      <div className="App">
        <h1>My DApp</h1>
        <WalletStatus />
        <SendTransaction />
      </div>
    </WalletProvider>
  );
}

// WalletStatus.js
import React from 'react';
import { useWallet } from './WalletContext';

function WalletStatus() {
  const { account, chainId, isConnecting, error, connect, disconnect } = useWallet();
  
  return (
    <div>
      {error && <p style={{ color: 'red' }}>{error.message}</p>}
      
      {!account ? (
        <button onClick={connect} disabled={isConnecting}>
          {isConnecting ? 'Connecting...' : 'Connect Wallet'}
        </button>
      ) : (
        <div>
          <p>Connected Account: {account}</p>
          <p>Chain ID: {chainId}</p>
          <button onClick={disconnect}>Disconnect</button>
        </div>
      )}
    </div>
  );
}
```

## Vue.js <a name="vuejs"></a>

### Basic Integration <a name="vue-basic-integration"></a>

```vue
<!-- WalletConnection.vue -->
<template>
  <div>
    <div v-if="error" class="error">{{ error.message }}</div>
    
    <button v-if="!account" @click="connect" :disabled="isConnecting">
      {{ isConnecting ? 'Connecting...' : 'Connect Wallet' }}
    </button>
    
    <div v-else>
      <p>Connected Account: {{ account }}</p>
      <p>Chain ID: {{ chainId }}</p>
      <button @click="disconnect">Disconnect</button>
    </div>
  </div>
</template>

<script>
import NewWallet from '@newwallet/wallet-sdk';

export default {
  data() {
    return {
      wallet: null,
      account: null,
      chainId: null,
      isConnecting: false,
      error: null
    };
  },
  created() {
    this.wallet = new NewWallet();
  },
  mounted() {
    if (this.wallet?.ethereum) {
      this.wallet.ethereum.on('accountsChanged', this.handleAccountsChanged);
      this.wallet.ethereum.on('chainChanged', this.handleChainChanged);
    }
  },
  beforeDestroy() {
    if (this.wallet?.ethereum) {
      this.wallet.ethereum.off('accountsChanged', this.handleAccountsChanged);
      this.wallet.ethereum.off('chainChanged', this.handleChainChanged);
    }
  },
  methods: {
    async connect() {
      if (!this.wallet?.ethereum) {
        this.error = new Error('Wallet not available');
        return;
      }
      
      this.isConnecting = true;
      this.error = null;
      
      try {
        const accounts = await this.wallet.ethereum.request({
          method: 'eth_requestAccounts'
        });
        this.account = accounts[0];
        
        const chainId = await this.wallet.ethereum.request({
          method: 'eth_chainId'
        });
        this.chainId = chainId;
      } catch (error) {
        this.error = error;
        console.error('Connection error:', error);
      } finally {
        this.isConnecting = false;
      }
    },
    disconnect() {
      this.account = null;
    },
    handleAccountsChanged(accounts) {
      this.account = accounts[0] || null;
    },
    handleChainChanged(chainId) {
      this.chainId = chainId;
    }
  }
};
</script>

<style scoped>
.error {
  color: red;
  margin-bottom: 10px;
}
</style>
```

### Composable <a name="vue-composable"></a>

For Vue 3 with Composition API:

```javascript
// useWallet.js
import { ref, onMounted, onBeforeUnmount } from 'vue';
import NewWallet from '@newwallet/wallet-sdk';

export function useWallet() {
  const wallet = ref(new NewWallet());
  const account = ref(null);
  const chainId = ref(null);
  const isConnecting = ref(false);
  const error = ref(null);
  
  function handleAccountsChanged(accounts) {
    account.value = accounts[0] || null;
  }
  
  function handleChainChanged(newChainId) {
    chainId.value = newChainId;
  }
  
  onMounted(() => {
    if (wallet.value?.ethereum) {
      wallet.value.ethereum.on('accountsChanged', handleAccountsChanged);
      wallet.value.ethereum.on('chainChanged', handleChainChanged);
    }
  });
  
  onBeforeUnmount(() => {
    if (wallet.value?.ethereum) {
      wallet.value.ethereum.off('accountsChanged', handleAccountsChanged);
      wallet.value.ethereum.off('chainChanged', handleChainChanged);
    }
  });
  
  async function connect() {
    if (!wallet.value?.ethereum) {
      error.value = new Error('Wallet not available');
      return;
    }
    
    isConnecting.value = true;
    error.value = null;
    
    try {
      const accounts = await wallet.value.ethereum.request({
        method: 'eth_requestAccounts'
      });
      account.value = accounts[0];
      
      const newChainId = await wallet.value.ethereum.request({
        method: 'eth_chainId'
      });
      chainId.value = newChainId;
    } catch (err) {
      error.value = err;
      console.error('Connection error:', err);
    } finally {
      isConnecting.value = false;
    }
  }
  
  function disconnect() {
    account.value = null;
  }
  
  return {
    wallet,
    account,
    chainId,
    isConnecting,
    error,
    connect,
    disconnect
  };
}
```

Usage in a Vue 3 component:

```vue
<template>
  <div>
    <div v-if="error" class="error">{{ error.message }}</div>
    
    <button v-if="!account" @click="connect" :disabled="isConnecting">
      {{ isConnecting ? 'Connecting...' : 'Connect Wallet' }}
    </button>
    
    <div v-else>
      <p>Connected Account: {{ account }}</p>
      <p>Chain ID: {{ chainId }}</p>
      <button @click="disconnect">Disconnect</button>
    </div>
  </div>
</template>

<script setup>
import { useWallet } from './useWallet';

const { account, chainId, isConnecting, error, connect, disconnect } = useWallet();
</script>
```

## Angular <a name="angular"></a>

### Service-based Integration <a name="angular-service"></a>

```typescript
// wallet.service.ts
import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import NewWallet from '@newwallet/wallet-sdk';

@Injectable({
  providedIn: 'root'
})
export class WalletService implements OnDestroy {
  private wallet: any;
  private accountSubject = new BehaviorSubject<string | null>(null);
  private chainIdSubject = new BehaviorSubject<string | null>(null);
  private isConnectingSubject = new BehaviorSubject<boolean>(false);
  private errorSubject = new BehaviorSubject<Error | null>(null);
  
  account$: Observable<string | null> = this.accountSubject.asObservable();
  chainId$: Observable<string | null> = this.chainIdSubject.asObservable();
  isConnecting$: Observable<boolean> = this.isConnectingSubject.asObservable();
  error$: Observable<Error | null> = this.errorSubject.asObservable();
  
  constructor() {
    this.wallet = new NewWallet();
    
    if (this.wallet?.ethereum) {
      this.wallet.ethereum.on('accountsChanged', this.handleAccountsChanged.bind(this));
      this.wallet.ethereum.on('chainChanged', this.handleChainChanged.bind(this));
    }
  }
  
  ngOnDestroy() {
    if (this.wallet?.ethereum) {
      this.wallet.ethereum.off('accountsChanged', this.handleAccountsChanged.bind(this));
      this.wallet.ethereum.off('chainChanged', this.handleChainChanged.bind(this));
    }
  }
  
  private handleAccountsChanged(accounts: string[]) {
    this.accountSubject.next(accounts[0] || null);
  }
  
  private handleChainChanged(chainId: string) {
    this.chainIdSubject.next(chainId);
  }
  
  async connect(): Promise<void> {
    if (!this.wallet?.ethereum) {
      this.errorSubject.next(new Error('Wallet not available'));
      return;
    }
    
    this.isConnectingSubject.next(true);
    this.errorSubject.next(null);
    
    try {
      const accounts = await this.wallet.ethereum.request({
        method: 'eth_requestAccounts'
      });
      this.accountSubject.next(accounts[0]);
      
      const chainId = await this.wallet.ethereum.request({
        method: 'eth_chainId'
      });
      this.chainIdSubject.next(chainId);
    } catch (error) {
      this.errorSubject.next(error as Error);
      console.error('Connection error:', error);
    } finally {
      this.isConnectingSubject.next(false);
    }
  }
  
  disconnect(): void {
    this.accountSubject.next(null);
  }
  
  getWallet(): any {
    return this.wallet;
  }
}
```

Component usage:

```typescript
// wallet.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { WalletService } from './wallet.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-wallet',
  template: `
    <div *ngIf="error" class="error">{{ error.message }}</div>
    
    <button *ngIf="!account" (click)="connect()" [disabled]="isConnecting">
      {{ isConnecting ? 'Connecting...' : 'Connect Wallet' }}
    </button>
    
    <div *ngIf="account">
      <p>Connected Account: {{ account }}</p>
      <p>Chain ID: {{ chainId }}</p>
      <button (click)="disconnect()">Disconnect</button>
    </div>
  `,
  styles: [
    '.error { color: red; margin-bottom: 10px; }'
  ]
})
export class WalletComponent implements OnInit, OnDestroy {
  account: string | null = null;
  chainId: string | null = null;
  isConnecting: boolean = false;
  error: Error | null = null;
  
  private subscriptions: Subscription[] = [];
  
  constructor(private walletService: WalletService) {}
  
  ngOnInit(): void {
    this.subscriptions.push(
      this.walletService.account$.subscribe(account => this.account = account),
      this.walletService.chainId$.subscribe(chainId => this.chainId = chainId),
      this.walletService.isConnecting$.subscribe(isConnecting => this.isConnecting = isConnecting),
      this.walletService.error$.subscribe(error => this.error = error)
    );
  }
  
  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
  
  connect(): void {
    this.walletService.connect();
  }
  
  disconnect(): void {
    this.walletService.disconnect();
  }
}
```

## Next.js <a name="nextjs"></a>

Next.js integration is similar to React, but with additional considerations for server-side rendering.

```jsx
// hooks/useWallet.js
import { useState, useEffect } from 'react';

export function useWallet() {
  const [wallet, setWallet] = useState(null);
  const [account, setAccount] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);
  
  // Initialize wallet client-side only
  useEffect(() => {
    // Dynamic import to avoid SSR issues
    import('@newwallet/wallet-sdk').then((NewWalletModule) => {
      const NewWallet = NewWalletModule.default;
      setWallet(new NewWallet());
    });
  }, []);
  
  useEffect(() => {
    if (!wallet?.ethereum) return;
    
    const handleAccountsChanged = (accounts) => {
      setAccount(accounts[0] || null);
    };
    
    const handleChainChanged = (chainId) => {
      setChainId(chainId);
    };
    
    wallet.ethereum.on('accountsChanged', handleAccountsChanged);
    wallet.ethereum.on('chainChanged', handleChainChanged);
    
    return () => {
      wallet.ethereum.off('accountsChanged', handleAccountsChanged);
      wallet.ethereum.off('chainChanged', handleChainChanged);
    };
  }, [wallet]);
  
  // Rest of the hook implementation...
  
  return {
    wallet,
    account,
    chainId,
    isConnecting,
    error,
    connect,
    disconnect
  };
}
```

## Svelte <a name="svelte"></a>

```svelte
<!-- Wallet.svelte -->
<script>
  import { onMount, onDestroy } from 'svelte';
  import NewWallet from '@newwallet/wallet-sdk';
  
  let wallet;
  let account = null;
  let chainId = null;
  let isConnecting = false;
  let error = null;
  
  onMount(() => {
    wallet = new NewWallet();
    
    if (wallet?.ethereum) {
      wallet.ethereum.on('accountsChanged', handleAccountsChanged);
      wallet.ethereum.on('chainChanged', handleChainChanged);
    }
  });
  
  onDestroy(() => {
    if (wallet?.ethereum) {
      wallet.ethereum.off('accountsChanged', handleAccountsChanged);
      wallet.ethereum.off('chainChanged', handleChainChanged);
    }
  });
  
  function handleAccountsChanged(accounts) {
    account = accounts[0] || null;
  }
  
  function handleChainChanged(newChainId) {
    chainId = newChainId;
  }
  
  async function connect() {
    if (!wallet?.ethereum) {
      error = new Error('Wallet not available');
      return;
    }
    
    isConnecting = true;
    error = null;
    
    try {
      const accounts = await wallet.ethereum.request({
        method: 'eth_requestAccounts'
      });
      account = accounts[0];
      
      const newChainId = await wallet.ethereum.request({
        method: 'eth_chainId'
      });
      chainId = newChainId;
    } catch (err) {
      error = err;
      console.error('Connection error:', err);
    } finally {
      isConnecting = false;
    }
  }
  
  function disconnect() {
    account = null;
  }
</script>

{#if error}
  <div class="error">{error.message}</div>
{/if}

{#if !account}
  <button on:click={connect} disabled={isConnecting}>
    {isConnecting ? 'Connecting...' : 'Connect Wallet'}
  </button>
{:else}
  <div>
    <p>Connected Account: {account}</p>
    <p>Chain ID: {chainId}</p>
    <button on:click={disconnect}>Disconnect</button>
  </div>
{/if}

<style>
  .error {
    color: red;
    margin-bottom: 10px;
  }
</style>
```

## Multi-Chain Support

Here's an example of how to support both Ethereum and Solana in React:

```jsx
// useMultiChainWallet.js
import { useState, useEffect } from 'react';
import NewWallet from '@newwallet/wallet-sdk';

export function useMultiChainWallet() {
  const [wallet] = useState(() => new NewWallet());
  const [ethAccount, setEthAccount] = useState(null);
  const [solAccount, setSolAccount] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    if (!wallet?.ethereum) return;
    
    const handleAccountsChanged = (accounts) => {
      setEthAccount(accounts[0] || null);
    };
    
    const handleChainChanged = (chainId) => {
      setChainId(chainId);
    };
    
    wallet.ethereum.on('accountsChanged', handleAccountsChanged);
    wallet.ethereum.on('chainChanged', handleChainChanged);
    
    return () => {
      wallet.ethereum.off('accountsChanged', handleAccountsChanged);
      wallet.ethereum.off('chainChanged', handleChainChanged);
    };
  }, [wallet]);
  
  useEffect(() => {
    if (!wallet?.solana) return;
    
    const handleConnect = (publicKey) => {
      setSolAccount(publicKey);
    };
    
    const handleDisconnect = () => {
      setSolAccount(null);
    };
    
    wallet.solana.on('connect', handleConnect);
    wallet.solana.on('disconnect', handleDisconnect);
    
    return () => {
      wallet.solana.off('connect', handleConnect);
      wallet.solana.off('disconnect', handleDisconnect);
    };
  }, [wallet]);
  
  const connectEthereum = async () => {
    if (!wallet?.ethereum) {
      setError(new Error('Ethereum wallet not available'));
      return;
    }
    
    setIsConnecting(true);
    setError(null);
    
    try {
      const accounts = await wallet.ethereum.request({
        method: 'eth_requestAccounts'
      });
      setEthAccount(accounts[0]);
      
      const chainId = await wallet.ethereum.request({
        method: 'eth_chainId'
      });
      setChainId(chainId);
    } catch (error) {
      setError(error);
    } finally {
      setIsConnecting(false);
    }
  };
  
  const connectSolana = async () => {
    if (!wallet?.solana) {
      setError(new Error('Solana wallet not available'));
      return;
    }
    
    setIsConnecting(true);
    setError(null);
    
    try {
      const publicKey = await wallet.solana.connect();
      setSolAccount(publicKey);
    } catch (error) {
      setError(error);
    } finally {
      setIsConnecting(false);
    }
  };
  
  const disconnectEthereum = () => {
    setEthAccount(null);
  };
  
  const disconnectSolana = async () => {
    if (wallet?.solana) {
      await wallet.solana.disconnect();
    }
  };
  
  return {
    wallet,
    ethAccount,
    solAccount,
    chainId,
    isConnecting,
    error,
    connectEthereum,
    connectSolana,
    disconnectEthereum,
    disconnectSolana
  };
}
```

Usage:

```jsx
import React from 'react';
import { useMultiChainWallet } from './useMultiChainWallet';

function MultiChainWallet() {
  const {
    ethAccount,
    solAccount,
    chainId,
    isConnecting,
    error,
    connectEthereum,
    connectSolana,
    disconnectEthereum,
    disconnectSolana
  } = useMultiChainWallet();
  
  return (
    <div>
      <h2>Multi-Chain Wallet</h2>
      
      {error && <p style={{ color: 'red' }}>{error.message}</p>}
      
      <div style={{ marginBottom: '20px' }}>
        <h3>Ethereum</h3>
        {!ethAccount ? (
          <button onClick={connectEthereum} disabled={isConnecting}>
            {isConnecting ? 'Connecting...' : 'Connect Ethereum'}
          </button>
        ) : (
          <div>
            <p>Connected Account: {ethAccount}</p>
            <p>Chain ID: {chainId}</p>
            <button onClick={disconnectEthereum}>Disconnect Ethereum</button>
          </div>
        )}
      </div>
      
      <div>
        <h3>Solana</h3>
        {!solAccount ? (
          <button onClick={connectSolana} disabled={isConnecting}>
            {isConnecting ? 'Connecting...' : 'Connect Solana'}
          </button>
        ) : (
          <div>
            <p>Connected Public Key: {solAccount}</p>
            <button onClick={disconnectSolana}>Disconnect Solana</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default MultiChainWallet;
```