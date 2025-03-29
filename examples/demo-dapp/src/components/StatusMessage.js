import React from 'react';

const StatusMessage = ({ message, className, details }) => {
  if (!message) return null;
  
  return (
    <div className={`status ${className || ''}`}>
      {details ? (
        <div dangerouslySetInnerHTML={{ __html: `${message}<br/>${details}` }} />
      ) : (
        message
      )}
    </div>
  );
};

export default StatusMessage;