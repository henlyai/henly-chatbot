# Google Cloud Setup Guide for ScaleWize AI MCP Server

This guide will help you set up Google Cloud credentials for the custom Google Drive MCP server.

## Prerequisites

- Google account
- Access to Google Cloud Console

## Step 1: Create Google Cloud Project

1. **Go to Google Cloud Console**
   - Visit [https://console.cloud.google.com/](https://console.cloud.google.com/)
   - Sign in with your Google account

2. **Create New Project**
   - Click on the project dropdown at the top
   - Click "New Project"
   - Enter project name: `scalewize-ai-mcp`
   - Click "Create"

3. **Select the Project**
   - Make sure your new project is selected

## Step 2: Enable Required APIs

1. **Enable Google Drive API**
   - Go to "APIs & Services" > "Library"
   - Search for "Google Drive API"
   - Click on it and click "Enable"

2. **Enable Google Docs API** (for document content)
   - Search for "Google Docs API"
   - Click on it and click "Enable"

3. **Enable Google Sheets API** (for spreadsheet content)
   - Search for "Google Sheets API"
   - Click on it and click "Enable"

4. **Enable Google Slides API** (for presentation content)
   - Search for "Google Slides API"
   - Click on it and click "Enable"

## Step 3: Create OAuth 2.0 Credentials

1. **Go to Credentials**
   - Navigate to "APIs & Services" > "Credentials"

2. **Create OAuth 2.0 Client ID**
   - Click "Create Credentials" > "OAuth client ID"
   - If prompted, configure the OAuth consent screen first

### Configure OAuth Consent Screen

1. **User Type**
   - Choose "External" (unless you have Google Workspace)
   - Click "Create"

2. **App Information**
   - App name: `ScaleWize AI MCP Server`
   - User support email: Your email
   - Developer contact information: Your email
   - Click "Save and Continue"

3. **Scopes**
   - Click "Add or Remove Scopes"
   - Add these scopes:
     - `https://www.googleapis.com/auth/drive.readonly`
     - `https://www.googleapis.com/auth/drive.file`
     - `https://www.googleapis.com/auth/drive.metadata.readonly`
   - Click "Save and Continue"

4. **Test Users**
   - Add your email address as a test user
   - Click "Save and Continue"

5. **Summary**
   - Review and click "Back to Dashboard"

### Create OAuth Client ID

1. **Application Type**
   - Choose "Web application"
   - Name: `ScaleWize AI MCP Server`

2. **Authorized Redirect URIs**
   - Add: `http://localhost:3001/oauth/callback`
   - Add: `https://your-domain.com/oauth/callback` (for production)
   - Click "Create"

3. **Save Credentials**
   - Copy the Client ID and Client Secret
   - Save them securely (you'll need them for the .env file)

## Step 4: Configure Environment Variables

1. **Copy Environment Template**
   ```bash
   cp custom-mcp-servers/google-drive-mcp/env.example custom-mcp-servers/google-drive-mcp/.env
   ```

2. **Edit .env File**
   ```bash
   nano custom-mcp-servers/google-drive-mcp/.env
   ```

3. **Add Your Credentials**
   ```env
   # Google Drive API Configuration
   GOOGLE_CLIENT_ID=your_client_id_here
   GOOGLE_CLIENT_SECRET=your_client_secret_here
   GOOGLE_REDIRECT_URI=http://localhost:3001/oauth/callback

   # Server Configuration
   PORT=3001
   MCP_TRANSPORT=sse
   ```

## Step 5: Test the Setup

1. **Deploy the MCP Server**
   ```bash
   ./deploy-mcp-servers.sh
   ```

2. **Check Health**
   ```bash
   curl http://localhost:3001/health
   ```

3. **Test OAuth Flow**
   - Visit: `http://localhost:3001/oauth/callback`
   - You should see a JSON response

## Step 6: Production Deployment

For production deployment, you'll need to:

1. **Update OAuth Consent Screen**
   - Go to "OAuth consent screen"
   - Change user type to "External"
   - Add your domain to authorized domains
   - Publish the app (if needed)

2. **Update Redirect URIs**
   - Add your production domain to authorized redirect URIs
   - Example: `https://your-domain.com/oauth/callback`

3. **Update Environment Variables**
   ```env
   GOOGLE_REDIRECT_URI=https://your-domain.com/oauth/callback
   ```

## Troubleshooting

### Common Issues

1. **"redirect_uri_mismatch" Error**
   - Make sure the redirect URI in your .env matches exactly what's in Google Cloud Console
   - Check for trailing slashes or protocol differences

2. **"access_denied" Error**
   - Make sure you've added your email as a test user
   - Check that the OAuth consent screen is properly configured

3. **"invalid_client" Error**
   - Verify your Client ID and Client Secret are correct
   - Make sure you're using the right credentials for the right environment

4. **API Not Enabled**
   - Go to "APIs & Services" > "Library"
   - Make sure all required APIs are enabled

### Debug Mode

Enable debug logging:
```bash
DEBUG=* npm run dev
```

### Check API Quotas

1. **Go to APIs & Services > Quotas**
2. **Check Google Drive API quotas**
3. **Request quota increases if needed**

## Security Best Practices

1. **Never commit credentials to Git**
   - Keep .env files in .gitignore
   - Use environment variables in production

2. **Use Service Accounts for Server-to-Server**
   - For production, consider using service accounts instead of OAuth
   - This eliminates the need for user consent

3. **Regular Credential Rotation**
   - Rotate OAuth credentials regularly
   - Monitor for suspicious activity

4. **Limit Scopes**
   - Only request the scopes you actually need
   - Use the principle of least privilege

## Next Steps

After setting up Google Cloud credentials:

1. **Deploy the MCP Server**
   ```bash
   ./deploy-mcp-servers.sh
   ```

2. **Update LibreChat Configuration**
   - The librechat.yaml has been updated to use the custom MCP server

3. **Test Integration**
   - Restart LibreChat
   - Test Google Drive functionality in the chatbot

4. **Monitor Usage**
   - Check Google Cloud Console for API usage
   - Monitor logs for any issues

## Support

If you encounter issues:

1. Check the logs: `./deploy-mcp-servers.sh logs`
2. Verify credentials in Google Cloud Console
3. Test OAuth flow manually
4. Check API quotas and limits 