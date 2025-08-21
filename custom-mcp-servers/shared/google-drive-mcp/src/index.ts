import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { z } from 'zod';
import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';
import express from 'express';
import cors from 'cors';
import crypto from 'crypto';

console.log('🚀 Starting Google Drive MCP Server...');

// Supabase client for fetching organization configurations
let supabase: any;

async function initializeSupabase() {
  const { createClient } = await import('@supabase/supabase-js');
  supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
  );
  console.log('✅ Supabase client initialized');
}

// Encryption key for decrypting service account keys
const ENCRYPTION_KEY = process.env.MCP_ENCRYPTION_KEY || 'your-encryption-key-32-chars-long!';

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

// Helper function to decrypt service account key
function decryptServiceAccountKey(encryptedKey: string): string {
  const [ivHex, encrypted] = encryptedKey.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  
  const decipher = crypto.createDecipher('aes-256-cbc', ENCRYPTION_KEY);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

// Helper function to get organization-specific Google Drive client
async function getOrganizationDriveClient(organizationId: string) {
  try {
    console.log(`🔍 Fetching MCP config for organization: ${organizationId}`);
    
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
    const serviceAccountKey = decryptServiceAccountKey(
      mcpServer.auth_config.service_account_key
    );
    
    const credentials = JSON.parse(serviceAccountKey);
    const auth = new GoogleAuth({ credentials });
    
    return {
      drive: google.drive({ version: 'v3', auth }),
      folderId: 'root', // Use service account's own Drive for now
      organizationName: mcpServer.organization_id
    };
  } catch (error) {
    console.error(`❌ Error getting organization drive client: ${error}`);
    throw error;
  }
}

// Helper function to extract organization ID from request context
function getOrganizationIdFromContext(context: any): string {
  console.log('🔍 Debug: Context received:', JSON.stringify(context, null, 2));
  
  // Try to get from headers first (LibreChat sends this)
  // Check multiple possible locations where the header might be
  const orgId = context?.headers?.['x-mcp-client'] || 
                context?.headers?.['X-MCP-Client'] ||
                context?.requestInfo?.headers?.['x-mcp-client'] ||
                context?.requestInfo?.headers?.['X-MCP-Client'] ||
                context?.organizationId;
  
  console.log('🔍 Debug: Organization ID found:', orgId);
  
  if (!orgId) {
    console.error('❌ Debug: No organization ID found in context');
    console.error('❌ Debug: Available context keys:', Object.keys(context || {}));
    if (context?.headers) {
      console.error('❌ Debug: Available headers:', Object.keys(context.headers));
    }
    if (context?.requestInfo?.headers) {
      console.error('❌ Debug: Available requestInfo headers:', Object.keys(context.requestInfo.headers));
    }
    
    // Fallback to default organization ID for testing
    const defaultOrgId = 'ad82fce8-ba9a-438f-9fe2-956a86f479a5';
    console.log(`⚠️  Using fallback organization ID: ${defaultOrgId}`);
    return defaultOrgId;
  }
  
  return orgId;
}

// Define tools using the official pattern
console.log('🛠️  Registering MCP tools...');

server.tool('search_file', 'Search for files in Google Drive by name, content, or metadata', {
  query: z.string().describe('Search query for files'),
  fileType: z.string().optional().describe('Optional file type filter (e.g., "pdf", "doc", "image")')
}, async ({ query, fileType }, context) => {
  try {
    const organizationId = getOrganizationIdFromContext(context);
    console.log(`🔍 Searching files for organization: ${organizationId}`);
    
    const { drive, folderId } = await getOrganizationDriveClient(organizationId);
    
    let searchQuery = `'${folderId}' in parents and fullText contains '${query}'`;
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
          text: `Found ${response.data.files?.length || 0} files matching "${query}" in your Google Drive:\n\n${
            response.data.files?.map(file => 
              `- ${file.name} (${file.id}) - ${file.mimeType}`
            ).join('\n') || 'No files found'
          }`
        }
      ]
    };
  } catch (error) {
    console.error(`❌ Error in search_file: ${error}`);
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
  folderId: z.string().optional().describe('Folder ID to list contents (default: organization folder)'),
  pageSize: z.number().optional().describe('Number of items per page').default(50)
}, async ({ folderId, pageSize = 50 }, context) => {
  try {
    const organizationId = getOrganizationIdFromContext(context);
    console.log(`📁 Listing files for organization: ${organizationId}`);
    
    const { drive, folderId: orgFolderId } = await getOrganizationDriveClient(organizationId);
    
    // Use provided folderId or default to organization folder
    const targetFolderId = folderId || orgFolderId;

    const response = await drive.files.list({
      q: `'${targetFolderId}' in parents and trashed=false`,
      fields: 'files(id,name,mimeType,size,modifiedTime)',
      pageSize
    });

    return {
      content: [
        {
          type: 'text',
          text: `Files in your Google Drive folder:\n\n${
            response.data.files?.map(file => 
              `- ${file.name} (${file.id}) - ${file.mimeType}`
            ).join('\n') || 'No files found'
          }`
        }
      ]
    };
  } catch (error) {
    console.error(`❌ Error in list_files: ${error}`);
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
  fileId: z.string().describe('Google Drive file ID')
}, async ({ fileId }, context) => {
  try {
    const organizationId = getOrganizationIdFromContext(context);
    console.log(`📄 Getting metadata for file ${fileId} in organization: ${organizationId}`);
    
    const { drive } = await getOrganizationDriveClient(organizationId);

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
    console.error(`❌ Error in get_file_metadata: ${error}`);
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
  format: z.string().optional().describe('Content format (text, html, etc.)').default('text')
}, async ({ fileId, format = 'text' }, context) => {
  try {
    const organizationId = getOrganizationIdFromContext(context);
    console.log(`📖 Reading content for file ${fileId} in organization: ${organizationId}`);
    
    const { drive } = await getOrganizationDriveClient(organizationId);

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
    console.error(`❌ Error in read_content: ${error}`);
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
    version: '2.0.0',
    auth_type: 'organization-based'
  });
});

// Test endpoint
app.get('/test', (req, res) => {
  res.json({ 
    message: 'Google Drive MCP Server is running!',
    tools: ['search_file', 'list_files', 'get_file_metadata', 'read_content'],
    timestamp: new Date().toISOString(),
    auth_type: 'organization-based',
    organization_id_source: 'X-MCP-Client header (automatically provided by LibreChat)',
    note: 'Organization ID is automatically extracted from request headers'
  });
});

// Organization configuration endpoint
app.get('/config/:organizationId', async (req, res) => {
  try {
    const { organizationId } = req.params;
    
    const { data: mcpServer, error } = await supabase
      .from('mcp_servers')
      .select('name, auth_type, google_drive_folder_id, is_active')
      .eq('organization_id', organizationId)
      .eq('name', 'Google Drive')
      .eq('is_active', true)
      .single();

    if (error || !mcpServer) {
      return res.status(404).json({
        error: 'Google Drive not configured for this organization',
        organizationId
      });
    }

    res.json({
      organizationId,
      configured: true,
      auth_type: mcpServer.auth_type,
      folder_id: mcpServer.google_drive_folder_id,
      is_active: mcpServer.is_active
    });
  } catch (error) {
    console.error('Error checking organization config:', error);
    res.status(500).json({
      error: 'Failed to check organization configuration',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
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
  
  // Initialize Supabase client
  await initializeSupabase();
  
  try {
    app.listen(port, () => {
      console.log(`🎉 Google Drive MCP Server running on port ${port}`);
      console.log(`🔗 Health check: http://localhost:${port}/health`);
      console.log(`🧪 Test endpoint: http://localhost:${port}/test`);
      console.log(`📡 MCP endpoint: http://localhost:${port}/mcp`);
      console.log(`📨 Messages endpoint: http://localhost:${port}/messages`);
      console.log(`🔐 Auth type: Organization-based service account`);
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