# Iframe OAuth Solution for ScaleWize Chatbot

## 🎯 Overview

This document explains the complete OAuth authentication solution for the ScaleWize chatbot that runs in an iframe within the ScaleWize website. The solution handles cross-origin communication and OAuth authentication seamlessly.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    ScaleWize Website (Parent)                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    OAuth Handler                            │ │
│  │  • Listens for iframe messages                              │ │
│  │  • Opens OAuth windows                                      │ │
│  │  • Manages authentication flow                              │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    Chatbot Iframe                           │ │
│  │  ┌─────────────────────────────────────────────────────────┐ │ │
│  │  │                LibreChat                                │ │ │
│  │  │  • MCP Tools (Google Drive)                             │ │ │
│  │  │  • OAuth Component                                      │ │ │
│  │  │  • PostMessage communication                            │ │ │
│  │  └─────────────────────────────────────────────────────────┘ │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    MCP Server (Railway)                        │
│  • OAuth endpoints (/oauth/initiate, /oauth/callback)          │
│  • Token storage (user-specific)                               │
│  • Google Drive API integration                                │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Google OAuth                                │
│  • Authentication flow                                         │
│  • Token generation                                            │
└─────────────────────────────────────────────────────────────────┘
```

## 🔄 OAuth Flow

### 1. User Initiates Google Drive Tool
```
User types: "Search for documents in my Google Drive"
```

### 2. MCP Tool Call
```
LibreChat → MCP Server: search_file(userId="user123", query="documents")
MCP Server → Response: "I don't have access to your Google Drive..."
```

### 3. OAuth Initiation (Iframe Context)
```
Iframe Component → Parent Window: postMessage({type: 'OAUTH_INITIATE', ...})
Parent Handler → Opens OAuth window
Parent Handler → MCP Server: /oauth/initiate?userId=user123
MCP Server → Response: {auth_url: "https://accounts.google.com/..."}
```

### 4. User Authentication
```
User → Google OAuth: Completes authentication
Google → MCP Server: /oauth/callback?code=...&state=...
MCP Server → Stores tokens for user123
```

### 5. Completion Notification
```
Parent Handler → Iframe: postMessage({type: 'OAUTH_COMPLETE', success: true})
Iframe Component → Updates UI: "✅ Google Drive Connected"
```

### 6. Tool Success
```
User types: "Search for documents in my Google Drive"
LibreChat → MCP Server: search_file(userId="user123", query="documents")
MCP Server → Google Drive API: Uses stored tokens
MCP Server → Response: "Found 5 documents: ..."
```

## 🛠️ Implementation Components

### 1. MCP Server (`src/index.ts`)
- **OAuth endpoints**: `/oauth/initiate`, `/oauth/callback`, `/oauth/status`
- **Token storage**: In-memory storage per user
- **Authentication check**: Before each tool call
- **User-specific tokens**: Each user has their own Google Drive access

### 2. Iframe OAuth Component (`OAuthInitiate.jsx`)
- **Iframe detection**: Automatically detects iframe context
- **PostMessage communication**: Sends OAuth requests to parent
- **Status monitoring**: Checks authentication status
- **Error handling**: Graceful fallbacks for OAuth failures

### 3. Parent OAuth Handler (`oauth-handler.ts`)
- **Message listening**: Receives OAuth requests from iframe
- **Window management**: Opens and monitors OAuth windows
- **Status checking**: Verifies authentication completion
- **Notification system**: Shows user feedback

### 4. Parent Integration Component (`ChatbotWithOAuth.tsx`)
- **Iframe wrapper**: Manages chatbot iframe with OAuth
- **Handler integration**: Connects OAuth handler to iframe
- **Manual OAuth**: Provides manual OAuth initiation button
- **Status display**: Shows OAuth handler status

## 🔧 Setup Instructions

### 1. MCP Server Setup

```bash
# Deploy to Railway
cd SWAI/scalewize-chatbot/custom-mcp-servers/shared/google-drive-mcp
./deploy.sh

# Set environment variables in Railway
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=https://mcp-servers-production-c189.up.railway.app/oauth/callback
```

### 2. Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create OAuth 2.0 credentials:
   - **Application type**: Web application
   - **Authorized redirect URIs**: `https://mcp-servers-production-c189.up.railway.app/oauth/callback`
   - **Scopes**: `https://www.googleapis.com/auth/drive.readonly`, `https://www.googleapis.com/auth/drive.file`

### 3. ScaleWize Website Integration

```tsx
// In your dashboard page
import ChatbotWithOAuth from '../../../components/ChatbotWithOAuth';

<ChatbotWithOAuth 
  chatbotUrl="https://scalewize-production-chatbot-production.up.railway.app"
  userId={user.id}
/>
```

### 4. LibreChat Integration

The MCP service automatically adds `userId` to tool arguments:

```javascript
// Enhanced tool arguments include userId
const enhancedToolArguments = {
  ...toolArguments,
  userId: userId
};
```

## 🔍 Testing

### 1. Test MCP Server
```bash
cd SWAI/scalewize-chatbot/custom-mcp-servers/shared/google-drive-mcp
npm test
```

### 2. Test OAuth Endpoints
```bash
# Test OAuth initiation
curl "https://mcp-servers-production-c189.up.railway.app/oauth/initiate?userId=test-user"

# Test status check
curl "https://mcp-servers-production-c189.up.railway.app/oauth/status/test-user"

# Test health check
curl "https://mcp-servers-production-c189.up.railway.app/health"
```

### 3. Test Iframe Communication
```javascript
// In browser console (parent window)
window.oauthHandler.initiateOAuth('test-user', 'Google Drive');

// In browser console (iframe)
window.parent.postMessage({
  type: 'OAUTH_INITIATE',
  authUrl: 'https://accounts.google.com/...',
  userId: 'test-user',
  serverName: 'Google Drive'
}, '*');
```

## 🚨 Security Considerations

### 1. Origin Validation
```typescript
// Validate message origins
const validOrigins = [
  'https://scalewize-production-chatbot-production.up.railway.app',
  'http://localhost:3000', // Development
];

return validOrigins.some(validOrigin => origin.startsWith(validOrigin));
```

### 2. OAuth State Validation
```typescript
// Generate and validate OAuth state
const state = crypto.randomBytes(32).toString('hex');
// Store state temporarily and validate in callback
```

### 3. Token Security
- Tokens stored in memory (consider Redis for production)
- User-specific token isolation
- Automatic token expiration handling

## 🔧 Troubleshooting

### Common Issues

1. **"OAuth window blocked"**
   - Check popup blocker settings
   - Ensure iframe has proper sandbox permissions

2. **"Cross-origin communication failed"**
   - Verify origin validation in OAuth handler
   - Check iframe src URL matches allowed origins

3. **"Authentication failed"**
   - Check Google Cloud Console OAuth setup
   - Verify redirect URI matches exactly
   - Check MCP server environment variables

4. **"Token not found"**
   - Ensure userId is being passed correctly
   - Check MCP server token storage
   - Verify OAuth callback completed successfully

### Debug Steps

1. **Check browser console** for PostMessage errors
2. **Verify MCP server logs** in Railway dashboard
3. **Test OAuth endpoints** manually with curl
4. **Check iframe communication** with browser dev tools

## 🚀 Production Deployment

### 1. Environment Variables
```bash
# Railway MCP Server
GOOGLE_CLIENT_ID=your_production_client_id
GOOGLE_CLIENT_SECRET=your_production_client_secret
GOOGLE_REDIRECT_URI=https://your-mcp-server.up.railway.app/oauth/callback

# ScaleWize Website
NEXT_PUBLIC_CHATBOT_URL=https://your-chatbot.up.railway.app
NEXT_PUBLIC_MCP_SERVER_URL=https://your-mcp-server.up.railway.app
```

### 2. Domain Configuration
- Update valid origins in OAuth handler
- Configure Google Cloud Console redirect URIs
- Set up proper CORS headers

### 3. Monitoring
- Monitor OAuth success/failure rates
- Track token storage and expiration
- Log authentication attempts and errors

## 📈 Future Enhancements

1. **Token Refresh**: Implement automatic token refresh
2. **Persistent Storage**: Use Redis or database for tokens
3. **Multiple OAuth Providers**: Support other services (Dropbox, OneDrive)
4. **Token Encryption**: Encrypt stored tokens
5. **Analytics**: Track OAuth usage and success rates

---

**Last Updated**: December 2024
**Version**: 2.0.0
**Status**: Ready for Production 