# Slack App Setup Guide

This guide will walk you through setting up a Slack app for the Slack MCP Server integration.

## 🚀 Prerequisites

- Access to a Slack workspace where you can install apps
- Admin permissions (recommended) for the workspace
- A web browser to access the Slack API

## 📋 Step-by-Step Setup

### 1. Create a Slack App

1. **Go to Slack API Console**
   - Visit: https://api.slack.com/apps
   - Click "Create New App"
   - Choose "From scratch"

2. **Configure Basic Information**
   - **App Name**: `Henly AI Slack Integration` (or your preferred name)
   - **Pick a workspace**: Select your target workspace
   - Click "Create App"

### 2. Configure Bot Token Scopes

1. **Navigate to OAuth & Permissions**
   - In the left sidebar, click "OAuth & Permissions"
   - Scroll down to "Scopes" section

2. **Add Bot Token Scopes**
   Add the following scopes to "Bot Token Scopes":

   **Channel Management:**
   - `channels:read` - View basic channel information
   - `channels:write` - Create and manage channels
   - `groups:read` - View private channels
   - `groups:write` - Create and manage private channels

   **Messaging:**
   - `chat:write` - Send messages as the bot
   - `chat:write.public` - Send messages to public channels

   **User Management:**
   - `users:read` - View basic user information
   - `users:read.email` - View user email addresses

   **Search:**
   - `search:read` - Search messages and files

   **Team Information:**
   - `team:read` - View workspace information

   **Optional Scopes (if needed):**
   - `channels:history` - View channel message history
   - `groups:history` - View private channel message history
   - `im:history` - View direct message history
   - `mpim:history` - View group direct message history

### 3. Install App to Workspace

1. **Install the App**
   - Scroll to the top of the "OAuth & Permissions" page
   - Click "Install to Workspace"
   - Review the permissions and click "Allow"

2. **Copy Bot User OAuth Token**
   - After installation, you'll see "Bot User OAuth Token"
   - Copy the token (starts with `xoxb-`)
   - **Keep this token secure!** You'll need it for the MCP server setup

### 4. Configure App Settings (Optional)

1. **Basic Information**
   - Go to "Basic Information" in the left sidebar
   - Add a description: "Henly AI Slack integration for team communication"
   - Upload an app icon if desired

2. **Event Subscriptions (Optional)**
   - If you want real-time events, go to "Event Subscriptions"
   - Enable events and subscribe to relevant events
   - Note: This requires a public HTTPS endpoint

### 5. Test the Bot Token

You can test your bot token using curl:

```bash
curl -H "Authorization: Bearer YOUR_BOT_TOKEN" \
     https://slack.com/api/auth.test
```

Replace `YOUR_BOT_TOKEN` with your actual bot token (xoxb-...).

Expected response:
```json
{
  "ok": true,
  "url": "https://your-workspace.slack.com/",
  "team": "Your Team Name",
  "user": "Your Bot Name",
  "team_id": "T1234567890",
  "user_id": "U1234567890"
}
```

## 🔧 MCP Server Integration

### 1. Use the Setup Script

The easiest way to configure your Slack MCP server:

```bash
# Navigate to the Slack MCP directory
cd SWAI/scalewize-chatbot/custom-mcp-servers/shared/slack-mcp

# Set environment variables
export SUPABASE_ANON_KEY=your-supabase-anon-key
export MCP_ENCRYPTION_KEY=your-32-character-encryption-key

# Run the setup script
node setup-first-client.js
```

When prompted:
- **Organization ID**: Your Henly organization ID
- **Slack Bot Token**: The `xoxb-` token you copied earlier
- **Workspace Name**: Your Slack workspace name
- **Railway URL**: Your deployed MCP server URL

### 2. Manual Database Configuration

Alternatively, you can manually insert the configuration:

```sql
INSERT INTO mcp_servers (
  name, description, endpoint, capabilities, 
  organization_id, is_active, auth_type, auth_config
) VALUES (
  'Slack',
  'Slack integration for workspace',
  'https://your-slack-mcp-production.up.railway.app/mcp',
  ARRAY['list_channels', 'list_users', 'send_message', 'search_messages', 'get_channel_history', 'create_channel', 'invite_users_to_channel', 'get_workspace_info'],
  'your-organization-id',
  true,
  'service_account',
  '{"slack_token": "encrypted-token", "workspace_name": "Your Workspace"}'::jsonb
);
```

## 🧪 Testing the Integration

### 1. Test Basic Connectivity

```bash
# Test the MCP server health
curl https://your-slack-mcp-production.up.railway.app/health

# Test the MCP endpoint
curl -N https://your-slack-mcp-production.up.railway.app/mcp
```

### 2. Test Slack Tools

Once integrated with LibreChat, test these tools:

1. **List Channels**
   ```
   Use the list_channels tool to see all available channels
   ```

2. **Send a Test Message**
   ```
   Use the send_message tool to send a test message to #general
   ```

3. **Search Messages**
   ```
   Use the search_messages tool to search for recent messages
   ```

## 🔒 Security Best Practices

### 1. Token Security
- **Never commit tokens to version control**
- **Use environment variables** for all sensitive data
- **Rotate tokens regularly** if possible
- **Use the encryption feature** provided by the MCP server

### 2. App Permissions
- **Follow the principle of least privilege**
- **Only request scopes you actually need**
- **Review app permissions regularly**
- **Remove unused scopes**

### 3. Workspace Security
- **Limit app installation** to trusted administrators
- **Monitor app usage** in workspace settings
- **Review app permissions** in workspace admin panel

## 🐛 Troubleshooting

### Common Issues

1. **"Invalid token" error**
   - Verify the token starts with `xoxb-`
   - Check that the app is installed to the workspace
   - Ensure the token hasn't been revoked

2. **"Missing scopes" error**
   - Review the required scopes above
   - Reinstall the app after adding new scopes
   - Check the app's OAuth permissions

3. **"Channel not found" error**
   - Ensure the bot is a member of the channel
   - Check channel permissions
   - Verify the channel ID is correct

4. **"Permission denied" error**
   - Check workspace admin settings
   - Verify the bot has the required permissions
   - Contact workspace admin if needed

### Debug Commands

```bash
# Test bot authentication
curl -H "Authorization: Bearer xoxb-YOUR-TOKEN" \
     https://slack.com/api/auth.test

# List channels (requires channels:read scope)
curl -H "Authorization: Bearer xoxb-YOUR-TOKEN" \
     https://slack.com/api/conversations.list

# Send a test message (requires chat:write scope)
curl -X POST -H "Authorization: Bearer xoxb-YOUR-TOKEN" \
     -H "Content-type: application/json" \
     -d '{"channel":"#general","text":"Test message from bot"}' \
     https://slack.com/api/chat.postMessage
```

## 📚 Additional Resources

- **Slack API Documentation**: https://api.slack.com/
- **Slack App Manifest**: https://api.slack.com/reference/manifests
- **Slack Web API**: https://api.slack.com/web
- **Slack Events API**: https://api.slack.com/apis/connections/events-api
- **Slack Bolt Framework**: https://slack.dev/bolt-js/

## 🆘 Support

If you encounter issues:

1. **Check the troubleshooting section above**
2. **Review the Slack API documentation**
3. **Test with the debug commands**
4. **Contact the Henly AI team**

---

**Happy Slack Integration! 🎉** 