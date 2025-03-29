import React, { useState, useEffect } from 'react';
import './TabStyles.css';
import StatusMessage from './StatusMessage';
import TransactionItem from './TransactionItem';

const EthereumTab = ({ wallet }) => {
  const [connected, setConnected] = useState(false);
  const [account, setAccount] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [toAddress, setToAddress] = useState('0x0987654321098765432109876543210987654321');
  const [amount, setAmount] = useState('0.001');
  const [message, setMessage] = useState('Hello, Ethereum!');
  const [transactions, setTransactions] = useState([]);
  
  // Status messages
  const [connectionStatus, setConnectionStatus] = useState({ message: '', className: '' });
  const [txStatus, setTxStatus] = useState({ message: '', className: '' });
  const [signTxStatus, setSignTxStatus] = useState({ message: '', className: '' });
  const [signatureStatus, setSignatureStatus] = useState({ message: '', className: '' });
  
  useEffect(() => {
    if (wallet && wallet.ethereum) {
      // Set up event listeners
      wallet.ethereum.on('accountsChanged', handleAccountsChanged);
      wallet.ethereum.on('chainChanged', handleChainChanged);
      
      // Check if already connected
      checkConnection();
    }
    
    return () => {
      if (wallet && wallet.ethereum) {
        wallet.ethereum.off('accountsChanged', handleAccountsChanged);
        wallet.ethereum.off('chainChanged', handleChainChanged);
      }
    };
  }, [wallet]);
  
  const checkConnection = async () => {
    try {
      const accounts = await wallet.ethereum.request({ method: 'eth_accounts' });
      if (accounts && accounts.length > 0) {
        handleAccountsChanged(accounts);
        
        const chainId = await wallet.ethereum.request({ method: 'eth_chainId' });
        handleChainChanged(chainId);
      }
    } catch (error) {
      console.error('Error checking connection:', error);
    }
  };

  const handleAccountsChanged = (accounts) => {
    if (accounts.length === 0) {
      // Disconnected
      setConnected(false);
      setAccount(null);
    } else {
      // Connected
      setConnected(true);
      setAccount(accounts[0]);
    }
  };

  const handleChainChanged = (newChainId) => {
    setChainId(newChainId);
  };

  const getNetworkName = (chainId) => {
    switch (chainId) {
      case '0x1': return 'Ethereum Mainnet';
      case '0x3': return 'Ropsten Testnet';
      case '0x4': return 'Rinkeby Testnet';
      case '0x5': return 'Goerli Testnet';
      case '0x2a': return 'Kovan Testnet';
      case '0x89': return 'Polygon Mainnet';
      case '0x13881': return 'Polygon Mumbai';
      default: return `Unknown (${chainId})`;
    }
  };

  const connectWallet = async () => {
    try {
      setConnectionStatus({ message: 'Connecting...', className: '' });
      
      const accounts = await wallet.ethereum.request({
        method: 'eth_requestAccounts'
      });
      
      setConnectionStatus({ message: 'Connected!', className: 'success' });
    } catch (error) {
      console.error('Connection error:', error);
      setConnectionStatus({ 
        message: `Connection failed: ${error.message}`, 
        className: 'error' 
      });
    }
  };

  const disconnectWallet = () => {
    // Note: Ethereum doesn't have a standard disconnect method
    // This just clears the local state
    setConnected(false);
    setAccount(null);
    setConnectionStatus({ message: 'Disconnected', className: '' });
  };

  const createTransactionParams = () => {
    if (!connected || !account) {
      throw new Error('Please connect your wallet first');
    }
    
    // Convert ETH to Wei (1 ETH = 10^18 Wei)
    // eslint-disable-next-line no-undef
    const weiAmount = BigInt(parseFloat(amount) * 1e18);
    const weiHex = '0x' + weiAmount.toString(16);
    
    // Create a properly formatted transaction object
    return {
      from: account,
      to: toAddress,
      value: weiHex,
      gas: '0x5208', // 21000 gas
      gasPrice: '0x3B9ACA00' // 1 Gwei
    };
  };

  const signTransaction = async () => {
    if (!connected) {
      alert('Please connect your wallet first');
      return;
    }
    
    try {
      setSignTxStatus({ message: 'Signing transaction...', className: '' });
      
      // Create transaction parameters
      const txParams = createTransactionParams();
      console.log('Signing transaction with params:', txParams);
      
      // Sign the transaction
      const signedTx = await wallet.ethereum.request({
        method: 'eth_signTransaction',
        params: [txParams]
      });
      
      console.log('Signed transaction:', signedTx);
      setSignTxStatus({ 
        message: `Transaction signed! Signature: ${truncateString(signedTx, 40)}`, 
        className: 'success' 
      });
    } catch (error) {
      console.error('Transaction signing error:', error);
      setSignTxStatus({ 
        message: `Transaction signing failed: ${error.message}`, 
        className: 'error' 
      });
    }
  };

  const sendTransaction = async () => {
    if (!connected) {
      alert('Please connect your wallet first');
      return;
    }
    
    try {
      setTxStatus({ message: 'Sending transaction...', className: '' });
      
      // Create transaction parameters
      const txParams = createTransactionParams();
      console.log('Sending transaction with params:', txParams);
      
      // Send the transaction
      const txHash = await wallet.ethereum.request({
        method: 'eth_sendTransaction',
        params: [txParams]
      });
      
      console.log('Transaction sent:', txHash);
      setTxStatus({ message: `Transaction sent: ${txHash}`, className: 'success' });
      
      // Add to transaction history
      addTransactionToHistory(txHash, toAddress, amount);
    } catch (error) {
      console.error('Transaction error:', error);
      setTxStatus({ 
        message: `Transaction failed: ${error.message}`, 
        className: 'error' 
      });
    }
  };

  const signMessage = async () => {
    if (!connected) {
      alert('Please connect your wallet first');
      return;
    }
    
    try {
      setSignatureStatus({ message: 'Signing message...', className: '' });
      
      const signature = await wallet.ethereum.request({
        method: 'personal_sign',
        params: [message, account]
      });
      
      setSignatureStatus({ 
        message: `Signature: ${signature}`, 
        className: 'success' 
      });
    } catch (error) {
      console.error('Signing error:', error);
      setSignatureStatus({ 
        message: `Signing failed: ${error.message}`, 
        className: 'error' 
      });
    }
  };

  const addTransactionToHistory = (hash, to, amount) => {
    const transaction = {
      hash,
      to,
      amount,
      timestamp: new Date().toLocaleString()
    };
    
    setTransactions(prevTransactions => [transaction, ...prevTransactions]);
  };

  // Helper function to truncate long strings
  const truncateString = (str, maxLength = 20) => {
    if (!str) return '';
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength / 2) + '...' + str.substring(str.length - maxLength / 2);
  };

  return (
    <div className="ethereum-tab">
      <div className="card">
        <h2>Wallet Connection</h2>
        <StatusMessage {...connectionStatus} />
        <div className="button-container">
          <button 
            onClick={connectWallet} 
            disabled={connected}
            className="connect-btn"
          >
            Connect Wallet
          </button>
          <button 
            onClick={disconnectWallet} 
            disabled={!connected}
            className="disconnect-btn"
          >
            Disconnect
          </button>
        </div>
      </div>
      
      <div className="card">
        <h2>Account Information</h2>
        <div className="account-info">
          <div><strong>Address:</strong> <span className="address">{account || 'Not connected'}</span></div>
          <div><strong>Network:</strong> <span className="network">{chainId ? getNetworkName(chainId) : 'Unknown'}</span></div>
        </div>
      </div>
      
      <div className="card">
        <h2>Sign Transaction</h2>
        <div className="form-group">
          <label htmlFor="eth-sign-toAddress">To Address:</label>
          <input 
            type="text" 
            id="eth-sign-toAddress" 
            value={toAddress} 
            onChange={(e) => setToAddress(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label htmlFor="eth-sign-amount">Amount (ETH):</label>
          <input 
            type="number" 
            id="eth-sign-amount" 
            value={amount} 
            onChange={(e) => setAmount(e.target.value)} 
            step="0.001" 
            min="0"
          />
        </div>
        <button 
          onClick={signTransaction} 
          disabled={!connected}
          className="sign-tx-btn"
        >
          Sign Transaction
        </button>
        <StatusMessage {...signTxStatus} />
      </div>
      
      <div className="card">
        <h2>Send Transaction</h2>
        <div className="form-group">
          <label htmlFor="eth-toAddress">To Address:</label>
          <input 
            type="text" 
            id="eth-toAddress" 
            value={toAddress} 
            onChange={(e) => setToAddress(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label htmlFor="eth-amount">Amount (ETH):</label>
          <input 
            type="number" 
            id="eth-amount" 
            value={amount} 
            onChange={(e) => setAmount(e.target.value)} 
            step="0.001" 
            min="0"
          />
        </div>
        <button 
          onClick={sendTransaction} 
          disabled={!connected}
          className="transaction-btn"
        >
          Send Transaction
        </button>
        <StatusMessage {...txStatus} />
      </div>
      
      <div className="card">
        <h2>Sign Message</h2>
        <div className="form-group">
          <label htmlFor="eth-message">Message:</label>
          <textarea 
            id="eth-message" 
            value={message} 
            onChange={(e) => setMessage(e.target.value)}
          />
        </div>
        <button 
          onClick={signMessage} 
          disabled={!connected}
          className="sign-btn"
        >
          Sign Message
        </button>
        <StatusMessage {...signatureStatus} />
      </div>
      
      <div className="card">
        <h2>Transaction History</h2>
        <div className="transaction-history">
          {transactions.length === 0 ? (
            <p>No transactions yet</p>
          ) : (
            transactions.map((tx, index) => (
              <TransactionItem 
                key={index} 
                transaction={tx} 
                network="ethereum" 
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default EthereumTab;