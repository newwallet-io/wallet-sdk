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
    toAddress: '0x72E21B227661317F8f2dE8CfA3367876586D1d11',
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
    'eip155:1': { hex: '0x1', label: 'Ethereum Mainnet', testnet: false, color: 'bg-blue-500' },
    'eip155:11155111': { hex: '0xaa36a7', label: 'Ethereum Sepolia', testnet: true, color: 'bg-blue-400' },
    'eip155:56': { hex: '0x38', label: 'BSC Mainnet', testnet: false, color: 'bg-yellow-500' },
    'eip155:97': { hex: '0x61', label: 'BSC Testnet', testnet: true, color: 'bg-yellow-400' },
    'eip155:8453': { hex: '0x2105', label: 'Base Mainnet', testnet: false, color: 'bg-blue-600' },
    'eip155:84532': { hex: '0x14a34', label: 'Base Sepolia', testnet: true, color: 'bg-blue-500' }
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
    { id: 'personal_sign', label: 'Sign Message', icon: '✍️' },
    { id: 'eth_signTransaction', label: 'Sign Transaction', icon: '📝' },
    { id: 'eth_sendTransaction', label: 'Send Transaction', icon: '💸' },
    { id: 'eth_signTypedData_v4', label: 'Sign Typed Data', icon: '📋' },
    { id: 'eth_accounts', label: 'Get Accounts', icon: '👤' },
    { id: 'eth_chainId', label: 'Get Chain ID', icon: '🔗' }
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
          <div className="bg-black/20 rounded-xl p-6 mt-4 space-y-4">
            <div>
              <label className="block text-gray-300 text-sm font-semibold mb-2">
                Message to Sign:
              </label>
              <textarea
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                value={formData.message}
                onChange={(e) => setFormData({...formData, message: e.target.value})}
                placeholder="Enter message to sign"
                rows={3}
              />
            </div>
            <button 
              className="px-6 py-3 bg-purple-500 hover:bg-purple-600 rounded-lg font-semibold text-white hover:shadow-lg hover:shadow-purple-500/25 transition-all duration-300 transform hover:scale-105 disabled:opacity-50"
              onClick={handleExecute} 
              disabled={loading}
            >
              Sign Message
            </button>
          </div>
        );
        
      case 'eth_signTransaction':
      case 'eth_sendTransaction':
        return (
          <div className="bg-black/20 rounded-xl p-6 mt-4 space-y-4">
            <div>
              <label className="block text-gray-300 text-sm font-semibold mb-2">To Address:</label>
              <input
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                value={formData.toAddress}
                onChange={(e) => setFormData({...formData, toAddress: e.target.value})}
                placeholder="0x..."
              />
            </div>
            <div>
              <label className="block text-gray-300 text-sm font-semibold mb-2">Value (in ETH):</label>
              <input
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                value={formData.value}
                onChange={(e) => setFormData({...formData, value: e.target.value})}
                placeholder="0.001"
              />
            </div>
            <div>
              <label className="block text-gray-300 text-sm font-semibold mb-2">Data (optional):</label>
              <input
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                value={formData.data}
                onChange={(e) => setFormData({...formData, data: e.target.value})}
                placeholder="0x..."
              />
            </div>
            <button 
              className="px-6 py-3 bg-purple-500 hover:bg-purple-600 rounded-lg font-semibold text-white hover:shadow-lg hover:shadow-purple-500/25 transition-all duration-300 transform hover:scale-105 disabled:opacity-50"
              onClick={handleExecute} 
              disabled={loading}
            >
              {activeAction === 'eth_signTransaction' ? 'Sign Transaction' : 'Send Transaction'}
            </button>
          </div>
        );
        
      case 'eth_signTypedData_v4':
        return (
          <div className="bg-black/20 rounded-xl p-6 mt-4 space-y-4">
            <div>
              <label className="block text-gray-300 text-sm font-semibold mb-2">Typed Data (JSON):</label>
              <textarea
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-sm"
                style={{ minHeight: '200px' }}
                value={formData.typedData}
                onChange={(e) => setFormData({...formData, typedData: e.target.value})}
              />
            </div>
            <button 
              className="px-6 py-3 bg-purple-500 hover:bg-purple-600 rounded-lg font-semibold text-white hover:shadow-lg hover:shadow-purple-500/25 transition-all duration-300 transform hover:scale-105 disabled:opacity-50"
              onClick={handleExecute} 
              disabled={loading}
            >
              Sign Typed Data
            </button>
          </div>
        );
        
      case 'eth_accounts':
      case 'eth_chainId':
        return (
          <div className="bg-black/20 rounded-xl p-6 mt-4">
            <button 
              className="px-6 py-3 bg-purple-500 hover:bg-purple-600 rounded-lg font-semibold text-white hover:shadow-lg hover:shadow-purple-500/25 transition-all duration-300 transform hover:scale-105 disabled:opacity-50"
              onClick={handleExecute} 
              disabled={loading}
            >
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
    <div className="backdrop-blur-md bg-white/5 rounded-2xl p-6 border border-white/10 shadow-xl">
      <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
        <span className="text-3xl">⚡</span>
        <span className="text-blue-400">
          EVM Chains (Ethereum / BSC / Base)
        </span>
      </h2>
      
      <div>
        {/* Chain Selector */}
        <div className="bg-black/20 rounded-xl p-4 mb-6">
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-gray-300 font-semibold">Current Chain:</label>
            <select
              id="evmChainSelect"
              className="flex-1 min-w-[200px] px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              value={currentChain}
              onChange={(e) => onChainChange(e.target.value)}
            >
              {availableChains.map(chainId => {
                const info = chainMapping[chainId];
                if (!info) return null;
                return (
                  <option key={chainId} value={info.hex} className="bg-gray-900">
                    {info.label}
                  </option>
                );
              })}
            </select>
            <button
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg font-medium text-white hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-300 disabled:opacity-50"
              onClick={handleSwitchChain}
              disabled={loading}
            >
              Switch Chain
            </button>
            <div className="flex items-center gap-2">
              <span className="text-gray-400">Account:</span>
              <code className="px-3 py-1 bg-white/10 rounded-md text-blue-300 text-sm font-mono">
                {truncateAddress(accounts[0])}
              </code>
            </div>
          </div>
        </div>
        
        {currentChainInfo && (
          <div className="mb-6 px-4 py-2 bg-blue-500/20 rounded-lg border border-blue-500/30">
            <span className="text-blue-300 text-sm">
              Active: {currentChainInfo.label} ({currentChain})
            </span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
          {actions.map(action => (
            <button
              key={action.id}
              className={`
                px-4 py-3 rounded-lg font-medium transition-all duration-300 transform hover:scale-105
                ${activeAction === action.id 
                  ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/25' 
                  : 'bg-white/10 border border-white/20 text-gray-300 hover:bg-white/20 hover:text-white'
                }
                ${loading ? 'opacity-50 cursor-not-allowed' : ''}
              `}
              onClick={() => setActiveAction(action.id)}
              disabled={loading}
            >
              <span className="mr-2">{action.icon}</span>
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