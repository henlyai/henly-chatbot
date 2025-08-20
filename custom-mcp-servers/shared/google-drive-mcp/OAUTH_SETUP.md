# Google Drive MCP Server - OAuth Authentication Setup

## 🔐 Overview

This document explains how to set up and use OAuth authentication for the Google Drive MCP Server integration with LibreChat.

## 🏗️ Architecture

```
ScaleWize Website (Parent) → Iframe Chatbot → MCP Server → Google Drive API
     ↓                              ↓
OAuth Handler ←→ PostMessage ←→ OAuth Component
     ↓
Google OAuth Window
```

### Iframe Integration Flow:
1. **Parent Website**: Hosts the chatbot in an iframe with OAuth handler
2. **Iframe Chatbot**: Contains OAuth component that communicates with parent
3. **OAuth Handler**: Manages OAuth flow in parent window context
4. **MCP Server**: Stores user-specific OAuth tokens
5. **Google Drive API**: Accessed with user's authenticated tokens

## 🚀 Quick Start

### 1. Environment Variables

Make sure these environment variables are set in your Railway deployment:

```bash
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=https://mcp-servers-production-c189.up.railway.app/oauth/callback
```

### 2. Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the Google Drive API
4. Create OAuth 2.0 credentials:
   - Application type: Web application
   - Authorized redirect URIs: `https://mcp-servers-production-c189.up.railway.app/oauth/callback`
   - Scopes: `https://www.googleapis.com/auth/drive.readonly` and `https://www.googleapis.com/auth/drive.file`

### 3. ScaleWize Website Integration

Add the OAuth handler to your ScaleWize website:

```typescript
// In your main layout or page component
import ChatbotWithOAuth from './components/ChatbotWithOAuth';

// Use the component with your chatbot URL and user ID
<ChatbotWithOAuth 
  chatbotUrl="https://scalewize-production-chatbot-production.up.railway.app"
  userId={currentUser.id}
/>
```

### 4. Test the Setup

Run the test script to verify everything is working:

```bash
cd SWAI/scalewize-chatbot/custom-mcp-servers/shared/google-drive-mcp
node test-mcp.js
```

## 🔄 OAuth Flow

### Step 1: User Initiates Authentication

When a user tries to use Google Drive tools without authentication:

1. **MCP Tool Call**: User calls `search_file`, `list_files`, etc.
2. **Authentication Check**: MCP server checks if user has valid tokens
3. **Error Response**: If not authenticated, returns OAuth initiation URL

### Step 2: OAuth Initiation (Iframe Context)

1. **Iframe Component**: Shows OAuth initiation UI component
2. **PostMessage**: Sends OAuth initiation message to parent window
3. **Parent Handler**: Receives message and opens OAuth window
4. **API Call**: Parent calls `/oauth/initiate?userId=USER_ID`
5. **Response**: Returns Google OAuth URL with state parameter

### Step 3: User Authentication

1. **Redirect**: User visits Google OAuth URL
2. **Consent**: User grants permissions to access Google Drive
3. **Callback**: Google redirects to `/oauth/callback` with authorization code

### Step 4: Token Storage & Completion

1. **Code Exchange**: MCP server exchanges code for access/refresh tokens
2. **Storage**: Tokens stored in memory (user-specific)
3. **Parent Notification**: Parent window notifies iframe of completion
4. **Iframe Update**: Iframe updates authentication status
5. **Success**: User can now use Google Drive tools

## 🛠️ Available Endpoints

### Health Check
```
GET /health
```
Returns server status and version information.

### Test Endpoint
```
GET /test
```
Returns server information and OAuth configuration status.

### OAuth Initiation
```
GET /oauth/initiate?userId=USER_ID
```
Initiates OAuth flow for a specific user.

**Response:**
```json
{
  "auth_url": "https://accounts.google.com/o/oauth2/auth?...",
  "state": "random_state_string",
  "message": "Please visit the auth_url to authenticate with Google Drive"
}
```

### OAuth Callback
```
GET /oauth/callback?code=AUTH_CODE&state=STATE
```
Handles OAuth callback from Google.

**Response:**
```json
{
  "status": "success",
  "message": "OAuth authentication successful! You can now use Google Drive tools.",
  "userId": "user_id"
}
```

### OAuth Status Check
```
GET /oauth/status/USER_ID
```
Checks authentication status for a user.

**Response:**
```json
{
  "authenticated": true,
  "expired": false,
  "message": "Authenticated"
}
```

## 🔧 MCP Tools

All MCP tools now require a `userId` parameter for authentication:

### search_file
```json
{
  "query": "search term",
  "fileType": "pdf",
  "userId": "user_id"
}
```

### list_files
```json
{
  "folderId": "root",
  "pageSize": 50,
  "userId": "user_id"
}
```

### get_file_metadata
```json
{
  "fileId": "google_drive_file_id",
  "userId": "user_id"
}
```

### read_content
```json
{
  "fileId": "google_drive_file_id",
  "format": "text",
  "userId": "user_id"
}
```

## 🎯 Integration with LibreChat

### 1. MCP Tool Creation

The LibreChat MCP service automatically adds the `userId` to tool arguments:

```javascript
// Enhanced tool arguments include userId
const enhancedToolArguments = {
  ...toolArguments,
  userId: userId
};
```

### 2. OAuth UI Component (Iframe)

The `OAuthInitiate` component automatically detects iframe context and communicates with the parent window:

```jsx
import OAuthInitiate from './components/OAuthInitiate';

// In your chat component (automatically handles iframe communication)
<OAuthInitiate userId={currentUser.id} serverName="Google Drive" />
```

### 3. Parent Website Integration

Use the `ChatbotWithOAuth` component in your ScaleWize website:

```tsx
import ChatbotWithOAuth from './components/ChatbotWithOAuth';

// Wrap your chatbot iframe with OAuth handling
<ChatbotWithOAuth 
  chatbotUrl="https://scalewize-production-chatbot-production.up.railway.app"
  userId={currentUser.id}
/>
```

### 4. Error Handling

When tools return authentication errors, show the OAuth initiation UI:

```javascript
if (error.message.includes('I don\'t have access to your Google Drive')) {
  // Show OAuth initiation component
  setShowOAuthInitiate(true);
}
```

### 5. Iframe Communication

The OAuth components handle cross-origin communication automatically:

```javascript
// Iframe sends message to parent
window.parent.postMessage({
  type: 'OAUTH_INITIATE',
  authUrl: data.auth_url,
  userId: userId,
  serverName: serverName
}, '*');

// Parent receives and handles OAuth
window.addEventListener('message', (event) => {
  if (event.data.type === 'OAUTH_INITIATE') {
    // Handle OAuth initiation
  }
});
```

## 🔍 Testing

### Manual Testing

1. **Test OAuth Initiation**:
   ```bash
   curl "https://mcp-servers-production-c189.up.railway.app/oauth/initiate?userId=test-user"
   ```

2. **Test Status Check**:
   ```bash
   curl "https://mcp-servers-production-c189.up.railway.app/oauth/status/test-user"
   ```

3. **Test Health Check**:
   ```bash
   curl "https://mcp-servers-production-c189.up.railway.app/health"
   ```

### Automated Testing

Run the test script:
```bash
node test-mcp.js
```

## 🚨 Troubleshooting

### Common Issues

1. **"OAuth credentials not configured"**
   - Check environment variables in Railway
   - Verify Google Cloud Console setup

2. **"Invalid redirect URI"**
   - Ensure redirect URI matches exactly in Google Cloud Console
   - Check for trailing slashes or protocol mismatches

3. **"State parameter required"**
   - OAuth state validation failed
   - Check if state parameter is being passed correctly

4. **"Token expired"**
   - User needs to re-authenticate
   - Implement token refresh logic (future enhancement)

### Debug Logs

Check Railway logs for detailed error information:
```bash
railway logs --service mcp-servers-production
```

## 🔮 Future Enhancements

1. **Token Refresh**: Implement automatic token refresh when tokens expire
2. **Persistent Storage**: Use Redis or database for token storage instead of memory
3. **Multiple Users**: Support multiple users with proper token isolation
4. **Token Encryption**: Encrypt stored tokens for security
5. **OAuth Scopes**: Allow users to choose which Google Drive permissions to grant

## 📞 Support

For issues or questions:
1. Check the troubleshooting section above
2. Review Railway logs for error details
3. Test individual endpoints manually
4. Verify Google Cloud Console configuration

---

**Last Updated**: December 2024
**Version**: 2.0.0 