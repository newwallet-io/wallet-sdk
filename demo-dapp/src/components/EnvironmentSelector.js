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
    <div className="environment-selector">
      <span className="env-label">Environment:</span>
      <select 
        className="env-select" 
        value={environment} 
        onChange={handleChange}
      >
        {environments.map(env => (
          <option key={env.id} value={env.id}>
            {env.label} - {env.url}
          </option>
        ))}
      </select>
      <div className="env-status">
        <span className="status-dot"></span>
        {currentEnv?.label || 'Unknown'}
      </div>
    </div>
  );
}

export default EnvironmentSelector;