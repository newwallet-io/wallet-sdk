// components/EnvironmentSelector.js
import React from 'react';

function EnvironmentSelector({ environment, onEnvironmentChange }) {
  const environments = [
    { id: 'mainnet', label: 'Mainnet', url: 'https://newwallet.io/transaction_signing' },
    { id: 'testnet', label: 'Testnet', url: 'https://testnet.newwallet.io/transaction_signing' },
    { id: 'localhost', label: 'Localhost', url: 'http://localhost:4040/transaction_signing' }
  ];

  const handleChange = (e) => {
    onEnvironmentChange(e.target.value);
  };

  const currentEnv = environments.find(env => env.id === environment);

  return (
    <div className="bg-purple-600/20 backdrop-blur-sm border-b border-white/10 px-6 py-5">
      <div className="flex flex-wrap items-center gap-4">
        <span className="text-white font-semibold text-lg">Environment:</span>
        
        <select 
          className="flex-1 min-w-[300px] px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent backdrop-blur-sm transition-all duration-200"
          value={environment} 
          onChange={handleChange}
        >
          {environments.map(env => (
            <option key={env.id} value={env.id} className="bg-gray-900 text-white">
              {env.label} - {env.url}
            </option>
          ))}
        </select>
        
        <div className="flex items-center gap-2 px-4 py-2 bg-green-500/20 border border-green-500/30 rounded-full">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          <span className="text-green-300 font-medium text-sm">
            {currentEnv?.label || 'Unknown'}
          </span>
        </div>
      </div>
    </div>
  );
}

export default EnvironmentSelector;