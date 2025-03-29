import React from 'react';

const TransactionItem = ({ transaction, network }) => {
  const isEthereum = network === 'ethereum';
  const hashKey = isEthereum ? 'hash' : 'signature';
  const amountUnit = isEthereum ? 'ETH' : 'SOL';

  // Helper function to truncate strings for display
  const truncateMiddle = (str, maxLength = 16) => {
    if (!str || str.length <= maxLength) return str;
    const halfLength = Math.floor(maxLength / 2);
    return str.substring(0, halfLength) + '...' + str.substring(str.length - halfLength);
  };

  return (
    <div className="transaction-item">
      <div>
        <strong>{isEthereum ? 'Hash' : 'Signature'}:</strong> 
        <span className="transaction-hash">{truncateMiddle(transaction[hashKey], 20)}</span>
      </div>
      <div><strong>To:</strong> {truncateMiddle(transaction.to, 20)}</div>
      <div><strong>Amount:</strong> {transaction.amount} {amountUnit}</div>
      <div><strong>Time:</strong> {transaction.timestamp}</div>
    </div>
  );
};

export default TransactionItem;