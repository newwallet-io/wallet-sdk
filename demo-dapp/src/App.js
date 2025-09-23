// App.js
import React, { useState, useEffect } from 'react';
import NewWallet from '@newwallet/wallet-sdk';
import EnvironmentSelector from './components/EnvironmentSelector';
import ConnectionSection from './components/ConnectionSection';
import EthereumSection from './components/EthereumSection';
import SolanaSection from './components/SolanaSection';
import ResultDisplay from './components/ResultDisplay';

function App() {
  // Environment state - default to testnet
  const [environment, setEnvironment] = useState('testnet');
  const [sdk, setSdk] = useState(null);
  
  // Connection state
  const [evmConnected, setEvmConnected] = useState(false);
  const [solanaConnected, setSolanaConnected] = useState(false);
  const [evmAccounts, setEvmAccounts] = useState([]);
  const [solanaPublicKey, setSolanaPublicKey] = useState('');
  const [currentEvmChain, setCurrentEvmChain] = useState('0xaa36a7'); // Default to Sepolia for testnet
  const [supportedEvmChains, setSupportedEvmChains] = useState([]);
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [lastAction, setLastAction] = useState('');
  const [lastResult, setLastResult] = useState(null);
  const [lastError, setLastError] = useState(null);
  const [requestData, setRequestData] = useState(null);

  // Wallet URLs
  const walletUrls = {
    mainnet: 'https://newwallet.io/transaction_signing',
    testnet: 'https://testnet.newwallet.io/transaction_signing',
    localhost: 'http://localhost:4040/transaction_signing'
  };

  // Initialize SDK when environment changes
  useEffect(() => {
    initializeSDK();
  }, [environment]);

  const initializeSDK = () => {
    try {
      const newSdk = new NewWallet({
        walletUrl: walletUrls[environment]
      });
      setSdk(newSdk);
      console.log(`SDK initialized with ${environment} environment`);
      console.log(`Wallet URL: ${walletUrls[environment]}`);
      
      // Reset connection states when environment changes
      if (evmConnected || solanaConnected) {
        disconnectAll();
      }
    } catch (error) {
      console.error('Failed to initialize SDK:', error);
      setLastError(error.message);
    }
  };

  // Connect to EVM chains
  const connectEVM = async () => {
    if (!sdk) {
      console.error('SDK not initialized');
      return;
    }
    
    setLoading(true);
    setLoadingMessage('Connecting to EVM chains...');
    setLastError(null);
    
    try {
      const accounts = await sdk.ethereum.request({
        method: 'eth_requestAccounts'
      });
      
      setEvmAccounts(accounts);
      setEvmConnected(true);
      
      // Get current chain
      const chainId = await sdk.ethereum.request({
        method: 'eth_chainId'
      });
      setCurrentEvmChain(chainId);
      
      // Get supported chains from SDK if available
      let chains = [];
      if (sdk.ethereum.getSupportedChains) {
        chains = sdk.ethereum.getSupportedChains();
      } else {
        // Fallback: Define default chains based on environment
        if (environment === 'mainnet') {
          chains = ['eip155:1', 'eip155:56', 'eip155:8453'];
        } else {
          chains = ['eip155:11155111', 'eip155:97', 'eip155:84532'];
        }
      }
      setSupportedEvmChains(chains);
      
      console.log('Connected to EVM chains:', {
        accounts,
        chainId,
        supportedChains: chains
      });
      
      showResult('eth_requestAccounts', accounts, { 
        method: 'eth_requestAccounts',
        environment,
        chainId,
        supportedChains: chains
      });
    } catch (error) {
      console.error('EVM connection failed:', error);
      setLastError(error.message);
      showResult('eth_requestAccounts', null, { error: error.message });
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  };

  // Connect to Solana
  const connectSolana = async () => {
    if (!sdk) {
      console.error('SDK not initialized');
      return;
    }
    
    setLoading(true);
    setLoadingMessage('Connecting to Solana...');
    setLastError(null);
    
    try {
      const publicKey = await sdk.solana.connect();
      
      setSolanaPublicKey(publicKey);
      setSolanaConnected(true);
      
      console.log('Connected to Solana:', publicKey);
      
      showResult('solana_connect', publicKey, { 
        method: 'solana_connect',
        environment
      });
    } catch (error) {
      console.error('Solana connection failed:', error);
      setLastError(error.message);
      showResult('solana_connect', null, { error: error.message });
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  };

  // Disconnect all
  const disconnectAll = async () => {
    if (sdk && solanaConnected) {
      try {
        await sdk.solana.disconnect();
      } catch (error) {
        console.error('Disconnect error:', error);
      }
    }
    
    setEvmConnected(false);
    setSolanaConnected(false);
    setEvmAccounts([]);
    setSolanaPublicKey('');
    setCurrentEvmChain(environment === 'mainnet' ? '0x1' : '0xaa36a7');
    setSupportedEvmChains([]);
    setLastAction('disconnect');
    setLastResult(null);
    setLastError(null);
  };

  // Execute EVM action
  const executeEvmAction = async (method, params) => {
    if (!sdk) {
      console.error('SDK not initialized');
      return;
    }
    
    setLoading(true);
    setLoadingMessage(`Executing ${method}...`);
    setLastError(null);
    
    try {
      const result = await sdk.ethereum.request({
        method,
        params
      });
      
      console.log(`EVM action success (${method}):`, result);
      showResult(method, result, { method, params, environment });
      return result;
    } catch (error) {
      console.error(`EVM action failed (${method}):`, error);
      setLastError(error.message);
      showResult(method, null, { method, params, error: error.message });
      throw error;
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  };

  // Execute Solana action
  const executeSolanaAction = async (method, params) => {
    if (!sdk) {
      console.error('SDK not initialized');
      return;
    }
    
    setLoading(true);
    setLoadingMessage(`Executing ${method}...`);
    setLastError(null);
    
    try {
      let result;
      
      switch(method) {
        case 'solana_signMessage':
          // SDK expects the message directly, it will add the publicKey internally
          result = await sdk.solana.signMessage(params);
          break;
          
        case 'solana_signTransaction':
          result = await sdk.solana.signTransaction(params);
          break;
          
        case 'solana_signAllTransactions':
          result = await sdk.solana.signAllTransactions(params);
          break;
          
        case 'solana_signAndSendTransaction':
          result = await sdk.solana.signAndSendTransaction(
            params.transaction, 
            params.sendOptions
          );
          break;
          
        default:
          throw new Error(`Unknown Solana method: ${method}`);
      }
      
      console.log(`Solana action success (${method}):`, result);
      showResult(method, result, { method, params: params, environment });
      return result;
    } catch (error) {
      console.error(`Solana action failed (${method}):`, error);
      setLastError(error.message);
      showResult(method, null, { method, params, error: error.message });
      throw error;
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  };

  // Show result
  const showResult = (action, result, request) => {
    setLastAction(action);
    setLastResult(result);
    setRequestData({
      ...request,
      result,
      timestamp: new Date().toISOString(),
      environment,
      walletUrl: walletUrls[environment]
    });
  };

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Optional: Add a subtle pattern or texture overlay */}
      <div className="fixed inset-0 bg-black/20"></div>
      
      <div className="relative z-10 min-h-screen p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <header className="text-center mb-8 py-8">
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-4 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-600">
              🔐 NewWallet SDK Demo
            </h1>
            <p className="text-xl text-gray-300">
              Test all SDK features with different environments
            </p>
          </header>

          {/* Main Container */}
          <div className="backdrop-blur-xl bg-white/10 rounded-3xl shadow-2xl border border-white/20 overflow-hidden">
            {/* Environment Selector */}
            <EnvironmentSelector
              environment={environment}
              onEnvironmentChange={setEnvironment}
            />

            {/* Loading Indicator */}
            {loading && (
              <div className="bg-yellow-500/20 border-b border-yellow-500/30 px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-yellow-200 font-medium">{loadingMessage}</span>
                </div>
              </div>
            )}

            {/* Main Content */}
            <div className="p-6 md:p-8 space-y-6">
              {/* Connection Section */}
              <ConnectionSection
                evmConnected={evmConnected}
                solanaConnected={solanaConnected}
                evmAccounts={evmAccounts}
                solanaPublicKey={solanaPublicKey}
                onConnectEVM={connectEVM}
                onConnectSolana={connectSolana}
                onDisconnect={disconnectAll}
                loading={loading}
              />

              {/* EVM Section */}
              {evmConnected && (
                <EthereumSection
                  sdk={sdk}
                  accounts={evmAccounts}
                  currentChain={currentEvmChain}
                  supportedChains={supportedEvmChains}
                  onChainChange={setCurrentEvmChain}
                  onExecute={executeEvmAction}
                  loading={loading}
                  environment={environment}
                />
              )}

              {/* Solana Section */}
              {solanaConnected && (
                <SolanaSection
                  sdk={sdk}
                  publicKey={solanaPublicKey}
                  onExecute={executeSolanaAction}
                  loading={loading}
                  environment={environment}
                />
              )}

              {/* Result Display */}
              {(lastAction || lastError) && (
                <ResultDisplay
                  lastAction={lastAction}
                  lastResult={lastResult}
                  lastError={lastError}
                  requestData={requestData}
                  onClear={() => {
                    setLastAction('');
                    setLastResult(null);
                    setLastError(null);
                    setRequestData(null);
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;