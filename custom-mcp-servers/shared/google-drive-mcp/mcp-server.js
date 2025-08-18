import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (_req, res) => res.json({ 
  status: 'ok', 
  server: 'google-drive-mcp', 
  ts: new Date().toISOString() 
}));

// MCP Protocol SSE endpoint
app.get('/sse', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  // Send initialization message
  const initMessage = {
    jsonrpc: "2.0",
    id: 1,
    result: {
      protocolVersion: "2024-11-05",
      capabilities: {
        tools: {},
        resources: {}
      },
      serverInfo: {
        name: "Google Drive MCP Server",
        version: "1.0.0"
      }
    }
  };

  res.write(`data: ${JSON.stringify(initMessage)}\n\n`);

  // Send tools list
  const tools = [
    {
      name: "list_files",
      description: "List files and folders in Google Drive",
      inputSchema: {
        type: "object",
        properties: {
          folderId: {
            type: "string",
            description: "Folder ID to list (default: root)"
          },
          maxResults: {
            type: "number",
            description: "Maximum number of results (default: 50)"
          }
        }
      }
    },
    {
      name: "search_files",
      description: "Search for files in Google Drive",
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query"
          },
          maxResults: {
            type: "number",
            description: "Maximum number of results (default: 50)"
          }
        },
        required: ["query"]
      }
    },
    {
      name: "get_file_content",
      description: "Get the content of a file from Google Drive",
      inputSchema: {
        type: "object",
        properties: {
          fileId: {
            type: "string",
            description: "File ID to get content from"
          }
        },
        required: ["fileId"]
      }
    },
    {
      name: "get_file_metadata",
      description: "Get metadata for a file from Google Drive",
      inputSchema: {
        type: "object",
        properties: {
          fileId: {
            type: "string",
            description: "File ID to get metadata for"
          }
        },
        required: ["fileId"]
      }
    }
  ];

  // Send tools/list message
  const toolsListMessage = {
    jsonrpc: "2.0",
    method: "tools/list",
    params: {
      tools: tools
    }
  };

  res.write(`data: ${JSON.stringify(toolsListMessage)}\n\n`);

  // Keep connection alive
  const interval = setInterval(() => {
    res.write(':\n\n'); // Keep-alive comment
  }, 30000);

  req.on('close', () => {
    clearInterval(interval);
  });
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`🚀 Google Drive MCP Server running on port ${port}`);
  console.log(`📊 Health check: http://localhost:${port}/health`);
  console.log(`📡 SSE endpoint: http://localhost:${port}/sse`);
}); 