import React from 'react';

const AccountInfo = ({ accounts, network }) => {
  if (!network || !accounts) return null;
  
  if (network === 'ethereum') {
    return (
      <div className="account-display">
        <div>Account:</div>
        <div className="account-address">{accounts.ethereum.address}</div>
      </div>
    );
  } 
  else if (network === 'solana') {
    return (
      <div className="account-display">
        <div>Public Key:</div>
        <div className="account-address">{accounts.solana.publicKey}</div>
      </div>
    );
  }
  
  return null;
};

export default AccountInfo;