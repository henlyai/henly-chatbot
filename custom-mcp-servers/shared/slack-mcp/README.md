# Slack MCP Server for Henly AI

A comprehensive Model Context Protocol (MCP) server for Slack integration with LibreChat, designed for multi-tenant SaaS platforms.

## 🚀 Features

- **Multi-tenant Support**: Organization-based authentication and configuration
- **Comprehensive Slack Integration**: 8 powerful tools for Slack workspace management
- **Security First**: Encrypted token storage and secure authentication
- **Performance Optimized**: Intelligent caching and rate limiting
- **Production Ready**: Railway deployment with health checks

## 🛠️ Available Tools

### 1. `list_channels`
List all channels in the Slack workspace with filtering options.

**Parameters:**
- `includePrivate` (boolean): Include private channels (default: true)
- `includeArchived` (boolean): Include archived channels (default: false)

### 2. `list_users`
List all users in the Slack workspace with filtering options.

**Parameters:**
- `includeBots` (boolean): Include bot users (default: false)
- `includeDeactivated` (boolean): Include deactivated users (default: false)

### 3. `send_message`
Send a message to a Slack channel or user.

**Parameters:**
- `channel` (string): Channel ID or user ID to send message to
- `message` (string): Message text to send
- `threadTs` (string, optional): Thread timestamp to reply to a specific message

### 4. `search_messages`
Search for messages in Slack channels.

**Parameters:**
- `query` (string): Search query to find messages
- `channel` (string, optional): Specific channel ID to search in
- `limit` (number, optional): Maximum number of results (default: 20)

### 5. `get_channel_history`
Get recent messages from a specific Slack channel.

**Parameters:**
- `channel` (string): Channel ID to get history from
- `limit` (number, optional): Maximum number of messages (default: 50)
- `oldest` (string, optional): Start time (Unix timestamp)
- `latest` (string, optional): End time (Unix timestamp)

### 6. `create_channel`
Create a new Slack channel.

**Parameters:**
- `name` (string): Name of the channel to create (without #)
- `isPrivate` (boolean, optional): Make the channel private (default: false)

### 7. `invite_users_to_channel`
Invite users to a Slack channel.

**Parameters:**
- `channel` (string): Channel ID to invite users to
- `users` (string): Comma-separated list of user IDs to invite

### 8. `get_workspace_info`
Get information about the Slack workspace.

**Parameters:** None

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   LibreChat     │    │   Slack MCP      │    │     Supabase    │
│   (Frontend)    │◄──►│   Server         │◄──►│   (Database)    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌──────────────────┐
                       │   Slack API      │
                       │   (External)     │
                       └──────────────────┘
```

## 🚀 Quick Start

### 1. Prerequisites

- Node.js 18+ and npm
- Railway account for deployment
- Supabase project with `mcp_servers` table
- Slack workspace with bot token

### 2. Local Development

```bash
# Clone and navigate to the project
cd SWAI/scalewize-chatbot/custom-mcp-servers/shared/slack-mcp

# Install dependencies
npm install

# Set up environment variables
cp env.example .env
# Edit .env with your configuration

# Start development server
npm run dev
```

### 3. Railway Deployment

1. **Create Railway Service**
   ```bash
   # Connect to Railway
   railway login
   railway init
   ```

2. **Set Environment Variables**
   ```bash
   railway variables set SUPABASE_URL=https://your-project.supabase.co
   railway variables set SUPABASE_ANON_KEY=your-supabase-anon-key
   railway variables set MCP_ENCRYPTION_KEY=your-32-character-encryption-key
   railway variables set PORT=3002
   ```

3. **Deploy**
   ```bash
   railway up
   ```

### 4. Database Configuration

Run the setup script to configure your first client:

```bash
# Set environment variables
export SUPABASE_ANON_KEY=your-supabase-anon-key
export MCP_ENCRYPTION_KEY=your-32-character-encryption-key

# Run setup
node setup-first-client.js
```

Or manually insert into Supabase:

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

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `SUPABASE_URL` | Supabase project URL | Yes |
| `SUPABASE_ANON_KEY` | Supabase anonymous key | Yes |
| `MCP_ENCRYPTION_KEY` | 32-character encryption key | Yes |
| `PORT` | Server port (default: 3002) | No |

### Slack Bot Setup

1. **Create Slack App**
   - Go to https://api.slack.com/apps
   - Click "Create New App" → "From scratch"
   - Name your app and select workspace

2. **Configure Bot Token Scopes**
   - Go to "OAuth & Permissions"
   - Add the following scopes:
     - `channels:read`
     - `channels:write`
     - `chat:write`
     - `groups:read`
     - `groups:write`
     - `users:read`
     - `users:read.email`
     - `search:read`
     - `team:read`

3. **Install App to Workspace**
   - Click "Install to Workspace"
   - Copy the "Bot User OAuth Token" (starts with `xoxb-`)

4. **Use Token in Setup**
   - Run the setup script and provide the bot token
   - The token will be encrypted and stored securely

## 🔒 Security Features

- **Token Encryption**: All Slack tokens are encrypted using AES-256-CBC
- **Organization Isolation**: Each organization has isolated Slack access
- **Rate Limiting**: Prevents infinite loops and API abuse
- **Error Handling**: Secure error messages without sensitive data exposure
- **CORS Protection**: Configured for production environments

## 📊 Performance Optimizations

- **Client Caching**: Slack clients cached for 30 minutes
- **Data Caching**: Channel and user lists cached for 5 minutes
- **Connection Pooling**: Efficient API connection management
- **Request Batching**: Optimized API calls where possible

## 🧪 Testing

### Health Check
```bash
curl https://your-slack-mcp-production.up.railway.app/health
```

### MCP Endpoint Test
```bash
curl -N https://your-slack-mcp-production.up.railway.app/mcp
```

### Local Testing
```bash
# Start server
npm run dev

# Test health endpoint
curl http://localhost:3002/health

# Test MCP endpoint
curl -N http://localhost:3002/mcp
```

## 🐛 Troubleshooting

### Common Issues

1. **"Slack not configured for organization"**
   - Ensure the organization has a valid Slack MCP configuration in Supabase
   - Check that the `mcp_servers` table has the correct entry

2. **"Invalid Slack token"**
   - Verify the bot token is correct and starts with `xoxb-`
   - Ensure the bot has the required scopes
   - Check that the app is installed to the workspace

3. **"Too many requests"**
   - The rate limiter is preventing abuse
   - Wait a moment before making more requests
   - Check for infinite loops in your tool usage

4. **CORS Errors**
   - Ensure the Railway URL is added to LibreChat's CORS configuration
   - Check that the MCP endpoint is accessible

### Debug Mode

Enable debug logging by setting:
```bash
export DEBUG=slack-mcp:*
npm run dev
```

## 📚 API Reference

### Slack Web API Integration

This MCP server uses the official `@slack/web-api` package and supports all standard Slack API features:

- **Conversations**: Channel management and messaging
- **Users**: User information and management
- **Search**: Message and file search capabilities
- **Team**: Workspace information
- **Auth**: Token validation and testing

### MCP Protocol Compliance

- **SSE Transport**: Server-Sent Events for real-time communication
- **Tool Definitions**: Proper Zod schemas for all parameters
- **Error Handling**: Structured error responses
- **Context Support**: Organization-based request context

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

For support and questions:
- Check the troubleshooting section above
- Review the Slack API documentation
- Contact the Henly AI team

---

**Built with ❤️ for Henly AI** 