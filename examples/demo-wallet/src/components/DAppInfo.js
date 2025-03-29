import React, { useState, useEffect } from 'react';

const DAppInfo = ({ requestOrigin }) => {
  const [imgSrc, setImgSrc] = useState("");
  const [dappName, setDappName] = useState("Unknown DApp");
  
  useEffect(() => {
    if (requestOrigin) {
      // Try to extract domain name from origin for the DApp name
      try {
        const url = new URL(requestOrigin);
        setDappName(url.hostname);
        
        // Set favicon URL from origin
        setImgSrc(`${url.origin}/favicon.ico`);
      } catch (e) {
        console.error("Error parsing origin URL:", e);
        setDappName(requestOrigin);
        setImgSrc("https://via.placeholder.com/40");
      }
    }
  }, [requestOrigin]);
  
  return (
    <div className="dapp-info">
      <img 
        className="dapp-logo" 
        src={imgSrc} 
        alt="DApp Logo" 
        onError={() => setImgSrc("https://via.placeholder.com/40")}
      />
      <div className="dapp-details">
        <div className="dapp-name">{dappName}</div>
        <div className="dapp-url">{requestOrigin || "Unknown URL"}</div>
      </div>
    </div>
  );
};

export default DAppInfo;