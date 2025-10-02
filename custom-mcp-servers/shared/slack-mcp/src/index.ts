import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { z } from 'zod';
import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

console.log('🚀 Starting Slack MCP Server...');

// Initialize MCP server
const server = new McpServer(
  {
    name: 'slack-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Initialize Supabase client
let supabase: any = null;

// Cache for Slack clients
const slackClients = new Map<string, any>();
const channelCache = new Map<string, any[]>();
const userCache = new Map<string, any[]>();

// Rate limiting
const toolCallCounts = new Map<string, { count: number; timestamp: number }>();

// Transport management for SSE sessions
const transports: { [sessionId: string]: SSEServerTransport } = {};

// Initialize Supabase
async function initializeSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY environment variables are required');
  }

  supabase = createClient(supabaseUrl, supabaseAnonKey);
  console.log('✅ Supabase initialized');
}

// Get organization ID from context
function getOrganizationIdFromContext(context: any): string {
  const orgId = context?.headers?.['x-mcp-client'] || 
                context?.headers?.['X-MCP-Client'] ||
                context?.requestInfo?.headers?.['x-mcp-client'] ||
                context?.requestInfo?.headers?.['X-MCP-Client'] ||
                context?.organizationId;
  
  if (!orgId) {
    // SECURITY FIX: No fallback to default organization ID
    // This was a critical security vulnerability
    throw new Error('Organization ID is required but not provided in request context');
  }
  
  return orgId;
}

// Get organization-specific Slack client
async function getOrganizationSlackClient(organizationId: string) {
  // Check cache first
  if (slackClients.has(organizationId)) {
    return slackClients.get(organizationId);
  }

  // Get MCP server configuration from Supabase
  const { data: mcpServer, error } = await supabase
    .from('mcp_servers')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('name', 'Slack')
    .eq('is_active', true)
    .single();

  if (error || !mcpServer) {
    throw new Error(`Slack not configured for organization ${organizationId}`);
  }

  // Decrypt the Slack token
  const encryptedToken = mcpServer.auth_config?.slack_token;
  if (!encryptedToken) {
    throw new Error('Slack token not found in configuration');
  }

  const decryptedToken = decryptSlackToken(encryptedToken);
  
  // Create Slack client
  const { WebClient } = await import('@slack/web-api');
  const client = new WebClient(decryptedToken);
  
  // Cache the client
  slackClients.set(organizationId, client);
  
  return client;
}

// Decrypt Slack token
function decryptSlackToken(encryptedToken: string): string {
  try {
    const encryptionKey = process.env.MCP_ENCRYPTION_KEY;
    if (!encryptionKey) {
      throw new Error('MCP_ENCRYPTION_KEY environment variable is required');
    }

    // Derive key using scrypt
    const key = crypto.scryptSync(encryptionKey, 'salt', 32);
    
    // Extract IV and encrypted data
    const parts = encryptedToken.split(':');
    if (parts.length !== 2) {
      throw new Error('Invalid encrypted token format');
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedData = Buffer.from(parts[1], 'hex');
    
    // Decrypt
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encryptedData, undefined, 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Error decrypting Slack token:', error);
    throw new Error('Failed to decrypt Slack token');
  }
}

// Rate limiting function
function checkToolCallLimit(sessionId: string): boolean {
  const now = Date.now();
  const windowMs = 60000; // 1 minute window
  const maxCalls = 10; // Max 10 calls per minute

  const current = toolCallCounts.get(sessionId);
  if (!current || now - current.timestamp > windowMs) {
    toolCallCounts.set(sessionId, { count: 1, timestamp: now });
    return true;
  }

  if (current.count >= maxCalls) {
    return false;
  }

  current.count++;
  return true;
}

// Sanitize error messages
function sanitizeErrorMessage(error: any): string {
  const message = error instanceof Error ? error.message : String(error);
  // Remove any sensitive information like tokens
  return message.replace(/xoxb-[a-zA-Z0-9-]+/g, '[TOKEN]');
}

// Slack Tool 1: List channels
server.tool('slack_list_channels', 'List all Slack channels in the workspace. Use this to see available channels and their IDs.', {
  includeArchived: z.boolean().optional().describe('Include archived channels (default: false)').default(false)
}, async ({ includeArchived }: { includeArchived: boolean }, context: any) => {
  try {
    const organizationId = getOrganizationIdFromContext(context);
    const sessionId = `${organizationId}-slack-channels-${Date.now()}`;
    
    if (!checkToolCallLimit(sessionId)) {
      return {
        content: [
          {
            type: 'text',
            text: 'Too many requests. Please wait a moment before trying again.'
          }
        ]
      };
    }

    console.log(`📋 Listing Slack channels for organization: ${organizationId}`);
    
    const client = await getOrganizationSlackClient(organizationId);
    
    const result = await client.conversations.list({
      exclude_archived: !includeArchived,
      types: 'public_channel,private_channel'
    });

    const channels = result.channels || [];
    
    if (channels.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: 'No Slack channels found.'
          }
        ]
      };
    }

    const channelList = channels.map((channel: any) => 
      `#${channel.name} (ID: ${channel.id}) - ${channel.is_private ? 'Private' : 'Public'}${channel.is_archived ? ' - Archived' : ''}`
    ).join('\n');

    return {
      content: [
        {
          type: 'text',
          text: `Found ${channels.length} Slack channels:\n\n${channelList}\n\n💡 Tip: Use the channel ID with slack_send_message to send messages.`
        }
      ]
    };
  } catch (error) {
    console.error(`❌ Error in slack_list_channels: ${error}`);
    return {
      content: [
        {
          type: 'text',
          text: `Error listing Slack channels: ${sanitizeErrorMessage(error)}`
        }
      ]
    };
  }
});

// Slack Tool 2: List users
server.tool('slack_list_users', 'List all users in the Slack workspace. Use this to see team members and their IDs.', {
  includeDeleted: z.boolean().optional().describe('Include deleted users (default: false)').default(false)
}, async ({ includeDeleted }: { includeDeleted: boolean }, context: any) => {
  try {
    const organizationId = getOrganizationIdFromContext(context);
    const sessionId = `${organizationId}-slack-users-${Date.now()}`;
    
    if (!checkToolCallLimit(sessionId)) {
      return {
        content: [
          {
            type: 'text',
            text: 'Too many requests. Please wait a moment before trying again.'
          }
        ]
      };
    }

    console.log(`👥 Listing Slack users for organization: ${organizationId}`);
    
    const client = await getOrganizationSlackClient(organizationId);
    
    const result = await client.users.list({
      include_locale: false
    });

    const users = result.members || [];
    
    // Filter out deleted users unless requested
    const activeUsers = includeDeleted ? users : users.filter((user: any) => !user.deleted);
    
    if (activeUsers.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: 'No Slack users found.'
          }
        ]
      };
    }

    const userList = activeUsers.map((user: any) => 
      `${user.real_name || user.name} (@${user.name}) (ID: ${user.id})${user.is_bot ? ' - Bot' : ''}${user.deleted ? ' - Deleted' : ''}`
    ).join('\n');

    return {
      content: [
        {
          type: 'text',
          text: `Found ${activeUsers.length} Slack users:\n\n${userList}\n\n💡 Tip: Use user IDs with slack_invite_users_to_channel to add users to channels.`
        }
      ]
    };
  } catch (error) {
    console.error(`❌ Error in slack_list_users: ${error}`);
    return {
      content: [
        {
          type: 'text',
          text: `Error listing Slack users: ${sanitizeErrorMessage(error)}`
        }
      ]
    };
  }
});

// Slack Tool 3: Send message
server.tool('slack_send_message', 'Send a message to a Slack channel. Use this to communicate with your team.', {
  channel: z.string().describe('Channel ID to send message to'),
  message: z.string().describe('Message text to send'),
  threadTs: z.string().optional().describe('Thread timestamp to reply to (optional)')
}, async ({ channel, message, threadTs }: { channel: string; message: string; threadTs?: string }, context: any) => {
  try {
    const organizationId = getOrganizationIdFromContext(context);
    const sessionId = `${organizationId}-slack-send-${Date.now()}`;
    
    if (!checkToolCallLimit(sessionId)) {
      return {
        content: [
          {
            type: 'text',
            text: 'Too many requests. Please wait a moment before trying again.'
          }
        ]
      };
    }

    // Validate inputs
    if (!channel) {
      throw new Error('Channel ID is required');
    }

    if (!message || message.trim().length === 0) {
      throw new Error('Message text is required');
    }

    console.log(`💬 Sending Slack message to channel ${channel} for organization: ${organizationId}`);
    
    const client = await getOrganizationSlackClient(organizationId);
    
    const messageParams: any = {
      channel,
      text: message
    };
    
    if (threadTs) {
      messageParams.thread_ts = threadTs;
    }

    const result = await client.chat.postMessage(messageParams);

    if (result.ok) {
      return {
        content: [
          {
            type: 'text',
            text: `✅ Message sent successfully to Slack channel ${channel}!\n\nMessage: "${message}"\nTimestamp: ${result.ts}\n${threadTs ? 'Thread reply: Yes' : ''}`
          }
        ]
      };
    } else {
      throw new Error(`Failed to send message: ${result.error}`);
    }
  } catch (error) {
    console.error(`❌ Error in slack_send_message: ${error}`);
    return {
      content: [
        {
          type: 'text',
          text: `Error sending Slack message: ${sanitizeErrorMessage(error)}`
        }
      ]
    };
  }
});

// Slack Tool 4: Search messages
server.tool('slack_search_messages', 'Search for messages in Slack channels. Use this to find specific conversations or information.', {
  query: z.string().describe('Search query to find messages'),
  channel: z.string().optional().describe('Specific channel ID to search in (optional)'),
  limit: z.number().optional().describe('Maximum number of results (default: 20)').default(20)
}, async ({ query, channel, limit }: { query: string; channel?: string; limit: number }, context: any) => {
  try {
    const organizationId = getOrganizationIdFromContext(context);
    const sessionId = `${organizationId}-slack-search-${Date.now()}`;
    
    if (!checkToolCallLimit(sessionId)) {
      return {
        content: [
          {
            type: 'text',
            text: 'Too many requests. Please wait a moment before trying again.'
          }
        ]
      };
    }

    // Validate inputs
    if (!query || query.trim().length === 0) {
      throw new Error('Search query is required');
    }

    if (limit && (limit < 1 || limit > 100)) {
      throw new Error('Limit must be between 1 and 100');
    }

    console.log(`🔍 Searching Slack messages for organization: ${organizationId} with query: "${query}"`);
    
    const client = await getOrganizationSlackClient(organizationId);
    
    const searchParams: any = {
      query,
      count: limit
    };
    
    if (channel) {
      searchParams.channel = channel;
    }

    const result = await client.search.messages(searchParams);

    const messages = result.messages?.matches || [];
    
    if (messages.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: `No Slack messages found matching "${query}"${channel ? ` in channel ${channel}` : ''}.`
          }
        ]
      };
    }

    const messageList = messages.map((msg: any) => 
      `📝 ${msg.username || 'Unknown'} in #${msg.channel?.name || 'unknown'} at ${new Date(parseFloat(msg.ts) * 1000).toLocaleString()}:\n"${msg.text}"\n`
    ).join('\n');

    return {
      content: [
        {
          type: 'text',
          text: `Found ${messages.length} Slack messages matching "${query}":\n\n${messageList}\n\n💡 Tip: Use slack_send_message with thread_ts to reply to specific messages.`
        }
      ]
    };
  } catch (error) {
    console.error(`❌ Error in slack_search_messages: ${error}`);
    return {
      content: [
        {
          type: 'text',
          text: `Error searching Slack messages: ${sanitizeErrorMessage(error)}`
        }
      ]
    };
  }
});

// Slack Tool 5: Get channel history
server.tool('slack_get_channel_history', 'Get recent messages from a specific Slack channel. Use this to see recent conversations.', {
  channel: z.string().describe('Channel ID to get history from'),
  limit: z.number().optional().describe('Maximum number of messages (default: 50)').default(50),
  oldest: z.string().optional().describe('Start time (Unix timestamp)'),
  latest: z.string().optional().describe('End time (Unix timestamp)')
}, async ({ channel, limit, oldest, latest }: { channel: string; limit: number; oldest?: string; latest?: string }, context: any) => {
  try {
    const organizationId = getOrganizationIdFromContext(context);
    const sessionId = `${organizationId}-slack-history-${Date.now()}`;
    
    if (!checkToolCallLimit(sessionId)) {
      return {
        content: [
          {
            type: 'text',
            text: 'Too many requests. Please wait a moment before trying again.'
          }
        ]
      };
    }

    // Validate inputs
    if (!channel) {
      throw new Error('Channel ID is required');
    }

    if (limit && (limit < 1 || limit > 1000)) {
      throw new Error('Limit must be between 1 and 1000');
    }

    console.log(`📜 Getting Slack channel history for ${channel} in organization: ${organizationId}`);
    
    const client = await getOrganizationSlackClient(organizationId);
    
    const historyParams: any = {
      channel,
      limit
    };
    
    if (oldest) {
      historyParams.oldest = oldest;
    }
    
    if (latest) {
      historyParams.latest = latest;
    }

    const result = await client.conversations.history(historyParams);

    const messages = result.messages || [];
    
    if (messages.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: `No messages found in Slack channel ${channel}.`
          }
        ]
      };
    }

    const messageList = messages.map((msg: any) => 
      `📝 ${msg.user || 'Unknown'} at ${new Date(parseFloat(msg.ts) * 1000).toLocaleString()}:\n"${msg.text}"\n`
    ).join('\n');

    return {
      content: [
        {
          type: 'text',
          text: `Recent messages in Slack channel ${channel}:\n\n${messageList}\n\n💡 Tip: Use slack_send_message to reply to the channel or specific messages.`
        }
      ]
    };
  } catch (error) {
    console.error(`❌ Error in slack_get_channel_history: ${error}`);
    return {
      content: [
        {
          type: 'text',
          text: `Error getting Slack channel history: ${sanitizeErrorMessage(error)}`
        }
      ]
    };
  }
});

// Slack Tool 6: Create channel
server.tool('slack_create_channel', 'Create a new Slack channel. Use this to set up new discussion spaces.', {
  name: z.string().describe('Name of the channel to create (without #)'),
  isPrivate: z.boolean().optional().describe('Make the channel private (default: false)').default(false)
}, async ({ name, isPrivate }: { name: string; isPrivate: boolean }, context: any) => {
  try {
    const organizationId = getOrganizationIdFromContext(context);
    const sessionId = `${organizationId}-slack-create-${Date.now()}`;
    
    if (!checkToolCallLimit(sessionId)) {
      return {
        content: [
          {
            type: 'text',
            text: 'Too many requests. Please wait a moment before trying again.'
          }
        ]
      };
    }

    // Validate inputs
    if (!name || name.trim().length === 0) {
      throw new Error('Channel name is required');
    }

    if (name.length > 80) {
      throw new Error('Channel name too long (max 80 characters)');
    }

    // Validate channel name format
    if (!/^[a-z0-9-_]+$/.test(name)) {
      throw new Error('Channel name can only contain lowercase letters, numbers, hyphens, and underscores');
    }

    console.log(`➕ Creating Slack channel ${name} for organization: ${organizationId}`);
    
    const client = await getOrganizationSlackClient(organizationId);
    
    const result = await client.conversations.create({
      name,
      is_private: isPrivate
    });

    if (result.ok) {
      return {
        content: [
          {
            type: 'text',
            text: `✅ Slack channel #${name} created successfully!\n\nChannel ID: ${result.channel?.id}\nPrivate: ${isPrivate ? 'Yes' : 'No'}\n\n💡 Tip: Use slack_send_message to post the first message in the new channel.`
          }
        ]
      };
    } else {
      throw new Error(`Failed to create channel: ${result.error}`);
    }
  } catch (error) {
    console.error(`❌ Error in slack_create_channel: ${error}`);
    return {
      content: [
        {
          type: 'text',
          text: `Error creating Slack channel: ${sanitizeErrorMessage(error)}`
        }
      ]
    };
  }
});

// Slack Tool 7: Invite users to channel
server.tool('slack_invite_users_to_channel', 'Invite users to a Slack channel. Use this to add team members to discussions.', {
  channel: z.string().describe('Channel ID to invite users to'),
  users: z.string().describe('Comma-separated list of user IDs to invite')
}, async ({ channel, users }: { channel: string; users: string }, context: any) => {
  try {
    const organizationId = getOrganizationIdFromContext(context);
    const sessionId = `${organizationId}-slack-invite-${Date.now()}`;
    
    if (!checkToolCallLimit(sessionId)) {
      return {
        content: [
          {
            type: 'text',
            text: 'Too many requests. Please wait a moment before trying again.'
          }
        ]
      };
    }

    // Validate inputs
    if (!channel) {
      throw new Error('Channel ID is required');
    }

    if (!users || users.trim().length === 0) {
      throw new Error('User IDs are required');
    }

    console.log(`👥 Inviting users to Slack channel ${channel} for organization: ${organizationId}`);
    
    const client = await getOrganizationSlackClient(organizationId);
    
    const userIds = users.split(',').map(id => id.trim()).filter(id => id.length > 0);
    
    if (userIds.length === 0) {
      throw new Error('No valid user IDs provided');
    }

    const result = await client.conversations.invite({
      channel,
      users: userIds.join(',')
    });

    if (result.ok) {
      return {
        content: [
          {
            type: 'text',
            text: `✅ Successfully invited ${userIds.length} user(s) to Slack channel ${channel}!\n\nInvited users: ${userIds.join(', ')}`
          }
        ]
      };
    } else {
      throw new Error(`Failed to invite users: ${result.error}`);
    }
  } catch (error) {
    console.error(`❌ Error in slack_invite_users_to_channel: ${error}`);
    return {
      content: [
        {
          type: 'text',
          text: `Error inviting users to Slack channel: ${sanitizeErrorMessage(error)}`
        }
      ]
    };
  }
});

// Slack Tool 8: Get workspace info
server.tool('slack_get_workspace_info', 'Get information about the Slack workspace. Use this to understand the workspace structure.', {}, async (_: any, context: any) => {
  try {
    const organizationId = getOrganizationIdFromContext(context);
    const sessionId = `${organizationId}-slack-workspace-${Date.now()}`;
    
    if (!checkToolCallLimit(sessionId)) {
      return {
        content: [
          {
            type: 'text',
            text: 'Too many requests. Please wait a moment before trying again.'
          }
        ]
      };
    }

    console.log(`🏢 Getting Slack workspace info for organization: ${organizationId}`);
    
    const client = await getOrganizationSlackClient(organizationId);
    
    const [teamInfo, authTest] = await Promise.all([
      client.team.info(),
      client.auth.test()
    ]);

    const workspaceInfo = `
🏢 **Slack Workspace Information**
Name: ${teamInfo.team?.name || 'Unknown'}
Domain: ${teamInfo.team?.domain || 'Unknown'}
Description: ${(teamInfo.team as any)?.description || 'No description'}
Created: ${(teamInfo.team as any)?.date_created ? new Date(parseInt((teamInfo.team as any).date_created) * 1000).toLocaleDateString() : 'Unknown'}

👤 **Current User**
Name: ${authTest.user || 'Unknown'}
Team: ${authTest.team || 'Unknown'}
User ID: ${authTest.user_id || 'Unknown'}

📊 **Workspace Stats**
Channels: ${(teamInfo.team as any)?.channels_count || 'Unknown'}
Users: ${(teamInfo.team as any)?.members_count || 'Unknown'}
`;

    return {
      content: [
        {
          type: 'text',
          text: workspaceInfo
        }
      ]
    };
  } catch (error) {
    console.error(`❌ Error in slack_get_workspace_info: ${error}`);
    return {
      content: [
        {
          type: 'text',
          text: `Error getting Slack workspace info: ${sanitizeErrorMessage(error)}`
        }
      ]
    };
  }
});

// Initialize Supabase and start the server
async function startServer() {
  try {
    await initializeSupabase();
    
    const app = express();
    const port = process.env.PORT || 3002;

    // CORS configuration
    app.use(cors({
      origin: process.env.NODE_ENV === 'production' 
        ? ['https://librechat.ai', 'https://your-domain.com'] 
        : true,
      credentials: true
    }));

    // Health check endpoint
    app.get('/health', (req, res) => {
      res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'slack-mcp-server',
        version: '1.0.0'
      });
    });

    // SSE endpoint for establishing the stream (official MCP endpoint)
    app.get('/mcp', async (req, res) => {
      console.log('📡 Received GET request to /mcp (establishing SSE stream)');
      try {
        // Create a new SSE transport for the client
        const transport = new SSEServerTransport('/messages', res);
        
        // Store the transport by session ID
        const sessionId = transport.sessionId;
        transports[sessionId] = transport;
        
        // Set up onclose handler to clean up transport when closed
        transport.onclose = () => {
          console.log(`🗑️  SSE transport closed for session ${sessionId}`);
          delete transports[sessionId];
        };
        
        // Connect the transport to the MCP server
        await server.connect(transport);
        
        console.log(`✅ Established SSE stream with session ID: ${sessionId}`);
        
        // Send a keep-alive every 30 seconds to maintain connection
        const keepAliveInterval = setInterval(() => {
          if (!res.destroyed) {
            res.write(':\n\n');
          } else {
            clearInterval(keepAliveInterval);
          }
        }, 30000);

        // Clean up interval when connection closes
        req.on('close', () => {
          clearInterval(keepAliveInterval);
          console.log(`🔌 Client disconnected for session ${sessionId}`);
        });
        
      } catch (error) {
        console.error('❌ Error establishing SSE stream:', error);
        if (!res.headersSent) {
          res.status(500).send('Error establishing SSE stream');
        }
      }
    });

    // Messages endpoint for receiving client JSON-RPC requests (official MCP endpoint)
    app.post('/messages', async (req, res) => {
      console.log('📨 Received POST request to /messages');
      
      // Extract session ID from URL query parameter
      const sessionId = req.query.sessionId as string;
      if (!sessionId) {
        console.error('❌ No session ID provided in request URL');
        res.status(400).send('Missing sessionId parameter');
        return;
      }
      
      const transport = transports[sessionId];
      if (!transport) {
        console.error(`❌ No active transport found for session ID: ${sessionId}`);
        res.status(404).send('Session not found');
        return;
      }
      
      try {
        // Handle the POST message with the transport
        await transport.handlePostMessage(req, res, req.body);
      } catch (error) {
        console.error('❌ Error handling request:', error);
        if (!res.headersSent) {
          res.status(500).send('Error handling request');
        }
      }
    });

    // Start the server
    app.listen(port, () => {
      console.log(`✅ Slack MCP Server running on port ${port}`);
      console.log(`🔗 Health check: http://localhost:${port}/health`);
      console.log(`📡 MCP endpoint: http://localhost:${port}/mcp`);
      console.log(`📨 Messages endpoint: http://localhost:${port}/messages`);
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

// Start the server
startServer(); 