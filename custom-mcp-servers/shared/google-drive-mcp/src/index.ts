import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
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

// Define tools
const tools = [
  {
    name: 'search_file',
    description: 'Search for files in Google Drive by name, content, or metadata',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query for files'
        },
        fileType: {
          type: 'string',
          description: 'Optional file type filter (e.g., "pdf", "doc", "image")'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'list_files',
    description: 'List files and folders in Google Drive',
    inputSchema: {
      type: 'object',
      properties: {
        folderId: {
          type: 'string',
          description: 'Folder ID to list contents (default: root)'
        },
        pageSize: {
          type: 'number',
          description: 'Number of items per page',
          default: 50
        }
      }
    }
  },
  {
    name: 'get_file_metadata',
    description: 'Get detailed metadata for a file',
    inputSchema: {
      type: 'object',
      properties: {
        fileId: {
          type: 'string',
          description: 'Google Drive file ID'
        }
      },
      required: ['fileId']
    }
  },
  {
    name: 'read_content',
    description: 'Read the content of a file from Google Drive',
    inputSchema: {
      type: 'object',
      properties: {
        fileId: {
          type: 'string',
          description: 'Google Drive file ID'
        },
        format: {
          type: 'string',
          description: 'Content format (text, html, etc.)',
          default: 'text'
        }
      },
      required: ['fileId']
    }
  }
];

// Create MCP server
const server = new Server(
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

// Handle tools/list
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools
  };
});

// Handle tools/call
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'search_file': {
        const { query, fileType } = args as { query: string; fileType?: string };
        
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
      }

      case 'list_files': {
        const { folderId = 'root', pageSize = 50 } = args as { folderId?: string; pageSize?: number };
        
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
      }

      case 'get_file_metadata': {
        const { fileId } = args as { fileId: string };
        
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
      }

      case 'read_content': {
        const { fileId, format = 'text' } = args as { fileId: string; format?: string };
        
        // For text files, we can read content directly
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
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    console.error(`Error executing tool ${name}:`, error);
    return {
      content: [
        {
          type: 'text',
          text: `Error executing ${name}: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      ]
    };
  }
});

// Create Express app for additional endpoints
const app = express();
app.use(cors());
app.use(express.json());

// Session management for active transports
const activeTransports = new Map<string, SSEServerTransport>();

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

// Start the server
async function start() {
  const port = process.env.PORT || 3001;
  
  // Start Express server
  app.listen(port, () => {
    console.log(`🚀 Google Drive MCP Server running on port ${port}`);
    console.log(`🔗 Health check: http://localhost:${port}/health`);
    console.log(`🧪 Test endpoint: http://localhost:${port}/test`);
    console.log(`🔐 OAuth callback: http://localhost:${port}/oauth/callback`);
    console.log(`📡 SSE endpoint: http://localhost:${port}/sse`);
    console.log(`🛠️  Available tools: ${tools.length}`);
    console.log(`📋 Tools: ${tools.map(t => t.name).join(', ')}`);
  });

  // Set up SSE endpoint for MCP server
  app.get('/sse', async (req, res) => {
    try {
      const sessionId = Array.isArray(req.headers['x-mcp-client']) 
        ? req.headers['x-mcp-client'][0] 
        : req.headers['x-mcp-client'] || 'default';
      
      // Create SSE transport for this connection
      const transport = new SSEServerTransport('/sse', res);
      
      // Store the transport for this session
      activeTransports.set(sessionId, transport);
      
      // Connect the server to this transport (this automatically calls start())
      await server.connect(transport);
      
      console.log(`✅ MCP server connected with SSE transport for session: ${sessionId}`);
      
      // Clean up when transport closes
      transport.onclose = () => {
        activeTransports.delete(sessionId);
        console.log(`🗑️  Transport closed for session: ${sessionId}`);
      };
    } catch (error) {
      console.error('❌ Error setting up SSE transport:', error);
      res.status(500).end();
    }
  });

  // Set up POST endpoint for receiving messages
  app.post('/sse', async (req, res) => {
    try {
      const sessionId = Array.isArray(req.headers['x-mcp-client']) 
        ? req.headers['x-mcp-client'][0] 
        : req.headers['x-mcp-client'] || 'default';
      const transport = activeTransports.get(sessionId);
      
      if (!transport) {
        return res.status(404).json({ error: 'No active transport found for session' });
      }
      
      // Handle the POST message through the transport
      await transport.handlePostMessage(req, res, req.body);
    } catch (error) {
      console.error('❌ Error handling POST request:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
}

start().catch(console.error); 