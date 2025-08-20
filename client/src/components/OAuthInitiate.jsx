import React, { useState, useEffect } from 'react';

const OAuthInitiate = ({ userId, serverName = 'Google Drive' }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [authStatus, setAuthStatus] = useState(null);

  // Check if we're running in an iframe
  const isInIframe = window !== window.parent;

  // Listen for messages from parent window (for OAuth completion)
  useEffect(() => {
    const handleMessage = (event) => {
      // Verify origin for security (adjust this to match your parent domain)
      if (event.origin !== window.location.origin && 
          !event.origin.includes('scalewize.com') && 
          !event.origin.includes('localhost')) {
        return;
      }

      if (event.data.type === 'OAUTH_COMPLETE') {
        console.log('OAuth completed via parent window message');
        checkAuthStatus();
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Check auth status on component mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const initiateOAuth = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Call the OAuth initiation endpoint
      const response = await fetch(`https://mcp-servers-production-c189.up.railway.app/oauth/initiate?userId=${userId}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.auth_url) {
        if (isInIframe) {
          // In iframe context, communicate with parent window
          window.parent.postMessage({
            type: 'OAUTH_INITIATE',
            authUrl: data.auth_url,
            userId: userId,
            serverName: serverName
          }, '*'); // Use '*' for development, restrict to specific origin in production
          
          // Show instructions for iframe context
          alert('OAuth authentication initiated! The parent window will handle the Google authentication. Please complete the authentication and return to this chat.');
        } else {
          // Direct window context, open popup
          const popup = window.open(data.auth_url, '_blank', 'width=600,height=700');
          
          // Poll for popup closure and check auth status
          const checkClosed = setInterval(() => {
            if (popup.closed) {
              clearInterval(checkClosed);
              checkAuthStatus();
            }
          }, 1000);
        }
      } else {
        throw new Error('No authentication URL received');
      }
    } catch (err) {
      setError(err.message);
      console.error('OAuth initiation error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const checkAuthStatus = async () => {
    try {
      const response = await fetch(`https://mcp-servers-production-c189.up.railway.app/oauth/status/${userId}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setAuthStatus(data);
      
      if (data.authenticated) {
        console.log('✅ User is authenticated with Google Drive');
      } else {
        console.log('❌ User is not authenticated with Google Drive');
      }
      
      return data;
    } catch (err) {
      setError(err.message);
      console.error('Auth status check error:', err);
      return null;
    }
  };

  const handleRetry = () => {
    setError(null);
    checkAuthStatus();
  };

  // If user is already authenticated, show success message
  if (authStatus?.authenticated) {
    return (
      <div className="oauth-success-container" style={{
        border: '1px solid #4caf50',
        borderRadius: '8px',
        padding: '16px',
        margin: '16px 0',
        backgroundColor: '#e8f5e8'
      }}>
        <h3 style={{ margin: '0 0 12px 0', color: '#2e7d32' }}>
          ✅ Google Drive Connected
        </h3>
        <p style={{ margin: '0 0 16px 0', color: '#388e3c', fontSize: '14px' }}>
          You are authenticated with Google Drive and can now use all Google Drive tools.
        </p>
        <button
          onClick={checkAuthStatus}
          style={{
            backgroundColor: '#4caf50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            padding: '8px 16px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500'
          }}
        >
          🔄 Refresh Status
        </button>
      </div>
    );
  }

  return (
    <div className="oauth-initiate-container" style={{
      border: '1px solid #e0e0e0',
      borderRadius: '8px',
      padding: '16px',
      margin: '16px 0',
      backgroundColor: '#f9f9f9'
    }}>
      <h3 style={{ margin: '0 0 12px 0', color: '#333' }}>
        🔐 Google Drive Authentication Required
      </h3>
      
      <p style={{ margin: '0 0 16px 0', color: '#666', fontSize: '14px' }}>
        To use Google Drive tools, you need to authenticate with your Google account first.
        {isInIframe && (
          <span style={{ display: 'block', marginTop: '8px', fontWeight: 'bold', color: '#1976d2' }}>
            ℹ️ Authentication will be handled by the parent window.
          </span>
        )}
      </p>
      
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <button
          onClick={initiateOAuth}
          disabled={isLoading}
          style={{
            backgroundColor: '#4285f4',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            padding: '8px 16px',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: '500'
          }}
        >
          {isLoading ? '🔄 Initiating...' : '🔐 Authenticate with Google'}
        </button>
        
        <button
          onClick={checkAuthStatus}
          style={{
            backgroundColor: '#34a853',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            padding: '8px 16px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500'
          }}
        >
          🔍 Check Status
        </button>

        {error && (
          <button
            onClick={handleRetry}
            style={{
              backgroundColor: '#ff9800',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              padding: '8px 16px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            🔄 Retry
          </button>
        )}
      </div>
      
      {error && (
        <div style={{
          marginTop: '12px',
          padding: '8px 12px',
          backgroundColor: '#ffebee',
          border: '1px solid #ffcdd2',
          borderRadius: '4px',
          color: '#c62828',
          fontSize: '14px'
        }}>
          ❌ Error: {error}
        </div>
      )}
      
      <div style={{
        marginTop: '12px',
        padding: '8px 12px',
        backgroundColor: '#e3f2fd',
        border: '1px solid #bbdefb',
        borderRadius: '4px',
        fontSize: '12px',
        color: '#1976d2'
      }}>
        <strong>💡 How it works:</strong>
        {isInIframe ? (
          <ol style={{ margin: '8px 0 0 16px', padding: 0 }}>
            <li>Click "Authenticate with Google" to initiate the OAuth flow</li>
            <li>The parent window will handle the Google authentication</li>
            <li>Complete the authentication in the parent window</li>
            <li>Return to this chat and try using Google Drive tools again</li>
          </ol>
        ) : (
          <ol style={{ margin: '8px 0 0 16px', padding: 0 }}>
            <li>Click "Authenticate with Google" to open the Google OAuth window</li>
            <li>Sign in to your Google account and grant permissions</li>
            <li>Close the OAuth window and return to the chatbot</li>
            <li>Try using Google Drive tools again</li>
          </ol>
        )}
      </div>
    </div>
  );
};

export default OAuthInitiate; 