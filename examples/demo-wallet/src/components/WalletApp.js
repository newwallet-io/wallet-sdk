import React, { useState, useEffect } from 'react';
import './WalletApp.css';
import WelcomePanel from './WelcomePanel';
import RequestPanel from './RequestPanel';

// Mock account data
const MOCK_ACCOUNTS = {
  ethereum: {
    address: "0x1234567890123456789012345678901234567890",
    chainId: "0x1" // Ethereum Mainnet
  },
  solana: {
    publicKey: "GfEHGBwXDwL5RKmZFQKQx8F9MTiogi7XKD7pzYz3YTEu"
  }
};

const WalletApp = () => {
  const [currentNetwork, setCurrentNetwork] = useState(null);
  const [requestData, setRequestData] = useState(null);
  const [requestOrigin, setRequestOrigin] = useState(null);
  const [activePanelType, setActivePanelType] = useState('welcome');
  const [showDebug, setShowDebug] = useState(false);

  // Listen for messages from DApps
  useEffect(() => {
    // Send READY message to opener when the wallet loads
    if (window.opener) {
      window.opener.postMessage({ type: "READY" }, "*");
      console.log('Sent READY message to opener');
    }
    
    // Listen for messages
    const handleMessage = (event) => {
      const { data, origin } = event;
      console.log('Received message:', data, 'from origin:', origin);
      
      // Store request data
      setRequestData(data);
      setRequestOrigin(origin);
      
      // Set current network
      if (data.network) {
        setCurrentNetwork(data.network);
      }
      
      // Handle different request types
      if (data.network === 'ethereum') {
        if (data.type === 'CONNECT_WALLET') {
          setActivePanelType('eth-connect');
        } else if (data.type === 'ETH_SIGN_TRANSACTION') {
          setActivePanelType('eth-sign-tx');
        } else if (data.type === 'ETH_SIGN_MESSAGE') {
          setActivePanelType('eth-sign-msg');
        }
      } else if (data.network === 'solana') {
        if (data.type === 'CONNECT_WALLET') {
          setActivePanelType('sol-connect');
        } else if (data.type === 'SOL_SIGN_TRANSACTION') {
          setActivePanelType('sol-sign-tx');
        } else if (data.type === 'SOL_SIGN_MESSAGE') {
          setActivePanelType('sol-sign-msg');
        } else if (data.type === 'SOL_SIGN_ALL_TRANSACTIONS') {
          setActivePanelType('sol-sign-all-tx');
        } else if (data.type === 'SOL_SIGN_AND_SEND_TRANSACTION') {
          setActivePanelType('sol-sign-send-tx');
        }
      }
    };
    
    window.addEventListener('message', handleMessage);
    
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  
  // Send response to DApp and close wallet
  const sendResponse = (success, result, errorCode, message) => {
    if (window.opener && requestData && requestOrigin) {
      const response = {
        type: requestData.type,
        network: requestData.network,
        payload: {
          success,
          message: message || (success ? 'Success' : 'User rejected the request'),
          result,
          errorCode
        }
      };
      
      console.log('Sending response to DApp:', response);
      window.opener.postMessage(response, requestOrigin);
      
      // Close the wallet window after sending the response
      window.close();
    }
  };
  
  // Handle request approval
  const handleApprove = () => {
    if (!requestData) return;
    
    if (requestData.network === 'ethereum') {
      if (requestData.type === 'CONNECT_WALLET') {
        // Approve Ethereum connect
        sendResponse(true, {
          address: MOCK_ACCOUNTS.ethereum.address,
          chainId: MOCK_ACCOUNTS.ethereum.chainId
        });
      } else if (requestData.type === 'ETH_SIGN_TRANSACTION') {
        // Approve Ethereum transaction signing
        sendResponse(true, {
          hash: "0x" + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join(''),
          signedTransaction: "0x" + Array(128).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('')
        });
      } else if (requestData.type === 'ETH_SIGN_MESSAGE') {
        // Approve Ethereum message signing
        sendResponse(true, {
          signature: "0x" + Array(130).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('')
        });
      }
    } else if (requestData.network === 'solana') {
      if (requestData.type === 'CONNECT_WALLET') {
        // Approve Solana connect
        sendResponse(true, {
          publicKey: MOCK_ACCOUNTS.solana.publicKey
        });
      } else if (requestData.type === 'SOL_SIGN_TRANSACTION') {
        // Approve Solana transaction signing
        sendResponse(true, {
          signedTransaction: "sol-signed-tx-" + Date.now()
        });
      } else if (requestData.type === 'SOL_SIGN_MESSAGE') {
        // Approve Solana message signing
        sendResponse(true, {
          signature: "sol-msg-sig-" + Date.now()
        });
      } else if (requestData.type === 'SOL_SIGN_ALL_TRANSACTIONS') {
        // Approve Solana multi-transaction signing
        const count = requestData.payload?.transactions?.length || 2;
        const signedTransactions = Array(count).fill(0).map((_, i) => 
          `sol-signed-tx-${i}-${Date.now()}`
        );
        
        sendResponse(true, {
          signedTransactions
        });
      } else if (requestData.type === 'SOL_SIGN_AND_SEND_TRANSACTION') {
        // Approve Solana transaction sending
        sendResponse(true, {
          signature: "sol-tx-sig-" + Date.now()
        });
      }
    }
  };
  
  // Handle request rejection
  const handleReject = () => {
    // Reject request with USER_REJECTED error code (4001)
    sendResponse(false, null, 4001, "User rejected the request");
  };

  // Get request title based on active panel type
  const getRequestTitle = () => {
    switch (activePanelType) {
      case 'eth-connect': return 'Ethereum Connection Request';
      case 'eth-sign-tx': return 'Ethereum Transaction Request';
      case 'eth-sign-msg': return 'Ethereum Message Signing Request';
      case 'sol-connect': return 'Solana Connection Request';
      case 'sol-sign-tx': return 'Solana Transaction Request';
      case 'sol-sign-msg': return 'Solana Message Signing Request';
      case 'sol-sign-all-tx': return 'Solana Multiple Transactions Request';
      case 'sol-sign-send-tx': return 'Solana Send Transaction Request';
      default: return 'Request';
    }
  };

  // Get request description based on active panel type
  const getRequestDescription = () => {
    switch (activePanelType) {
      case 'eth-connect': return 'This site wants to connect to your Ethereum wallet';
      case 'eth-sign-tx': return 'This site wants you to sign a transaction';
      case 'eth-sign-msg': return 'This site wants you to sign a message';
      case 'sol-connect': return 'This site wants to connect to your Solana wallet';
      case 'sol-sign-tx': return 'This site wants you to sign a transaction';
      case 'sol-sign-msg': return 'This site wants you to sign a message';
      case 'sol-sign-all-tx': return 'This site wants you to sign multiple transactions';
      case 'sol-sign-send-tx': return 'This site wants you to sign and send a transaction';
      default: return 'This site is making a request';
    }
  };

  // Toggle debug panel
  const toggleDebug = () => {
    setShowDebug(!showDebug);
  };

  return (
    <div className="container">
      <div className="header">
        <div className="wallet-logo">🔐</div>
        <div className="wallet-name">NewWallet</div>
        {currentNetwork && (
          <div className={`network-badge ${currentNetwork}`}>
            {currentNetwork}
          </div>
        )}
        <button onClick={toggleDebug} className="debug-toggle">
          {showDebug ? 'Hide Debug' : 'Debug'}
        </button>
      </div>
      
      {showDebug && requestData && (
        <div className="debug-panel">
          <h3>Debug Info</h3>
          <pre>{JSON.stringify(requestData, null, 2)}</pre>
        </div>
      )}
      
      {activePanelType === 'welcome' ? (
        <WelcomePanel accounts={MOCK_ACCOUNTS} />
      ) : (
        <RequestPanel 
          requestData={requestData}
          requestOrigin={requestOrigin}
          title={getRequestTitle()}
          description={getRequestDescription()}
          accounts={MOCK_ACCOUNTS}
          network={currentNetwork}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      )}
    </div>
  );
};

export default WalletApp;