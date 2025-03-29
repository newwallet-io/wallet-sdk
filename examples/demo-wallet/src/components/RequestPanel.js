import React from 'react';
import DAppInfo from './DAppInfo';
import RequestDetails from './RequestDetails';
import AccountInfo from './AccountInfo';

const RequestPanel = ({ 
  requestData, 
  requestOrigin, 
  title, 
  description, 
  accounts, 
  network, 
  onApprove, 
  onReject 
}) => {
  return (
    <div className="request-panel">
      <DAppInfo requestOrigin={requestOrigin} />
      
      <RequestDetails 
        title={title}
        description={description}
        requestData={requestData}
      />
      
      <AccountInfo accounts={accounts} network={network} />
      
      <div className="button-group">
        <button onClick={onReject} className="btn-reject">Reject</button>
        <button onClick={onApprove} className="btn-approve">Approve</button>
      </div>
    </div>
  );
};

export default RequestPanel;