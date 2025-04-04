import React, { useState, useEffect } from 'react';
import './DemoApp.css';
import EthereumTab from './EthereumTab';
import SolanaTab from './SolanaTab';
import NewWallet from '@newwallet/wallet-sdk';
import { WALLET_URLS, DEFAULT_WALLET_URL } from '../utils/Networks';

const DemoApp = () => {
  const [activeTab, setActiveTab] = useState('ethereum');
  const [wallet, setWallet] = useState(null);
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const [sdkError, setSdkError] = useState(null);
  const [selectedWalletUrl, setSelectedWalletUrl] = useState(DEFAULT_WALLET_URL);
  const [environment, setEnvironment] = useState('localhost');

  // Initialize the wallet when selected URL changes
  useEffect(() => {
    const initializeWallet = () => {
      try {
        const walletInstance = new NewWallet({
          walletUrl: selectedWalletUrl
        });
        console.log('Wallet instance created with URL:', selectedWalletUrl);
        setWallet(walletInstance);
        setSdkLoaded(true);
        setSdkError(null);

        // Determine environment from URL
        if (selectedWalletUrl === WALLET_URLS.localhost) {
          setEnvironment('localhost');
        } else if (selectedWalletUrl === WALLET_URLS.testnet) {
          setEnvironment('testnet');
        } else if (selectedWalletUrl === WALLET_URLS.mainnet) {
          setEnvironment('mainnet');
        }
      } catch (error) {
        console.error('Error initializing wallet:', error);
        setSdkError(`Failed to initialize SDK: ${error.message}`);
        setSdkLoaded(false);
      }
    };

    initializeWallet();
  }, [selectedWalletUrl]);

  // Handle wallet URL change
  const handleWalletUrlChange = (event) => {
    const newUrl = event.target.value;
    setSelectedWalletUrl(newUrl);
  };

  // Handle environment button clicks
  const setWalletEnvironment = (env) => {
    if (env === 'localhost') {
      setSelectedWalletUrl(WALLET_URLS.localhost);
    } else if (env === 'testnet') {
      setSelectedWalletUrl(WALLET_URLS.testnet);
    } else if (env === 'mainnet') {
      setSelectedWalletUrl(WALLET_URLS.mainnet);
    }
  };

  if (sdkError) {
    return (
      <div className="error-container">
        <h1>Error</h1>
        <p>{sdkError}</p>
        <p>Please make sure the SDK is properly built and loaded.</p>
      </div>
    );
  }

  if (!sdkLoaded) {
    return (
      <div className="loading-container">
        <h1>Loading SDK...</h1>
        <p>Please wait while we initialize the wallet SDK.</p>
      </div>
    );
  }

  return (
    <div className="container">
      <h1>NewWallet Demo DApp</h1>
      
      <div className="wallet-config">
        <div className="form-group">
          <label htmlFor="wallet-url">Wallet URL:</label>
          <select 
            id="wallet-url" 
            value={selectedWalletUrl}
            onChange={handleWalletUrlChange}
            className="wallet-url-select"
          >
            <option value={WALLET_URLS.localhost}>Localhost</option>
            <option value={WALLET_URLS.testnet}>Testnet</option>
            <option value={WALLET_URLS.mainnet}>Mainnet</option>
          </select>
          <span className={`environment-badge environment-${environment}`}>
            {environment}
          </span>
        </div>
      </div>
      
      <div className="tabs">
        <button 
          className={`tab-btn ${activeTab === 'ethereum' ? 'active' : ''}`} 
          onClick={() => setActiveTab('ethereum')}
        >
          Ethereum
        </button>
        <button 
          className={`tab-btn ${activeTab === 'solana' ? 'active' : ''}`} 
          onClick={() => setActiveTab('solana')}
        >
          Solana
        </button>
      </div>
      
      <div className="tab-content">
        {activeTab === 'ethereum' ? (
          <EthereumTab wallet={wallet} />
        ) : (
          <SolanaTab wallet={wallet} />
        )}
      </div>
    </div>
  );
};

export default DemoApp;