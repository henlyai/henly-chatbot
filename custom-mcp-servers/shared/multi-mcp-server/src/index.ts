import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { z } from 'zod';
import { WebClient } from '@slack/web-api';
import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';
import express from 'express';
import cors from 'cors';
import crypto from 'crypto';

console.log('🚀 Starting Multi-MCP Server (Google Drive + Slack)...');

// Supabase client for fetching organization configurations
let supabase: any;

// Cache for organization clients to avoid repeated authentication
const slackClientCache = new Map<string, { client: WebClient; lastUsed: number }>();
const driveClientCache = new Map<string, { drive: any; folderId: string; lastUsed: number }>();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// Cache for data listings to reduce API calls
const channelCache = new Map<string, { channels: any[]; timestamp: number }>();
const userCache = new Map<string, { users: any[]; timestamp: number }>();
const fileListingCache = new Map<string, { files: any[]; timestamp: number }>();
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

// Encryption key for decrypting tokens
const ENCRYPTION_KEY = process.env.MCP_ENCRYPTION_KEY || 'your-encryption-key-32-chars-long!';

// Create a single MCP server instance
console.log('🔧 Creating Multi-MCP server instance...');
const server = new McpServer(
  {
    name: 'multi-mcp-server',
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

// Helper function to decrypt tokens (SECURE VERSION)
function decryptToken(encryptedToken: string): string {
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
    console.error('❌ Error decrypting token:', error);
    throw new Error('Failed to decrypt token');
  }
}

// Helper function to encrypt tokens (SECURE VERSION)
function encryptToken(token: string): string {
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
    console.error('❌ Error encrypting token:', error);
    throw new Error('Failed to encrypt token');
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
    const slackToken = decryptToken(mcpServer.auth_config.slack_token);
    
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

// Helper function to get organization-specific Google Drive client with caching
async function getOrganizationDriveClient(organizationId: string) {
  try {
    // Check cache first
    const cached = driveClientCache.get(organizationId);
    if (cached && Date.now() - cached.lastUsed < CACHE_TTL) {
      cached.lastUsed = Date.now();
      return cached;
    }

    console.log(`🔍 Fetching Google Drive config for organization: ${organizationId}`);
    
    // Get MCP server configuration from Supabase
    const { data: mcpServer, error } = await supabase
      .from('mcp_servers')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('name', 'Google Drive')
      .eq('is_active', true)
      .single();

    if (error || !mcpServer) {
      throw new Error(`Google Drive not configured for organization ${organizationId}`);
    }

    if (mcpServer.auth_type !== 'service_account') {
      throw new Error(`Google Drive authentication not set up for organization ${organizationId}`);
    }

    // Decrypt service account key
    const serviceAccountKey = decryptToken(
      mcpServer.auth_config.service_account_key
    );
    
    const credentials = JSON.parse(serviceAccountKey);
    const auth = new GoogleAuth({ 
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive.readonly']
    });
    
    const driveClient = {
      drive: google.drive({ version: 'v3', auth }),
      folderId: mcpServer.google_drive_folder_id || 'root',
      organizationName: mcpServer.organization_id,
      lastUsed: Date.now()
    };

    // Cache the client
    driveClientCache.set(organizationId, driveClient);
    
    return driveClient;
  } catch (error) {
    console.error(`❌ Error getting organization drive client: ${error}`);
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
    // SECURITY FIX: No fallback to default organization ID
    // This was a critical security vulnerability
    throw new Error('Organization ID is required but not provided in request context');
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

// ============================================================================
// SLACK MCP TOOLS
// ============================================================================

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

// Slack Tool 1: List channels
server.tool('slack_list_channels', 'List all channels in the Slack workspace. Use this to explore available channels before sending messages or searching.', {
  includePrivate: z.boolean().optional().describe('Include private channels (default: true)').default(true),
  includeArchived: z.boolean().optional().describe('Include archived channels (default: false)').default(false)
}, async ({ includePrivate, includeArchived }, context) => {
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
          text: `Found ${filteredChannels.length} channels in your Slack workspace:\n\n${channelList}\n\n💡 Tip: Use slack_send_message with a channel ID to send messages, or slack_search_messages to find specific content.`
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

// Slack Tool 2: Send message
server.tool('slack_send_message', 'Send a message to a Slack channel or user. Use channel IDs from slack_list_channels or user IDs from slack_list_users.', {
  channel: z.string().describe('Channel ID or user ID to send message to'),
  message: z.string().describe('Message text to send'),
  threadTs: z.string().optional().describe('Thread timestamp to reply to a specific message')
}, async ({ channel, message, threadTs }, context) => {
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
    if (!channel || !message) {
      throw new Error('Channel and message are required');
    }

    if (message.length > 4000) {
      throw new Error('Message too long (max 4000 characters)');
    }

    console.log(`💬 Sending Slack message to ${channel} for organization: ${organizationId}`);
    
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
            text: `✅ Slack message sent successfully to ${channel}!\n\nMessage: "${message}"\nTimestamp: ${result.ts}`
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
    
    const result = await client.search.messages({
      query,
      channel,
      count: limit
    });

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

// ============================================================================
// GOOGLE DRIVE MCP TOOLS
// ============================================================================

// Helper function to get cached file listing
async function getCachedFileListing(cacheKey: string, drive: any, folderId: string, pageSize: number) {
  const cached = fileListingCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_SHORT) {
    return cached.files;
  }

  const response = await drive.files.list({
    q: `'${folderId}' in parents and trashed=false`,
    fields: 'files(id,name,mimeType,size,modifiedTime,parents)',
    pageSize,
    orderBy: 'modifiedTime desc'
  });

  const files = response.data.files || [];
  fileListingCache.set(cacheKey, { files, timestamp: Date.now() });
  
  return files;
}

// Google Drive Tool 1: Search files
server.tool('google_drive_search_files', 'Search for files in Google Drive by name, content, or metadata. Use this to find relevant documents before reading them.', {
  query: z.string().describe('Search query for files (e.g., "revenue", "Q1", "support tickets")'),
  fileType: z.string().optional().describe('Optional file type filter (e.g., "pdf", "doc", "spreadsheet")')
}, async ({ query, fileType }, context) => {
  try {
    const organizationId = getOrganizationIdFromContext(context);
    const sessionId = `${organizationId}-drive-search-${Date.now()}`;
    
    if (!checkToolCallLimit(sessionId)) {
      return {
        content: [
          {
            type: 'text',
            text: 'Too many search requests. Please wait a moment before trying again.'
          }
        ]
      };
    }

    console.log(`🔍 Searching Google Drive files for organization: ${organizationId} with query: "${query}"`);
    
    const { drive, folderId } = await getOrganizationDriveClient(organizationId);
    
    let searchQuery = `'${folderId}' in parents and fullText contains '${query}'`;
    if (fileType) {
      searchQuery += ` and mimeType contains '${fileType}'`;
    }

    const response = await drive.files.list({
      q: searchQuery,
      fields: 'files(id,name,mimeType,size,modifiedTime,parents)',
      pageSize: 20,
      orderBy: 'modifiedTime desc'
    });

    const files = response.data.files || [];
    
    if (files.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: `No Google Drive files found matching "${query}".`
          }
        ]
      };
    }

    const fileList = files.map(file => 
      `📄 ${file.name} (${file.id}) - ${file.mimeType} - Modified: ${new Date(file.modifiedTime).toLocaleDateString()}`
    ).join('\n');

    return {
      content: [
        {
          type: 'text',
          text: `Found ${files.length} Google Drive files matching "${query}":\n\n${fileList}\n\n💡 Tip: Use google_drive_get_file_metadata with a file ID to get more details, then google_drive_read_content to view the file.`
        }
      ]
    };
  } catch (error) {
    console.error(`❌ Error in google_drive_search_files: ${error}`);
    return {
      content: [
        {
          type: 'text',
          text: `Error searching Google Drive files: ${sanitizeErrorMessage(error)}`
        }
      ]
    };
  }
});

// Google Drive Tool 2: List files
server.tool('google_drive_list_files', 'List files and folders in Google Drive. Use this to explore the folder structure and find relevant documents.', {
  folderId: z.string().optional().describe('Folder ID to list contents (default: organization folder)'),
  pageSize: z.number().optional().describe('Number of items per page').default(20)
}, async ({ folderId, pageSize = 20 }, context) => {
  try {
    const organizationId = getOrganizationIdFromContext(context);
    const sessionId = `${organizationId}-drive-list-${Date.now()}`;
    
    if (!checkToolCallLimit(sessionId)) {
      return {
        content: [
          {
            type: 'text',
            text: 'Too many listing requests. Please wait a moment before trying again.'
          }
        ]
      };
    }

    console.log(`📁 Listing Google Drive files for organization: ${organizationId}`);
    
    const { drive, folderId: orgFolderId } = await getOrganizationDriveClient(organizationId);
    
    // Use provided folderId or default to organization folder
    const targetFolderId = folderId || orgFolderId;
    const cacheKey = `${organizationId}-${targetFolderId}-${pageSize}`;
    
    const files = await getCachedFileListing(cacheKey, drive, targetFolderId, pageSize);
    
    if (files.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: `No files found in Google Drive folder ${targetFolderId}.`
          }
        ]
      };
    }

    const fileList = files.map(file => 
      `📄 ${file.name} (${file.id}) - ${file.mimeType} - Modified: ${new Date(file.modifiedTime).toLocaleDateString()}`
    ).join('\n');

    return {
      content: [
        {
          type: 'text',
          text: `Found ${files.length} files in Google Drive:\n\n${fileList}\n\n💡 Tip: Use google_drive_get_file_metadata with a file ID to get more details.`
        }
      ]
    };
  } catch (error) {
    console.error(`❌ Error in google_drive_list_files: ${error}`);
    return {
      content: [
        {
          type: 'text',
          text: `Error listing Google Drive files: ${sanitizeErrorMessage(error)}`
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
    const port = process.env.PORT || 3001;

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
        service: 'multi-mcp-server',
        version: '1.0.0',
        capabilities: ['google-drive', 'slack'],
        auth_type: 'organization-based'
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
      console.log(`✅ Multi-MCP Server running on port ${port}`);
      console.log(`🔗 MCP endpoint: http://localhost:${port}/mcp`);
      console.log(`💚 Health check: http://localhost:${port}/health`);
      console.log(`🛠️  Available MCPs: Google Drive, Slack`);
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