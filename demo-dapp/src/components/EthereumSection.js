// components/EthereumSection.js
import React, { useState, useEffect } from 'react';

function EthereumSection({
  sdk,
  accounts,
  currentChain,
  supportedChains,
  onChainChange,
  onExecute,
  loading,
  environment
}) {
  const [activeAction, setActiveAction] = useState('');
  const [availableChains, setAvailableChains] = useState([]);
  const [formData, setFormData] = useState({
    message: 'Hello from NewWallet SDK Demo!',
    toAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb7',
    value: '0.001',
    data: '',
    typedData: JSON.stringify({
      domain: {
        name: "NewWallet Demo",
        version: "1",
        chainId: 1,
        verifyingContract: "0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC"
      },
      message: {
        contents: "Hello from NewWallet SDK!",
        from: "Demo User",
        to: "NewWallet"
      },
      primaryType: "Message",
      types: {
        EIP712Domain: [
          { name: "name", type: "string" },
          { name: "version", type: "string" },
          { name: "chainId", type: "uint256" },
          { name: "verifyingContract", type: "address" }
        ],
        Message: [
          { name: "contents", type: "string" },
          { name: "from", type: "string" },
          { name: "to", type: "string" }
        ]
      }
    }, null, 2)
  });

  // Chain mapping from WalletConnect format to display info
  const chainMapping = {
    'eip155:1': { hex: '0x1', label: 'Ethereum Mainnet', testnet: false },
    'eip155:11155111': { hex: '0xaa36a7', label: 'Ethereum Sepolia', testnet: true },
    'eip155:56': { hex: '0x38', label: 'BSC Mainnet', testnet: false },
    'eip155:97': { hex: '0x61', label: 'BSC Testnet', testnet: true },
    'eip155:8453': { hex: '0x2105', label: 'Base Mainnet', testnet: false },
    'eip155:84532': { hex: '0x14a34', label: 'Base Sepolia', testnet: true }
  };

  useEffect(() => {
    // Filter chains based on environment
    if (supportedChains && supportedChains.length > 0) {
      const filtered = supportedChains.filter(chain => {
        const chainInfo = chainMapping[chain];
        if (!chainInfo) return false;
        
        // For mainnet environment, show mainnet chains
        // For testnet/localhost, show testnet chains
        if (environment === 'mainnet') {
          return !chainInfo.testnet;
        } else {
          return chainInfo.testnet;
        }
      });
      
      setAvailableChains(filtered);
    } else {
      // Fallback if no supported chains from SDK
      const defaultChains = environment === 'mainnet' 
        ? ['eip155:1', 'eip155:56', 'eip155:8453']
        : ['eip155:11155111', 'eip155:97', 'eip155:84532'];
      setAvailableChains(defaultChains);
    }
  }, [supportedChains, environment]);

  const actions = [
    { id: 'personal_sign', label: 'Sign Message' },
    { id: 'eth_signTransaction', label: 'Sign Transaction' },
    { id: 'eth_sendTransaction', label: 'Send Transaction' },
    { id: 'eth_signTypedData_v4', label: 'Sign Typed Data' },
    { id: 'eth_accounts', label: 'Get Accounts' },
    { id: 'eth_chainId', label: 'Get Chain ID' }
  ];

  const handleSwitchChain = async () => {
    const chainId = document.getElementById('evmChainSelect').value;
    try {
      await onExecute('wallet_switchEthereumChain', [{ chainId }]);
      onChainChange(chainId);
    } catch (error) {
      console.error('Failed to switch chain:', error);
      alert(`Failed to switch chain: ${error.message}`);
    }
  };

  const handleExecute = async () => {
    try {
      let params;
      
      switch(activeAction) {
        case 'personal_sign':
          params = [formData.message, accounts[0]];
          break;
          
        case 'eth_signTransaction':
        case 'eth_sendTransaction':
          const tx = {
            from: accounts[0],
            to: formData.toAddress,
            value: '0x' + Math.floor(parseFloat(formData.value) * 1e18).toString(16),
            data: formData.data || '0x'
          };
          params = [tx];
          break;
          
        case 'eth_signTypedData_v4':
          params = [accounts[0], JSON.parse(formData.typedData)];
          break;
          
        case 'eth_accounts':
        case 'eth_chainId':
          params = [];
          break;
          
        default:
          return;
      }
      
      await onExecute(activeAction, params);
    } catch (error) {
      console.error('Execution failed:', error);
      alert(`Execution failed: ${error.message}`);
    }
  };

  const truncateAddress = (address) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getCurrentChainInfo = () => {
    // Find chain info from hex value (currentChain is in hex format like '0x1')
    const entry = Object.entries(chainMapping).find(([key, info]) => info.hex === currentChain);
    return entry ? entry[1] : null;
  };

  const renderInputs = () => {
    switch(activeAction) {
      case 'personal_sign':
        return (
          <div className="input-area">
            <div className="input-group">
              <label className="input-label">Message to Sign:</label>
              <textarea
                className="input-field"
                value={formData.message}
                onChange={(e) => setFormData({...formData, message: e.target.value})}
                placeholder="Enter message to sign"
              />
            </div>
            <button className="btn btn-primary" onClick={handleExecute} disabled={loading}>
              Sign Message
            </button>
          </div>
        );
        
      case 'eth_signTransaction':
      case 'eth_sendTransaction':
        return (
          <div className="input-area">
            <div className="input-group">
              <label className="input-label">To Address:</label>
              <input
                className="input-field"
                value={formData.toAddress}
                onChange={(e) => setFormData({...formData, toAddress: e.target.value})}
                placeholder="0x..."
              />
            </div>
            <div className="input-group">
              <label className="input-label">Value (in ETH):</label>
              <input
                className="input-field"
                value={formData.value}
                onChange={(e) => setFormData({...formData, value: e.target.value})}
                placeholder="0.001"
              />
            </div>
            <div className="input-group">
              <label className="input-label">Data (optional):</label>
              <input
                className="input-field"
                value={formData.data}
                onChange={(e) => setFormData({...formData, data: e.target.value})}
                placeholder="0x..."
              />
            </div>
            <button className="btn btn-primary" onClick={handleExecute} disabled={loading}>
              {activeAction === 'eth_signTransaction' ? 'Sign Transaction' : 'Send Transaction'}
            </button>
          </div>
        );
        
      case 'eth_signTypedData_v4':
        return (
          <div className="input-area">
            <div className="input-group">
              <label className="input-label">Typed Data (JSON):</label>
              <textarea
                className="input-field"
                style={{ minHeight: '200px', fontFamily: 'monospace' }}
                value={formData.typedData}
                onChange={(e) => setFormData({...formData, typedData: e.target.value})}
              />
            </div>
            <button className="btn btn-primary" onClick={handleExecute} disabled={loading}>
              Sign Typed Data
            </button>
          </div>
        );
        
      case 'eth_accounts':
      case 'eth_chainId':
        return (
          <div className="input-area">
            <button className="btn btn-primary" onClick={handleExecute} disabled={loading}>
              Execute
            </button>
          </div>
        );
        
      default:
        return null;
    }
  };

  const currentChainInfo = getCurrentChainInfo();

  return (
    <div className="section">
      <h2 className="section-title">⚡ EVM Chains (Ethereum / BSC / Base)</h2>
      
      <div className="chain-section">
        <div className="chain-selector">
          <label>Current Chain:</label>
          <select
            id="evmChainSelect"
            className="chain-select"
            value={currentChain}
            onChange={(e) => onChainChange(e.target.value)}
          >
            {availableChains.map(chainId => {
              const info = chainMapping[chainId];
              if (!info) return null;
              return (
                <option key={chainId} value={info.hex}>
                  {info.label}
                </option>
              );
            })}
          </select>
          <button
            className="btn btn-small btn-secondary"
            onClick={handleSwitchChain}
            disabled={loading}
          >
            Switch Chain
          </button>
          <span className="chain-info">
            Account: <span className="account-address">{truncateAddress(accounts[0])}</span>
          </span>
        </div>
        
        {currentChainInfo && (
          <div className="chain-status">
            Active: {currentChainInfo.label} ({currentChain})
          </div>
        )}

        <div className="action-buttons">
          {actions.map(action => (
            <button
              key={action.id}
              className={`action-button ${activeAction === action.id ? 'active' : ''}`}
              onClick={() => setActiveAction(action.id)}
              disabled={loading}
            >
              {action.label}
            </button>
          ))}
        </div>

        {activeAction && renderInputs()}
      </div>
    </div>
  );
}

export default EthereumSection;