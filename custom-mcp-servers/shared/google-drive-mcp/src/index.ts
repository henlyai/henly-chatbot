import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { z } from 'zod';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import express from 'express';
import cors from 'cors';

// Initialize Google APIs
const oauth2Client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/oauth/callback'
);

const drive = google.drive({ version: 'v3', auth: oauth2Client });

// Create MCP server instance
const getServer = () => {
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

  // Define tools using the official pattern
  server.tool('search_file', 'Search for files in Google Drive by name, content, or metadata', {
    query: z.string().describe('Search query for files'),
    fileType: z.string().optional().describe('Optional file type filter (e.g., "pdf", "doc", "image")')
  }, async ({ query, fileType }) => {
    try {
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
    pageSize: z.number().optional().describe('Number of items per page').default(50)
  }, async ({ folderId = 'root', pageSize = 50 }) => {
    try {
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
  }, async ({ fileId }) => {
    try {
      const response = await drive.files.get({
        fileId,
        fields: 'id,name,mimeType,size,modifiedTime,createdTime,parents'
      });

      const file = response.data;
      return {
        content: [
          {
            type: 'text',
            text: `File Metadata:\n\n` +
                  `Name: ${file.name}\n` +
                  `ID: ${file.id}\n` +
                  `Type: ${file.mimeType}\n` +
                  `Size: ${file.size} bytes\n` +
                  `Created: ${file.createdTime}\n` +
                  `Modified: ${file.modifiedTime}`
          }
        ]
      };
    } catch (error) {
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
  }, async ({ fileId, format = 'text' }) => {
    try {
      if (format === 'text') {
        const response = await drive.files.get({
          fileId,
          alt: 'media'
        });

        return {
          content: [
            {
              type: 'text',
              text: `File content:\n\n${response.data}`
            }
          ]
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: `Reading file ${fileId} in ${format} format is not yet implemented.`
          }
        ]
      };
    } catch (error) {
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

  return server;
};

// Create Express app
const app = express();
app.use(cors());
app.use(express.json());

// Store transports by session ID
const transports: Record<string, SSEServerTransport> = {};

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    server: 'google-drive-mcp',
    ts: new Date().toISOString()
  });
});

// Test endpoint
app.get('/test', (req, res) => {
  res.json({
    status: 'ok',
    server: 'google-drive-mcp',
    ts: new Date().toISOString()
  });
});

// OAuth callback endpoint
app.get('/oauth/callback', async (req, res) => {
  const { code } = req.query;
  
  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'Authorization code required' });
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    
    res.json({
      status: 'success',
      message: 'OAuth authentication successful'
    });
  } catch (error) {
    console.error('OAuth error:', error);
    res.status(500).json({
      error: 'OAuth authentication failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// SSE endpoint for establishing the stream (official MCP endpoint)
app.get('/mcp', async (req, res) => {
  console.log('Received GET request to /mcp (establishing SSE stream)');
  try {
    // Create a new SSE transport for the client
    // The endpoint for POST messages is '/messages'
    const transport = new SSEServerTransport('/messages', res);
    
    // Store the transport by session ID
    const sessionId = transport.sessionId;
    transports[sessionId] = transport;
    
    // Set up onclose handler to clean up transport when closed
    transport.onclose = () => {
      console.log(`SSE transport closed for session ${sessionId}`);
      delete transports[sessionId];
    };
    
    // Connect the transport to the MCP server
    const server = getServer();
    await server.connect(transport);
    
    console.log(`Established SSE stream with session ID: ${sessionId}`);
  } catch (error) {
    console.error('Error establishing SSE stream:', error);
    if (!res.headersSent) {
      res.status(500).send('Error establishing SSE stream');
    }
  }
});

// Messages endpoint for receiving client JSON-RPC requests (official MCP endpoint)
app.post('/messages', async (req, res) => {
  console.log('Received POST request to /messages');
  
  // Extract session ID from URL query parameter
  const sessionId = req.query.sessionId as string;
  if (!sessionId) {
    console.error('No session ID provided in request URL');
    res.status(400).send('Missing sessionId parameter');
    return;
  }
  
  const transport = transports[sessionId];
  if (!transport) {
    console.error(`No active transport found for session ID: ${sessionId}`);
    res.status(404).send('Session not found');
    return;
  }
  
  try {
    // Handle the POST message with the transport
    await transport.handlePostMessage(req, res, req.body);
  } catch (error) {
    console.error('Error handling request:', error);
    if (!res.headersSent) {
      res.status(500).send('Error handling request');
    }
  }
});

// Start the server
async function start() {
  const port = process.env.PORT || 3001;
  
  try {
    app.listen(port, () => {
      console.log(`🚀 Google Drive MCP Server running on port ${port}`);
      console.log(`🔗 Health check: http://localhost:${port}/health`);
      console.log(`🧪 Test endpoint: http://localhost:${port}/test`);
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

start().catch((error) => {
  console.error('❌ Failed to start application:', error);
  process.exit(1);
}); 