import React, { useState, useEffect } from 'react';
import './DemoApp.css';
import EthereumTab from './EthereumTab';
import SolanaTab from './SolanaTab';
import NewWallet from '@newwallet/wallet-sdk';

const DemoApp = () => {
  const [activeTab, setActiveTab] = useState('ethereum');
  const [wallet, setWallet] = useState(null);
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const [sdkError, setSdkError] = useState(null);

  useEffect(() => {
    // Load the SDK from the window object
    // The SDK should be loaded via a script tag in index.html
    const initializeWallet = () => {
        try {
          const walletInstance = new NewWallet({
            walletUrl: 'http://localhost:3001' // URL to your wallet app
          });
          console.log('Wallet instance created:', walletInstance);
          setWallet(walletInstance);
          setSdkLoaded(true);
        } catch (error) {
          console.error('Error initializing wallet:', error);
          setSdkError(`Failed to initialize SDK: ${error.message}`);
        }
      };

    initializeWallet();
  }, []);

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