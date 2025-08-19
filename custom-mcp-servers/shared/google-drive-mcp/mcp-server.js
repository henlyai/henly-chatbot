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

  // Define tools
  const tools = {
    "list_files": {
      "name": "list_files",
      "description": "List files and folders in Google Drive",
      "inputSchema": {
        "type": "object",
        "properties": {
          "folderId": {
            "type": "string",
            "description": "Folder ID to list (default: root)"
          },
          "maxResults": {
            "type": "number",
            "description": "Maximum number of results (default: 50)"
          }
        }
      }
    },
    "search_files": {
      "name": "search_files",
      "description": "Search for files in Google Drive",
      "inputSchema": {
        "type": "object",
        "properties": {
          "query": {
            "type": "string",
            "description": "Search query"
          },
          "maxResults": {
            "type": "number",
            "description": "Maximum number of results (default: 50)"
          }
        },
        "required": ["query"]
      }
    },
    "get_file_content": {
      "name": "get_file_content",
      "description": "Get the content of a file from Google Drive",
      "inputSchema": {
        "type": "object",
        "properties": {
          "fileId": {
            "type": "string",
            "description": "File ID to get content from"
          }
        },
        "required": ["fileId"]
      }
    },
    "get_file_metadata": {
      "name": "get_file_metadata",
      "description": "Get metadata for a file from Google Drive",
      "inputSchema": {
        "type": "object",
        "properties": {
          "fileId": {
            "type": "string",
            "description": "File ID to get metadata for"
          }
        },
        "required": ["fileId"]
      }
    }
  };

  // Send initial connection established message
  res.write(':\n\n'); // Keep-alive comment to establish connection

  // Keep track of initialization state
  let initialized = false;

  // Handle incoming messages from the client
  req.on('data', (chunk) => {
    try {
      const data = chunk.toString();
      const lines = data.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const messageData = line.substring(6);
          const message = JSON.parse(messageData);
          
          console.log('Received message:', message);
          
          // Handle initialization request
          if (message.method === 'initialize' && !initialized) {
            const initResponse = {
              jsonrpc: "2.0",
              id: message.id,
              result: {
                protocolVersion: "2024-11-05",
                capabilities: {
                  tools: tools,
                  resources: {}
                },
                serverInfo: {
                  name: "Google Drive MCP Server",
                  version: "1.0.0"
                }
              }
            };
            
            res.write(`data: ${JSON.stringify(initResponse)}\n\n`);
            initialized = true;
            console.log('MCP initialization completed');
          }
          
          // Handle tools/list request
          else if (message.method === 'tools/list' && initialized) {
            const toolsResponse = {
              jsonrpc: "2.0",
              id: message.id,
              result: {
                tools: Object.values(tools)
              }
            };
            
            res.write(`data: ${JSON.stringify(toolsResponse)}\n\n`);
          }
          
          // Handle tools/call request
          else if (message.method === 'tools/call' && initialized) {
            const toolName = message.params.name;
            const args = message.params.arguments || {};
            
            // For now, return a placeholder response
            const callResponse = {
              jsonrpc: "2.0",
              id: message.id,
              result: {
                content: [
                  {
                    type: "text",
                    text: `Tool ${toolName} called with args: ${JSON.stringify(args)}`
                  }
                ]
              }
            };
            
            res.write(`data: ${JSON.stringify(callResponse)}\n\n`);
          }
        }
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });

  // Keep connection alive
  const interval = setInterval(() => {
    res.write(':\n\n'); // Keep-alive comment
  }, 30000);

  req.on('close', () => {
    clearInterval(interval);
    console.log('SSE connection closed');
  });
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`🚀 Google Drive MCP Server running on port ${port}`);
  console.log(`📊 Health check: http://localhost:${port}/health`);
  console.log(`📡 SSE endpoint: http://localhost:${port}/sse`);
}); 