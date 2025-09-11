# Google Drive MCP Server Setup Guide

This guide will walk you through setting up the custom Google Drive MCP server locally and deploying it to Railway.

## 📋 Prerequisites

- Node.js 18+ installed
- Google Cloud account
- Railway account
- Git repository access

## 🚀 Step 1: Google Cloud Setup

### 1.1 Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the following APIs:
   - Google Drive API
   - Google Docs API
   - Google Sheets API
   - Google Slides API

### 1.2 Create OAuth 2.0 Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth 2.0 Client IDs"
3. Configure OAuth consent screen:
   - User Type: External
   - App name: "Henly AI Google Drive MCP"
   - User support email: your email
   - Developer contact information: your email
4. Create OAuth 2.0 Client ID:
   - Application type: Web application
   - Name: "Henly Google Drive MCP"
   - Authorized redirect URIs:
     - `http://localhost:3001/oauth/callback` (for local development)
     - `https://your-mcp-server.railway.app/oauth/callback` (for production - we'll add this later)

### 1.3 Save Credentials

Copy the Client ID and Client Secret - you'll need these for both local and production.

## 🏠 Step 2: Local Development Setup

### 2.1 Install Dependencies

```bash
cd custom-mcp-servers/google-drive-mcp
npm install
```

### 2.2 Configure Environment Variables

```bash
cp env.example .env
```

Edit `.env` file with your Google credentials:

```env
# Google Drive API Configuration
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:3001/oauth/callback

# Server Configuration
PORT=3001
MCP_TRANSPORT=sse
NODE_ENV=development
```

### 2.3 Test Local MCP Server

```bash
# Start the development server
npm run dev

# In another terminal, test the health endpoint
curl http://localhost:3001/health
```

Expected response: `{"status":"ok"}`

### 2.4 Test OAuth Flow (Optional)

1. Open browser to `http://localhost:3001/oauth/authorize`
2. You should be redirected to Google OAuth
3. After authorization, you'll be redirected back

## 🔧 Step 3: LibreChat Local Integration

### 3.1 Update LibreChat Configuration

Edit `librechat.yaml` in your LibreChat project:

```yaml
mcpServers:
  "Google Drive":
    type: sse
    url: http://localhost:3001/sse
    timeout: 60000
    oauth:
      authorization_url: https://accounts.google.com/o/oauth2/auth
      token_url: https://oauth2.googleapis.com/token
      scope: https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.file
      client_id: ${GOOGLE_CLIENT_ID}
      client_secret: ${GOOGLE_CLIENT_SECRET}
      redirect_uri: http://localhost:3001/oauth/callback
```

### 3.2 Add Environment Variables to LibreChat

Add to your LibreChat `.env`:

```env
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
```

### 3.3 Test Local Integration

1. Start LibreChat locally
2. Start the MCP server locally
3. Go to your chatbot
4. Try using Google Drive tools

## 🚀 Step 4: Railway Deployment

### 4.1 Deploy MCP Server to Railway

#### Option A: Deploy from GitHub (Recommended)

1. **Go to Railway Dashboard:**
   - Visit [Railway Dashboard](https://railway.app/dashboard)
   - Click "New Project"
   - Select "Deploy from GitHub repo"

2. **Connect Repository:**
   - Select your `scalewize-production-chatbot` repository
   - Set source directory to: `custom-mcp-servers/google-drive-mcp`
   - Railway will auto-detect the Dockerfile

3. **Configure Environment Variables:**
   - Go to your new Railway project
   - Click "Variables" tab
   - Add the following variables:

```env
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_REDIRECT_URI=https://your-mcp-server.railway.app/oauth/callback
PORT=3001
MCP_TRANSPORT=sse
NODE_ENV=production
```

4. **Deploy:**
   - Railway will automatically build and deploy
   - Wait for deployment to complete
   - Note your Railway URL (e.g., `https://your-mcp-server.railway.app`)

#### Option B: Deploy using Railway CLI

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Deploy
cd custom-mcp-servers/google-drive-mcp
railway init
railway up
```

### 4.2 Update Google Cloud OAuth Settings

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to "APIs & Services" > "Credentials"
3. Edit your OAuth 2.0 Client ID
4. Add authorized redirect URI: `https://your-mcp-server.railway.app/oauth/callback`
5. Save changes

### 4.3 Update LibreChat Railway Project

1. **Go to your LibreChat Railway project**
2. **Add environment variables:**

```env
GOOGLE_DRIVE_MCP_URL=https://your-mcp-server.railway.app/sse
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
```

3. **Redeploy LibreChat:**
   - Railway will automatically redeploy when you add environment variables

## ✅ Step 5: Testing

### 5.1 Test MCP Server Health

```bash
curl https://your-mcp-server.railway.app/health
```

Expected: `{"status":"ok"}`

### 5.2 Test OAuth Flow

1. Go to your chatbot in production
2. Try using a Google Drive tool
3. You should be redirected to Google OAuth
4. After authorization, the tool should work

### 5.3 Test File Content Reading

1. In your chatbot, try: "List my Google Drive files"
2. Then try: "Read the content of [filename]"
3. Verify that file content is displayed correctly

## 🔍 Step 6: Troubleshooting

### Common Issues

#### MCP Server Not Starting
```bash
# Check Railway logs
railway logs

# Verify environment variables
railway variables
```

#### OAuth Redirect Error
- Verify redirect URI in Google Cloud Console
- Check that Railway URL is correct
- Ensure HTTPS is used

#### Connection Timeout
```bash
# Test MCP server connectivity
curl -v https://your-mcp-server.railway.app/health

# Check LibreChat MCP configuration
curl https://your-librechat.railway.app/api/config
```

### Debug Commands

```bash
# Check MCP server status
curl https://your-mcp-server.railway.app/health

# Test OAuth endpoint
curl https://your-mcp-server.railway.app/oauth/authorize

# View Railway logs
railway logs

# Check deployment status
railway status
```

## 📊 Step 7: Monitoring

### Railway Dashboard

1. **Monitor MCP server:**
   - Check deployment logs
   - Monitor resource usage
   - Set up alerts for failures

2. **Monitor LibreChat:**
   - Check MCP connection logs
   - Monitor OAuth flow
   - Track tool usage

### Health Checks

Railway automatically monitors:
- **Health endpoint:** `/health`
- **Expected response:** `{"status":"ok"}`
- **Check interval:** Every 30 seconds

## 🎯 Success Criteria

Your setup is working correctly when:

✅ MCP server responds to health checks  
✅ OAuth flow works in production  
✅ Google Drive tools are available in chatbot  
✅ File content can be read and analyzed  
✅ No errors in Railway logs  

## 🔄 Next Steps

After successful deployment:

1. **Test all Google Drive functionality**
2. **Monitor performance and usage**
3. **Consider adding more MCP servers** (Slack, etc.)
4. **Set up monitoring and alerts**
5. **Plan for scaling as usage grows**

## 📞 Support

If you encounter issues:

1. Check Railway logs in the dashboard
2. Verify environment variables are set correctly
3. Test OAuth flow manually
4. Check Google Cloud Console for API quotas
5. Review this guide for common solutions

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Henly     │    │    LibreChat     │    │  Google Drive   │
│   Website       │───▶│   (Railway)      │───▶│   MCP Server    │
│   (Vercel)      │    │                  │    │   (Railway)     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │                        │
                                ▼                        ▼
                       ┌──────────────────┐    ┌─────────────────┐
                       │   Google OAuth   │    │  Google Drive   │
                       │   (Google)       │    │   API           │
                       └──────────────────┘    └─────────────────┘
```

## 📁 File Structure

```
scalewize-production-chatbot/
├── custom-mcp-servers/
│   └── google-drive-mcp/
│       ├── src/
│       │   ├── index.ts          # Main server logic
│       │   └── tools.ts          # Tool definitions
│       ├── package.json          # Dependencies
│       ├── tsconfig.json         # TypeScript config
│       ├── Dockerfile            # Docker configuration
│       ├── railway.toml          # Railway config
│       ├── env.example           # Environment template
│       └── README.md             # Documentation
├── librechat.yaml                # LibreChat config
└── SETUP_GUIDE.md               # This guide
```

## 💰 Cost Estimation

- **Railway Free Tier:** $5/month credit
- **MCP Server:** ~$2-5/month (depending on usage)
- **Total Additional Cost:** Minimal

The MCP server is lightweight and should stay within Railway's free tier limits for most use cases. 