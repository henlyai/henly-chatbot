import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { z } from 'zod';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import express from 'express';
import cors from 'cors';
import crypto from 'crypto';

console.log('🚀 Starting Google Drive MCP Server...');

// In-memory token storage (in production, use Redis or database)
const tokenStore: Record<string, {
  access_token: string;
  refresh_token: string;
  expiry_date: number;
  scope: string;
}> = {};

// Initialize Google APIs
console.log('📡 Initializing Google OAuth client...');
const oauth2Client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI || 'https://mcp-servers-production-c189.up.railway.app/oauth/callback'
);

console.log('✅ Google APIs initialized');

// Create a single MCP server instance
console.log('🔧 Creating MCP server instance...');
const server = new McpServer(
  {
    name: 'google-drive-mcp-server',
    version: '2.0.0'
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

// Helper function to get authenticated OAuth client for a user
function getAuthenticatedClient(userId: string): OAuth2Client | null {
  const tokens = tokenStore[userId];
  if (!tokens) {
    return null;
  }

  // Check if token is expired
  if (Date.now() >= tokens.expiry_date) {
    console.log(`🔄 Token expired for user ${userId}, attempting refresh...`);
    // In a real implementation, you'd refresh the token here
    // For now, we'll return null to trigger re-authentication
    return null;
  }

  const client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  client.setCredentials(tokens);
  return client;
}

// Helper function to check authentication and return appropriate response
function checkAuthentication(userId: string): { authenticated: boolean; errorMessage?: string } {
  const client = getAuthenticatedClient(userId);
  if (!client) {
    return {
      authenticated: false,
      errorMessage: `I don't have access to your Google Drive at the moment. Please authenticate by visiting: https://mcp-servers-production-c189.up.railway.app/oauth/initiate?userId=${userId}`
    };
  }
  return { authenticated: true };
}

// Define tools using the official pattern
console.log('🛠️  Registering MCP tools...');

server.tool('search_file', 'Search for files in Google Drive by name, content, or metadata', {
  query: z.string().describe('Search query for files'),
  fileType: z.string().optional().describe('Optional file type filter (e.g., "pdf", "doc", "image")'),
  userId: z.string().describe('User ID for authentication')
}, async ({ query, fileType, userId }) => {
  try {
    // Check authentication
    const authCheck = checkAuthentication(userId);
    if (!authCheck.authenticated) {
      return {
        content: [
          {
            type: 'text',
            text: authCheck.errorMessage!
          }
        ]
      };
    }

    const client = getAuthenticatedClient(userId)!;
    const drive = google.drive({ version: 'v3', auth: client });

    let searchQuery = `fullText contains '${query}'`;
    if (fileType) {
      searchQuery += ` and mimeType contains '${fileType}'`;
    }

    const response = await drive.files.list({
      q: searchQuery,
      fields: 'files(id,name,mimeType,size,modifiedTime)',
      pageSize: 10
    });

    return {
      content: [
        {
          type: 'text',
          text: `Found ${response.data.files?.length || 0} files matching "${query}":\n\n${
            response.data.files?.map(file => 
              `- ${file.name} (${file.id}) - ${file.mimeType}`
            ).join('\n') || 'No files found'
          }`
        }
      ]
    };
  } catch (error) {
    console.error('Error in search_file:', error);
    return {
      content: [
        {
          type: 'text',
          text: `Error searching files: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      ]
    };
  }
});

server.tool('list_files', 'List files and folders in Google Drive', {
  folderId: z.string().optional().describe('Folder ID to list contents (default: root)'),
  pageSize: z.number().optional().describe('Number of items per page').default(50),
  userId: z.string().describe('User ID for authentication')
}, async ({ folderId = 'root', pageSize = 50, userId }) => {
  try {
    // Check authentication
    const authCheck = checkAuthentication(userId);
    if (!authCheck.authenticated) {
      return {
        content: [
          {
            type: 'text',
            text: authCheck.errorMessage!
          }
        ]
      };
    }

    const client = getAuthenticatedClient(userId)!;
    const drive = google.drive({ version: 'v3', auth: client });

    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      fields: 'files(id,name,mimeType,size,modifiedTime)',
      pageSize
    });

    return {
      content: [
        {
          type: 'text',
          text: `Files in folder ${folderId}:\n\n${
            response.data.files?.map(file => 
              `- ${file.name} (${file.id}) - ${file.mimeType}`
            ).join('\n') || 'No files found'
          }`
        }
      ]
    };
  } catch (error) {
    console.error('Error in list_files:', error);
    return {
      content: [
        {
          type: 'text',
          text: `Error listing files: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      ]
    };
  }
});

server.tool('get_file_metadata', 'Get detailed metadata for a file', {
  fileId: z.string().describe('Google Drive file ID'),
  userId: z.string().describe('User ID for authentication')
}, async ({ fileId, userId }) => {
  try {
    // Check authentication
    const authCheck = checkAuthentication(userId);
    if (!authCheck.authenticated) {
      return {
        content: [
          {
            type: 'text',
            text: authCheck.errorMessage!
          }
        ]
      };
    }

    const client = getAuthenticatedClient(userId)!;
    const drive = google.drive({ version: 'v3', auth: client });

    const response = await drive.files.get({
      fileId,
      fields: 'id,name,mimeType,size,modifiedTime,createdTime,parents,webViewLink'
    });

    return {
      content: [
        {
          type: 'text',
          text: `File metadata for ${fileId}:\n\n` +
                `Name: ${response.data.name}\n` +
                `Type: ${response.data.mimeType}\n` +
                `Size: ${response.data.size} bytes\n` +
                `Created: ${response.data.createdTime}\n` +
                `Modified: ${response.data.modifiedTime}\n` +
                `View Link: ${response.data.webViewLink}`
        }
      ]
    };
  } catch (error) {
    console.error('Error in get_file_metadata:', error);
    return {
      content: [
        {
          type: 'text',
          text: `Error getting file metadata: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      ]
    };
  }
});

server.tool('read_content', 'Read the content of a file from Google Drive', {
  fileId: z.string().describe('Google Drive file ID'),
  format: z.string().optional().describe('Content format (text, html, etc.)').default('text'),
  userId: z.string().describe('User ID for authentication')
}, async ({ fileId, format = 'text', userId }) => {
  try {
    // Check authentication
    const authCheck = checkAuthentication(userId);
    if (!authCheck.authenticated) {
      return {
        content: [
          {
            type: 'text',
            text: authCheck.errorMessage!
          }
        ]
      };
    }

    const client = getAuthenticatedClient(userId)!;
    const drive = google.drive({ version: 'v3', auth: client });

    const response = await drive.files.get({
      fileId,
      alt: 'media'
    });

    return {
      content: [
        {
          type: 'text',
          text: `File content (${format}):\n\n${response.data}`
        }
      ]
    };
  } catch (error) {
    console.error('Error in read_content:', error);
    return {
      content: [
        {
          type: 'text',
          text: `Error reading file content: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      ]
    };
  }
});

console.log('✅ MCP tools registered');

// Express app setup
console.log('🌐 Setting up Express app...');
const app = express();
app.use(cors());
app.use(express.json());

// Store transports by session ID
const transports: Record<string, SSEServerTransport> = {};

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'google-drive-mcp-server',
    version: '2.0.0'
  });
});

// Test endpoint
app.get('/test', (req, res) => {
  res.json({ 
    message: 'Google Drive MCP Server is running!',
    tools: ['search_file', 'list_files', 'get_file_metadata', 'read_content'],
    timestamp: new Date().toISOString(),
    oauth_configured: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
  });
});

// OAuth initiation endpoint
app.get('/oauth/initiate', (req, res) => {
  const { userId } = req.query;
  
  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ 
      error: 'User ID required',
      message: 'Please provide a userId parameter'
    });
  }

  // Generate OAuth state to prevent CSRF attacks
  const state = crypto.randomBytes(32).toString('hex');
  
  // Store state temporarily (in production, use Redis with expiration)
  // For now, we'll use a simple in-memory store
  const stateStore: Record<string, { userId: string; timestamp: number }> = {};
  stateStore[state] = { userId, timestamp: Date.now() };

  // Generate OAuth URL
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/drive.file'
    ],
    state: state,
    prompt: 'consent' // Force consent to get refresh token
  });

  res.json({
    auth_url: authUrl,
    state: state,
    message: 'Please visit the auth_url to authenticate with Google Drive'
  });
});

// OAuth callback endpoint
app.get('/oauth/callback', async (req, res) => {
  const { code, state } = req.query;
  
  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'Authorization code required' });
  }

  if (!state || typeof state !== 'string') {
    return res.status(400).json({ error: 'State parameter required' });
  }

  try {
    // Verify state (in production, check against stored state)
    // For now, we'll assume it's valid
    
    const { tokens } = await oauth2Client.getToken(code);
    
    // Extract userId from state (in production, use proper state management)
    // For now, we'll use a simple approach
    const userId = state; // In production, decode userId from state
    
    // Store tokens
    tokenStore[userId] = {
      access_token: tokens.access_token!,
      refresh_token: tokens.refresh_token!,
      expiry_date: tokens.expiry_date!,
      scope: tokens.scope!
    };
    
    console.log(`✅ OAuth successful for user ${userId}`);
    
    res.json({
      status: 'success',
      message: 'OAuth authentication successful! You can now use Google Drive tools.',
      userId: userId
    });
  } catch (error) {
    console.error('OAuth error:', error);
    res.status(500).json({
      error: 'OAuth authentication failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Check authentication status endpoint
app.get('/oauth/status/:userId', (req, res) => {
  const { userId } = req.params;
  
  const tokens = tokenStore[userId];
  if (!tokens) {
    return res.json({
      authenticated: false,
      message: 'Not authenticated'
    });
  }

  const isExpired = Date.now() >= tokens.expiry_date;
  
  res.json({
    authenticated: !isExpired,
    expired: isExpired,
    message: isExpired ? 'Token expired' : 'Authenticated'
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

console.log('✅ Express app setup complete');

// Start the server
async function start() {
  const port = process.env.PORT || 3001;
  
  console.log(`🚀 Starting server on port ${port}...`);
  
  try {
    app.listen(port, () => {
      console.log(`🎉 Google Drive MCP Server running on port ${port}`);
      console.log(`🔗 Health check: http://localhost:${port}/health`);
      console.log(`🧪 Test endpoint: http://localhost:${port}/test`);
      console.log(`🔐 OAuth initiate: http://localhost:${port}/oauth/initiate`);
      console.log(`🔐 OAuth callback: http://localhost:${port}/oauth/callback`);
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

console.log('🚀 Starting application...');
start().catch((error) => {
  console.error('❌ Failed to start application:', error);
  process.exit(1);
}); 