# Railway MCP Deployment Guide

This guide will help you deploy the custom Google Drive MCP server to Railway, integrating seamlessly with your existing LibreChat deployment.

## Prerequisites

- Railway account
- Google Cloud credentials (follow `GOOGLE_CLOUD_SETUP.md`)
- Git repository access

## Step 1: Deploy Google Drive MCP Server to Railway

### Option A: Deploy from GitHub (Recommended)

1. **Create a new Railway project:**
   - Go to [Railway Dashboard](https://railway.app/dashboard)
   - Click "New Project"
   - Select "Deploy from GitHub repo"

2. **Connect your repository:**
   - Select your `scalewize-production-chatbot` repository
   - Set the source directory to: `custom-mcp-servers/google-drive-mcp`

3. **Configure the deployment:**
   - Railway will automatically detect the Dockerfile
   - Set the following environment variables:

### Environment Variables for Railway

```env
# Google Drive API Configuration
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=https://your-mcp-server.railway.app/oauth/callback

# Server Configuration
PORT=3001
MCP_TRANSPORT=sse
NODE_ENV=production
```

### Option B: Deploy using Railway CLI

1. **Install Railway CLI:**
   ```bash
   npm install -g @railway/cli
   ```

2. **Login to Railway:**
   ```bash
   railway login
   ```

3. **Deploy the MCP server:**
   ```bash
   cd custom-mcp-servers/google-drive-mcp
   railway init
   railway up
   ```

## Step 2: Update LibreChat Configuration

Once your MCP server is deployed, you'll get a Railway URL like:
`https://your-mcp-server.railway.app`

### Update Environment Variables in LibreChat Railway Project

1. **Go to your LibreChat Railway project**
2. **Add these environment variables:**

```env
# Google Drive MCP Server URL
GOOGLE_DRIVE_MCP_URL=https://your-mcp-server.railway.app/sse

# Google OAuth Credentials (same as MCP server)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

### Update Google Cloud OAuth Settings

1. **Go to Google Cloud Console**
2. **Update OAuth 2.0 Client ID:**
   - Add authorized redirect URI: `https://your-mcp-server.railway.app/oauth/callback`

## Step 3: Test the Integration

1. **Redeploy LibreChat** (Railway will auto-deploy when you update environment variables)

2. **Test the MCP server health:**
   ```bash
   curl https://your-mcp-server.railway.app/health
   ```

3. **Test in LibreChat:**
   - Go to your chatbot
   - Try using Google Drive tools
   - The OAuth flow should work seamlessly

## Step 4: Monitor and Maintain

### Railway Dashboard Monitoring

1. **Check MCP server logs:**
   - Go to your MCP server Railway project
   - Click on "Deployments" tab
   - View logs for any errors

2. **Monitor resource usage:**
   - Check CPU and memory usage
   - Scale up if needed

### Health Checks

Railway will automatically monitor your MCP server using the health check endpoint:
- **Health URL:** `https://your-mcp-server.railway.app/health`
- **Expected Response:** `{"status":"ok"}`

## Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   ScaleWize     │    │    LibreChat     │    │  Google Drive   │
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

## Troubleshooting

### Common Issues

1. **MCP Server Not Starting:**
   - Check Railway logs
   - Verify environment variables
   - Ensure Dockerfile is correct

2. **OAuth Redirect Error:**
   - Verify redirect URI in Google Cloud Console
   - Check that Railway URL is correct
   - Ensure HTTPS is used

3. **Connection Timeout:**
   - Check that MCP server is running
   - Verify URL in LibreChat configuration
   - Check network connectivity

### Debug Commands

```bash
# Check MCP server status
curl https://your-mcp-server.railway.app/health

# Check LibreChat MCP connection
curl https://your-librechat.railway.app/api/config

# View Railway logs
railway logs
```

## Cost Optimization

### Railway Pricing

- **Free Tier:** $5 credit per month
- **Paid Plans:** Pay-as-you-go based on usage

### Optimization Tips

1. **Use Railway's free tier** for development
2. **Monitor resource usage** and scale down when not needed
3. **Consider shared resources** for multiple MCP servers

## Security Considerations

1. **Environment Variables:**
   - Never commit secrets to Git
   - Use Railway's environment variable system
   - Rotate credentials regularly

2. **Network Security:**
   - Railway provides HTTPS by default
   - No additional firewall configuration needed
   - Automatic SSL certificates

3. **Access Control:**
   - Railway projects are private by default
   - Control access through Railway dashboard
   - Monitor deployment logs

## Next Steps

After successful deployment:

1. **Test all Google Drive functionality**
2. **Monitor performance and usage**
3. **Consider adding more MCP servers** (Slack, etc.)
4. **Set up monitoring and alerts**
5. **Plan for scaling as usage grows**

## Support

If you encounter issues:

1. **Check Railway logs** in the dashboard
2. **Verify environment variables** are set correctly
3. **Test OAuth flow** manually
4. **Check Google Cloud Console** for API quotas
5. **Review this guide** for common solutions 