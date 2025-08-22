import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { z } from 'zod';
import { WebClient } from '@slack/web-api';
import express from 'express';
import cors from 'cors';
import crypto from 'crypto';

console.log('🚀 Starting Slack MCP Server...');

// Supabase client for fetching organization configurations
let supabase: any;

// Cache for organization Slack clients to avoid repeated authentication
const slackClientCache = new Map<string, { client: WebClient; lastUsed: number }>();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// Cache for channel and user listings to reduce API calls
const channelCache = new Map<string, { channels: any[]; timestamp: number }>();
const userCache = new Map<string, { users: any[]; timestamp: number }>();
const CACHE_TTL_SHORT = 5 * 60 * 1000; // 5 minutes

// Track tool calls to prevent infinite loops
const toolCallTracker = new Map<string, { count: number; lastCall: number }>();
const MAX_CALLS_PER_SESSION = 50; // Prevent infinite loops
const CALL_RESET_INTERVAL = 60 * 1000; // Reset counter every minute

async function initializeSupabase() {
  const { createClient } = await import('@supabase/supabase-js');
  supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
  );
  console.log('✅ Supabase client initialized');
}

// Encryption key for decrypting Slack tokens
const ENCRYPTION_KEY = process.env.MCP_ENCRYPTION_KEY || 'your-encryption-key-32-chars-long!';

// Create a single MCP server instance
console.log('🔧 Creating MCP server instance...');
const server = new McpServer(
  {
    name: 'slack-mcp-server',
    version: '1.0.0'
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

// Helper function to derive key from password using scrypt (secure)
function deriveKey(password: string, salt: Buffer): Buffer {
  return crypto.scryptSync(password, salt, 32);
}

// Helper function to decrypt Slack token (SECURE VERSION)
function decryptSlackToken(encryptedToken: string): string {
  try {
    const [ivHex, saltHex, encrypted] = encryptedToken.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const salt = Buffer.from(saltHex, 'hex');
    
    // Derive key from password and salt
    const key = deriveKey(ENCRYPTION_KEY, salt);
    
    // Use secure decryption method
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv as crypto.BinaryLike);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('❌ Error decrypting Slack token:', error);
    throw new Error('Failed to decrypt Slack token');
  }
}

// Helper function to encrypt Slack token (SECURE VERSION)
function encryptSlackToken(token: string): string {
  try {
    const iv = crypto.randomBytes(16);
    const salt = crypto.randomBytes(16);
    
    // Derive key from password and salt
    const key = deriveKey(ENCRYPTION_KEY, salt);
    
    // Use secure encryption method
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv as crypto.BinaryLike);
    let encrypted = cipher.update(token, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return `${iv.toString('hex')}:${salt.toString('hex')}:${encrypted}`;
  } catch (error) {
    console.error('❌ Error encrypting Slack token:', error);
    throw new Error('Failed to encrypt Slack token');
  }
}

// Helper function to get organization-specific Slack client with caching
async function getOrganizationSlackClient(organizationId: string) {
  try {
    // Validate organization ID
    if (!organizationId || typeof organizationId !== 'string') {
      throw new Error('Invalid organization ID');
    }

    // Check cache first
    const cached = slackClientCache.get(organizationId);
    if (cached && Date.now() - cached.lastUsed < CACHE_TTL) {
      cached.lastUsed = Date.now();
      return cached.client;
    }

    console.log(`🔍 Fetching Slack config for organization: ${organizationId}`);
    
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

    if (mcpServer.auth_type !== 'service_account') {
      throw new Error(`Slack authentication not set up for organization ${organizationId}`);
    }

    // Validate auth_config structure
    if (!mcpServer.auth_config || !mcpServer.auth_config.slack_token) {
      throw new Error(`Invalid Slack configuration for organization ${organizationId}`);
    }

    // Decrypt Slack token
    const slackToken = decryptSlackToken(mcpServer.auth_config.slack_token);
    
    // Validate token format
    if (!slackToken.startsWith('xoxb-')) {
      throw new Error('Invalid Slack bot token format');
    }
    
    const client = new WebClient(slackToken);
    
    // Test the token by calling auth.test
    try {
      await client.auth.test();
    } catch (authError) {
      console.error('❌ Invalid Slack token for organization:', organizationId);
      throw new Error('Invalid Slack token');
    }

    // Cache the client
    slackClientCache.set(organizationId, { client, lastUsed: Date.now() });
    
    return client;
  } catch (error) {
    console.error(`❌ Error getting organization Slack client: ${error}`);
    throw error;
  }
}

// Helper function to extract organization ID from request context
function getOrganizationIdFromContext(context: any): string {
  const orgId = context?.headers?.['x-mcp-client'] || 
                context?.headers?.['X-MCP-Client'] ||
                context?.requestInfo?.headers?.['x-mcp-client'] ||
                context?.requestInfo?.headers?.['X-MCP-Client'] ||
                context?.organizationId;
  
  if (!orgId) {
    // Fallback to default organization ID for testing
    const defaultOrgId = 'ad82fce8-ba9a-438f-9fe2-956a86f479a5';
    console.log(`⚠️  Using fallback organization ID: ${defaultOrgId}`);
    return defaultOrgId;
  }
  
  return orgId;
}

// Helper function to check and prevent infinite loops
function checkToolCallLimit(sessionId: string): boolean {
  const now = Date.now();
  const tracker = toolCallTracker.get(sessionId);
  
  if (!tracker || now - tracker.lastCall > CALL_RESET_INTERVAL) {
    toolCallTracker.set(sessionId, { count: 1, lastCall: now });
    return true;
  }
  
  if (tracker.count >= MAX_CALLS_PER_SESSION) {
    console.warn(`⚠️  Tool call limit reached for session ${sessionId}`);
    return false;
  }
  
  tracker.count++;
  tracker.lastCall = now;
  return true;
}

// Helper function to get cached channel listing
async function getCachedChannels(client: WebClient, organizationId: string) {
  const cacheKey = `${organizationId}-channels`;
  const cached = channelCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_SHORT) {
    return cached.channels;
  }

  const result = await client.conversations.list({
    types: 'public_channel,private_channel',
    limit: 1000
  });

  const channels = result.channels || [];
  channelCache.set(cacheKey, { channels, timestamp: Date.now() });
  
  return channels;
}

// Helper function to get cached user listing
async function getCachedUsers(client: WebClient, organizationId: string) {
  const cacheKey = `${organizationId}-users`;
  const cached = userCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_SHORT) {
    return cached.users;
  }

  const result = await client.users.list({
    limit: 1000
  });

  const users = result.members || [];
  userCache.set(cacheKey, { users, timestamp: Date.now() });
  
  return users;
}

// Helper function to sanitize error messages
function sanitizeErrorMessage(error: any): string {
  if (error instanceof Error) {
    // Remove sensitive information from error messages
    const message = error.message;
    if (message.includes('xoxb-') || message.includes('token')) {
      return 'Authentication error occurred';
    }
    return message;
  }
  return 'Unknown error occurred';
}

// Define Slack MCP tools
console.log('🛠️  Registering Slack MCP tools...');

// Tool 1: List channels
server.tool('list_channels', 'List all channels in the Slack workspace. Use this to explore available channels before sending messages or searching.', {
  includePrivate: z.boolean().optional().describe('Include private channels (default: true)').default(true),
  includeArchived: z.boolean().optional().describe('Include archived channels (default: false)').default(false)
}, async ({ includePrivate, includeArchived }, context) => {
  try {
    const organizationId = getOrganizationIdFromContext(context);
    const sessionId = `${organizationId}-${Date.now()}`;
    
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

    console.log(`📋 Listing channels for organization: ${organizationId}`);
    
    const client = await getOrganizationSlackClient(organizationId);
    const channels = await getCachedChannels(client, organizationId);
    
    // Filter channels based on parameters
    let filteredChannels = channels;
    if (!includePrivate) {
      filteredChannels = channels.filter(channel => !channel.is_private);
    }
    if (!includeArchived) {
      filteredChannels = filteredChannels.filter(channel => !channel.is_archived);
    }

    const channelList = filteredChannels.map(channel => 
      `#${channel.name} (${channel.id}) - ${channel.is_private ? 'Private' : 'Public'}${channel.is_archived ? ' - Archived' : ''} - ${channel.num_members} members`
    ).join('\n');

    return {
      content: [
        {
          type: 'text',
          text: `Found ${filteredChannels.length} channels in your Slack workspace:\n\n${channelList}\n\n💡 Tip: Use send_message with a channel ID to send messages, or search_messages to find specific content.`
        }
      ]
    };
  } catch (error) {
    console.error(`❌ Error in list_channels: ${error}`);
    return {
      content: [
        {
          type: 'text',
          text: `Error listing channels: ${sanitizeErrorMessage(error)}`
        }
      ]
    };
  }
});

// Tool 2: List users
server.tool('list_users', 'List all users in the Slack workspace. Use this to find user IDs for direct messages or mentions.', {
  includeBots: z.boolean().optional().describe('Include bot users (default: false)').default(false),
  includeDeactivated: z.boolean().optional().describe('Include deactivated users (default: false)').default(false)
}, async ({ includeBots, includeDeactivated }, context) => {
  try {
    const organizationId = getOrganizationIdFromContext(context);
    const sessionId = `${organizationId}-${Date.now()}`;
    
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

    console.log(`👥 Listing users for organization: ${organizationId}`);
    
    const client = await getOrganizationSlackClient(organizationId);
    const users = await getCachedUsers(client, organizationId);
    
    // Filter users based on parameters
    let filteredUsers = users;
    if (!includeBots) {
      filteredUsers = users.filter(user => !user.is_bot);
    }
    if (!includeDeactivated) {
      filteredUsers = filteredUsers.filter(user => !user.deleted);
    }

    const userList = filteredUsers.map(user => 
      `@${user.name} (${user.id}) - ${user.real_name || 'No real name'}${user.is_bot ? ' - Bot' : ''}${user.deleted ? ' - Deactivated' : ''}`
    ).join('\n');

    return {
      content: [
        {
          type: 'text',
          text: `Found ${filteredUsers.length} users in your Slack workspace:\n\n${userList}\n\n💡 Tip: Use send_message with a user ID to send direct messages, or mention users with @username.`
        }
      ]
    };
  } catch (error) {
    console.error(`❌ Error in list_users: ${error}`);
    return {
      content: [
        {
          type: 'text',
          text: `Error listing users: ${sanitizeErrorMessage(error)}`
        }
      ]
    };
  }
});

// Tool 3: Send message
server.tool('send_message', 'Send a message to a Slack channel or user. Use channel IDs from list_channels or user IDs from list_users.', {
  channel: z.string().describe('Channel ID or user ID to send message to'),
  message: z.string().describe('Message text to send'),
  threadTs: z.string().optional().describe('Thread timestamp to reply to a specific message')
}, async ({ channel, message, threadTs }, context) => {
  try {
    const organizationId = getOrganizationIdFromContext(context);
    const sessionId = `${organizationId}-${Date.now()}`;
    
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
    if (!channel || !message) {
      throw new Error('Channel and message are required');
    }

    if (message.length > 4000) {
      throw new Error('Message too long (max 4000 characters)');
    }

    console.log(`💬 Sending message to ${channel} for organization: ${organizationId}`);
    
    const client = await getOrganizationSlackClient(organizationId);
    
    const result = await client.chat.postMessage({
      channel,
      text: message,
      thread_ts: threadTs
    });

    if (result.ok) {
      return {
        content: [
          {
            type: 'text',
            text: `✅ Message sent successfully to ${channel}!\n\nMessage: "${message}"\nTimestamp: ${result.ts}`
          }
        ]
      };
    } else {
      throw new Error(`Failed to send message: ${result.error}`);
    }
  } catch (error) {
    console.error(`❌ Error in send_message: ${error}`);
    return {
      content: [
        {
          type: 'text',
          text: `Error sending message: ${sanitizeErrorMessage(error)}`
        }
      ]
    };
  }
});

// Slack Tool 3: Search messages
server.tool('slack_search_messages', 'Search for messages in Slack channels. Use this to find specific conversations or information.', {
  query: z.string().describe('Search query to find messages'),
  channel: z.string().optional().describe('Specific channel ID to search in (optional)'),
  limit: z.number().optional().describe('Maximum number of results (default: 20)').default(20)
}, async ({ query, channel, limit }, context) => {
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

    const messageList = messages.map(msg => 
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

// Slack Tool 4: Get channel history
server.tool('slack_get_channel_history', 'Get recent messages from a specific Slack channel. Use this to see recent conversations.', {
  channel: z.string().describe('Channel ID to get history from'),
  limit: z.number().optional().describe('Maximum number of messages (default: 50)').default(50),
  oldest: z.string().optional().describe('Start time (Unix timestamp)'),
  latest: z.string().optional().describe('End time (Unix timestamp)')
}, async ({ channel, limit, oldest, latest }, context) => {
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

    const messageList = messages.map(msg => 
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

// Tool 6: Create channel
server.tool('create_channel', 'Create a new Slack channel. Use this to set up new discussion spaces.', {
  name: z.string().describe('Name of the channel to create (without #)'),
  isPrivate: z.boolean().optional().describe('Make the channel private (default: false)').default(false)
}, async ({ name, isPrivate }, context) => {
  try {
    const organizationId = getOrganizationIdFromContext(context);
    const sessionId = `${organizationId}-${Date.now()}`;
    
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

    console.log(`➕ Creating channel ${name} for organization: ${organizationId}`);
    
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
            text: `✅ Channel #${name} created successfully!\n\nChannel ID: ${result.channel?.id}\nPrivate: ${isPrivate ? 'Yes' : 'No'}\n\n💡 Tip: Use send_message to post the first message in the new channel.`
          }
        ]
      };
    } else {
      throw new Error(`Failed to create channel: ${result.error}`);
    }
  } catch (error) {
    console.error(`❌ Error in create_channel: ${error}`);
    return {
      content: [
        {
          type: 'text',
          text: `Error creating channel: ${sanitizeErrorMessage(error)}`
        }
      ]
    };
  }
});

// Slack Tool 5: Create channel
server.tool('slack_create_channel', 'Create a new Slack channel. Use this to set up new discussion spaces.', {
  name: z.string().describe('Name of the channel to create (without #)'),
  isPrivate: z.boolean().optional().describe('Make the channel private (default: false)').default(false)
}, async ({ name, isPrivate }, context) => {
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

// Tool 7: Invite users to channel
server.tool('invite_users_to_channel', 'Invite users to a Slack channel. Use this to add team members to discussions.', {
  channel: z.string().describe('Channel ID to invite users to'),
  users: z.string().describe('Comma-separated list of user IDs to invite')
}, async ({ channel, users }, context) => {
  try {
    const organizationId = getOrganizationIdFromContext(context);
    const sessionId = `${organizationId}-${Date.now()}`;
    
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

    console.log(`👥 Inviting users to channel ${channel} for organization: ${organizationId}`);
    
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
            text: `✅ Successfully invited ${userIds.length} user(s) to channel ${channel}!\n\nInvited users: ${userIds.join(', ')}`
          }
        ]
      };
    } else {
      throw new Error(`Failed to invite users: ${result.error}`);
    }
  } catch (error) {
    console.error(`❌ Error in invite_users_to_channel: ${error}`);
    return {
      content: [
        {
          type: 'text',
          text: `Error inviting users: ${sanitizeErrorMessage(error)}`
        }
      ]
    };
  }
});

// Slack Tool 6: Invite users to channel
server.tool('slack_invite_users_to_channel', 'Invite users to a Slack channel. Use this to add team members to discussions.', {
  channel: z.string().describe('Channel ID to invite users to'),
  users: z.string().describe('Comma-separated list of user IDs to invite')
}, async ({ channel, users }, context) => {
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

// Tool 8: Get workspace info
server.tool('get_workspace_info', 'Get information about the Slack workspace. Use this to understand the workspace structure.', {}, async (_, context) => {
  try {
    const organizationId = getOrganizationIdFromContext(context);
    const sessionId = `${organizationId}-${Date.now()}`;
    
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

    console.log(`🏢 Getting workspace info for organization: ${organizationId}`);
    
    const client = await getOrganizationSlackClient(organizationId);
    
    const [teamInfo, authTest] = await Promise.all([
      client.team.info(),
      client.auth.test()
    ]);

    const workspaceInfo = `
🏢 **Workspace Information**
Name: ${teamInfo.team?.name || 'Unknown'}
Domain: ${teamInfo.team?.domain || 'Unknown'}
Description: ${teamInfo.team?.description || 'No description'}
Created: ${teamInfo.team?.date_created ? new Date(parseInt(teamInfo.team.date_created) * 1000).toLocaleDateString() : 'Unknown'}

👤 **Current User**
Name: ${authTest.user || 'Unknown'}
Team: ${authTest.team || 'Unknown'}
User ID: ${authTest.user_id || 'Unknown'}

📊 **Workspace Stats**
Channels: ${teamInfo.team?.channels_count || 'Unknown'}
Users: ${teamInfo.team?.members_count || 'Unknown'}
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
    console.error(`❌ Error in get_workspace_info: ${error}`);
    return {
      content: [
        {
          type: 'text',
          text: `Error getting workspace info: ${sanitizeErrorMessage(error)}`
        }
      ]
    };
  }
});

// Slack Tool 7: Get workspace info
server.tool('slack_get_workspace_info', 'Get information about the Slack workspace. Use this to understand the workspace structure.', {}, async (_, context) => {
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

    // MCP endpoint
    app.get('/mcp', (req, res) => {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');

      const transport = new SSEServerTransport(req, res);
      server.connect(transport);
    });

    // Start the server
    app.listen(port, () => {
      console.log(`✅ Slack MCP Server running on port ${port}`);
      console.log(`🔗 MCP endpoint: http://localhost:${port}/mcp`);
      console.log(`💚 Health check: http://localhost:${port}/health`);
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