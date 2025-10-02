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

// Cache for organization drive clients to avoid repeated authentication
const driveClientCache = new Map<string, { drive: any; folderId: string; lastUsed: number }>();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// Cache for file listings to reduce API calls
const fileListingCache = new Map<string, { files: any[]; timestamp: number }>();
const FILE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

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

// Encryption key for decrypting service account keys
const ENCRYPTION_KEY = process.env.MCP_ENCRYPTION_KEY || 'your-encryption-key-32-chars-long!';

// Create a single MCP server instance
console.log('🔧 Creating MCP server instance...');
const server = new McpServer(
  {
    name: 'google-drive-mcp-server',
    version: '2.1.0'
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

// Helper function to get organization-specific Google Drive client with caching
async function getOrganizationDriveClient(organizationId: string) {
  try {
    // Check cache first
    const cached = driveClientCache.get(organizationId);
    if (cached && Date.now() - cached.lastUsed < CACHE_TTL) {
      cached.lastUsed = Date.now();
      return cached;
    }

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

// Helper function to get cached file listing
async function getCachedFileListing(cacheKey: string, drive: any, folderId: string, pageSize: number) {
  const cached = fileListingCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < FILE_CACHE_TTL) {
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

// Helper function to find relevant files based on query
function findRelevantFiles(files: any[], query: string): any[] {
  const queryLower = query.toLowerCase();
  const relevantFiles = [];
  
  for (const file of files) {
    const nameLower = file.name.toLowerCase();
    const isRelevant = 
      nameLower.includes(queryLower) ||
      nameLower.includes('revenue') ||
      nameLower.includes('q1') ||
      nameLower.includes('support') ||
      nameLower.includes('ticket') ||
      nameLower.includes('product') ||
      nameLower.includes('roadmap') ||
      nameLower.includes('performance') ||
      nameLower.includes('analysis') ||
      nameLower.includes('report');
    
    if (isRelevant) {
      relevantFiles.push(file);
    }
  }
  
  return relevantFiles.slice(0, 10); // Limit to top 10 most relevant
}

// Define tools using the official pattern with improved performance
console.log('🛠️  Registering MCP tools...');

server.tool('search_file', 'Search for files in Google Drive by name, content, or metadata. Use this to find relevant documents before reading them.', {
  query: z.string().describe('Search query for files (e.g., "revenue", "Q1", "support tickets")'),
  fileType: z.string().optional().describe('Optional file type filter (e.g., "pdf", "doc", "spreadsheet")')
}, async ({ query, fileType }, context) => {
  try {
    const organizationId = getOrganizationIdFromContext(context);
    const sessionId = `${organizationId}-${Date.now()}`;
    
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

    console.log(`🔍 Searching files for organization: ${organizationId} with query: "${query}"`);
    
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
    const relevantFiles = findRelevantFiles(files, query);

    return {
      content: [
        {
          type: 'text',
          text: `Found ${files.length} files matching "${query}" in your Google Drive.\n\n` +
                `Most relevant files:\n\n${
                  relevantFiles.map(file => 
                    `📄 ${file.name} (${file.id}) - ${file.mimeType} - Modified: ${new Date(file.modifiedTime).toLocaleDateString()}`
                  ).join('\n') || 'No relevant files found'
                }\n\n` +
                `💡 Tip: Use get_file_metadata with a file ID to get more details, then read_content to view the file.`
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

server.tool('list_files', 'List files and folders in Google Drive. Use this to explore the folder structure and find relevant documents.', {
  folderId: z.string().optional().describe('Folder ID to list contents (default: organization folder)'),
  pageSize: z.number().optional().describe('Number of items per page').default(20)
}, async ({ folderId, pageSize = 20 }, context) => {
  try {
    const organizationId = getOrganizationIdFromContext(context);
    const sessionId = `${organizationId}-${Date.now()}`;
    
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

    console.log(`📁 Listing files for organization: ${organizationId}`);
    
    const { drive, folderId: orgFolderId } = await getOrganizationDriveClient(organizationId);
    
    // Use provided folderId or default to organization folder
    const targetFolderId = folderId || orgFolderId;
    const cacheKey = `${organizationId}-${targetFolderId}-${pageSize}`;

    const files = await getCachedFileListing(cacheKey, drive, targetFolderId, pageSize);

    // Group files by type for better organization
    const folders = files.filter((f: any) => f.mimeType === 'application/vnd.google-apps.folder');
    const documents = files.filter((f: any) => f.mimeType.includes('document') || f.mimeType.includes('spreadsheet'));
    const otherFiles = files.filter((f: any) => !f.mimeType.includes('folder') && !f.mimeType.includes('document') && !f.mimeType.includes('spreadsheet'));

    return {
      content: [
        {
          type: 'text',
          text: `📁 Files in your Google Drive folder:\n\n` +
                                 `📂 Folders (${folders.length}):\n${
                   folders.map((file: any) => 
                     `  📁 ${file.name} (${file.id})`
                   ).join('\n') || '  No folders'
                 }\n\n` +
                 `📄 Documents & Spreadsheets (${documents.length}):\n${
                   documents.map((file: any) => 
                     `  📄 ${file.name} (${file.id}) - Modified: ${new Date(file.modifiedTime).toLocaleDateString()}`
                   ).join('\n') || '  No documents'
                 }\n\n` +
                 `📎 Other Files (${otherFiles.length}):\n${
                   otherFiles.map((file: any) => 
                     `  📎 ${file.name} (${file.id}) - ${file.mimeType}`
                   ).join('\n') || '  No other files'
                 }\n\n` +
                `💡 Tip: Use search_file to find specific content, or get_file_metadata to get details about a specific file.`
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

server.tool('get_file_metadata', 'Get detailed metadata for a file. Use this to understand what a file contains before reading it.', {
  fileId: z.string().describe('Google Drive file ID')
}, async ({ fileId }, context) => {
  try {
    const organizationId = getOrganizationIdFromContext(context);
    const sessionId = `${organizationId}-${Date.now()}`;
    
    if (!checkToolCallLimit(sessionId)) {
      return {
        content: [
          {
            type: 'text',
            text: 'Too many metadata requests. Please wait a moment before trying again.'
          }
        ]
      };
    }

    console.log(`📄 Getting metadata for file ${fileId} in organization: ${organizationId}`);
    
    const { drive } = await getOrganizationDriveClient(organizationId);

    const response = await drive.files.get({
      fileId,
      fields: 'id,name,mimeType,size,modifiedTime,createdTime,parents,webViewLink,description'
    });

    const file = response.data;
    const sizeInMB = file.size ? (parseInt(file.size) / (1024 * 1024)).toFixed(2) : 'Unknown';

    // Determine if file can be read directly
    let readabilityInfo = '';
    let fileTypeDescription = '';
    
    if (file.mimeType === 'application/vnd.google-apps.document') {
      readabilityInfo = '✅ Can be read directly (Google Doc)';
      fileTypeDescription = 'Google Doc';
    } else if (file.mimeType === 'application/vnd.google-apps.spreadsheet') {
      readabilityInfo = '✅ Can be read directly (Google Sheet)';
      fileTypeDescription = 'Google Sheet';
    } else if (file.mimeType.startsWith('text/') || file.mimeType === 'application/json') {
      readabilityInfo = '✅ Can be read directly (Text file)';
      fileTypeDescription = 'Text File';
    } else if (file.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      readabilityInfo = '⚠️  Cannot read directly (Word .docx) - Use web link to view';
      fileTypeDescription = 'Microsoft Word Document';
    } else if (file.mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
      readabilityInfo = '⚠️  Cannot read directly (Excel .xlsx) - Use web link to view';
      fileTypeDescription = 'Microsoft Excel Spreadsheet';
    } else {
      readabilityInfo = '⚠️  Cannot read directly - Use web link to view';
      fileTypeDescription = file.mimeType;
    }

    return {
      content: [
        {
          type: 'text',
          text: `📄 File Details: ${file.name}\n\n` +
                `📋 ID: ${file.id}\n` +
                `📁 Type: ${fileTypeDescription}\n` +
                `📏 Size: ${sizeInMB} MB\n` +
                `📅 Created: ${new Date(file.createdTime).toLocaleString()}\n` +
                `🔄 Modified: ${new Date(file.modifiedTime).toLocaleString()}\n` +
                `🔗 View: ${file.webViewLink}\n` +
                (file.description ? `📝 Description: ${file.description}\n` : '') +
                `\n📖 Readability: ${readabilityInfo}\n` +
                `💡 Tip: Use read_content for readable files, or click the web link for others.`
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

server.tool('read_content', 'Read the content of a file from Google Drive. Use this after finding relevant files with search_file or list_files.', {
  fileId: z.string().describe('Google Drive file ID'),
  format: z.string().optional().describe('Content format (text, html, etc.)').default('text')
}, async ({ fileId, format = 'text' }, context) => {
  try {
    const organizationId = getOrganizationIdFromContext(context);
    const sessionId = `${organizationId}-${Date.now()}`;
    
    if (!checkToolCallLimit(sessionId)) {
      return {
        content: [
          {
            type: 'text',
            text: 'Too many content reading requests. Please wait a moment before trying again.'
          }
        ]
      };
    }

    console.log(`📖 Reading content for file ${fileId} in organization: ${organizationId}`);
    
    const { drive } = await getOrganizationDriveClient(organizationId);

    // First get metadata to check file type and size
    const metadata = await drive.files.get({
      fileId,
      fields: 'name,mimeType,size'
    });

    const file = metadata.data;
    const sizeInMB = file.size ? parseInt(file.size) / (1024 * 1024) : 0;

    // Prevent reading very large files
    if (sizeInMB > 10) {
      return {
        content: [
          {
            type: 'text',
            text: `⚠️  File "${file.name}" is too large (${sizeInMB.toFixed(2)} MB) to read directly. ` +
                  `Please use get_file_metadata to view file details and access it via the web link.`
          }
        ]
      };
    }

    // Handle different file types appropriately
    let content = '';
    let fileType = 'unknown';
    
    if (file.mimeType === 'application/vnd.google-apps.document') {
      // Google Docs - export as text
      try {
        console.log(`📄 Attempting to export Google Doc: ${file.name}`);
        const response = await drive.files.export({
          fileId,
          mimeType: 'text/plain'
        });
        content = response.data;
        fileType = 'Google Doc';
        console.log(`✅ Successfully exported Google Doc: ${file.name} (${content.length} characters)`);
      } catch (exportError) {
        console.error(`❌ Failed to export Google Doc: ${exportError}`);
        return {
          content: [
            {
              type: 'text',
              text: `📄 Google Doc: "${file.name}"\n\n` +
                    `⚠️  Unable to export this Google Doc. This might be due to permissions or the document being empty.\n\n` +
                    `🔗 Please access it directly: ${file.webViewLink || 'No web link available'}\n\n` +
                    `File ID: ${fileId}\n` +
                    `Error: ${exportError instanceof Error ? exportError.message : 'Unknown error'}`
            }
          ]
        };
      }
    } else if (file.mimeType === 'application/vnd.google-apps.spreadsheet') {
      // Google Sheets - export as CSV
      try {
        console.log(`📊 Attempting to export Google Sheet: ${file.name}`);
        const response = await drive.files.export({
          fileId,
          mimeType: 'text/csv'
        });
        content = response.data;
        fileType = 'Google Sheet';
        console.log(`✅ Successfully exported Google Sheet: ${file.name} (${content.length} characters)`);
      } catch (exportError) {
        console.error(`❌ Failed to export Google Sheet: ${exportError}`);
        return {
          content: [
            {
              type: 'text',
              text: `📊 Google Sheet: "${file.name}"\n\n` +
                    `⚠️  Unable to export this Google Sheet. This might be due to permissions or the sheet being empty.\n\n` +
                    `🔗 Please access it directly: ${file.webViewLink || 'No web link available'}\n\n` +
                    `File ID: ${fileId}\n` +
                    `Error: ${exportError instanceof Error ? exportError.message : 'Unknown error'}`
            }
          ]
        };
      }
    } else if (file.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      // Word documents - can't read directly, provide metadata instead
      return {
        content: [
          {
            type: 'text',
            text: `📄 Word Document: "${file.name}"\n\n` +
                  `⚠️  Word documents (.docx) cannot be read directly through the API. ` +
                  `Please use get_file_metadata to view file details and access it via the web link.\n\n` +
                  `File ID: ${fileId}\n` +
                  `Size: ${sizeInMB.toFixed(2)} MB\n` +
                  `Type: Microsoft Word Document`
          }
        ]
      };
    } else if (file.mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
      // Excel files - can't read directly, provide metadata instead
      return {
        content: [
          {
            type: 'text',
            text: `📊 Excel Spreadsheet: "${file.name}"\n\n` +
                  `⚠️  Excel files (.xlsx) cannot be read directly through the API. ` +
                  `Please use get_file_metadata to view file details and access it via the web link.\n\n` +
                  `File ID: ${fileId}\n` +
                  `Size: ${sizeInMB.toFixed(2)} MB\n` +
                  `Type: Microsoft Excel Spreadsheet`
          }
        ]
      };
    } else if (file.mimeType.startsWith('text/') || file.mimeType === 'application/json') {
      // Text files - read directly
      const response = await drive.files.get({
        fileId,
        alt: 'media'
      });
      content = response.data;
      fileType = 'Text File';
    } else {
      // Other file types - provide metadata
      return {
        content: [
          {
            type: 'text',
            text: `📎 File: "${file.name}"\n\n` +
                  `⚠️  This file type (${file.mimeType}) cannot be read directly. ` +
                  `Please use get_file_metadata to view file details and access it via the web link.\n\n` +
                  `File ID: ${fileId}\n` +
                  `Size: ${sizeInMB.toFixed(2)} MB\n` +
                  `Type: ${file.mimeType}`
          }
        ]
      };
    }

    // Truncate content if too long
    const truncatedContent = content.length > 5000 
      ? content.substring(0, 5000) + '\n\n... (content truncated for performance)'
      : content;

    return {
      content: [
        {
          type: 'text',
          text: `📖 Content of "${file.name}" (${fileType}):\n\n${truncatedContent}`
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

console.log('✅ MCP tools registered with performance improvements');
console.log('🛠️  Registered tools:');
console.log('  • search_file - Search for files in Google Drive');
console.log('  • list_files - List files and folders in Google Drive');
console.log('  • get_file_metadata - Get detailed metadata for a file');
console.log('  • read_content - Read the content of a file from Google Drive');

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
    version: '2.1.0',
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
  console.log('🔍 Request headers:', JSON.stringify(req.headers, null, 2));
  console.log('🔍 Request query:', JSON.stringify(req.query, null, 2));
  console.log('🔍 Request URL:', req.url);
  
  try {
    console.log('🛠️  Creating SSEServerTransport...');
    // Create a new SSE transport for the client
    const transport = new SSEServerTransport('/messages', res);
    console.log('✅ SSEServerTransport created successfully');
    
    // Store the transport by session ID
    const sessionId = transport.sessionId;
    console.log(`🔍 Generated session ID: ${sessionId}`);
    transports[sessionId] = transport;
    
    // Set up onclose handler to clean up transport when closed
    transport.onclose = () => {
      console.log(`🗑️  SSE transport closed for session ${sessionId}`);
      delete transports[sessionId];
    };
    
    console.log('🔗 Connecting transport to MCP server...');
    // Connect the transport to the MCP server
    await server.connect(transport);
    console.log('✅ Transport connected to MCP server successfully');
    
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
    console.error('❌ Error stack:', error.stack);
    console.error('❌ Error details:', {
      name: error.name,
      message: error.message,
      code: error.code
    });
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
  const port = process.env.PORT || 8080;
  
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