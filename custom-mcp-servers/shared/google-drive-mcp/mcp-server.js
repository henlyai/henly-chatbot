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

  console.log('SSE connection established');

  // Send initial keep-alive to establish connection
  res.write(':\n\n');

  // Keep track of initialization state
  let initialized = false;

  // Handle incoming messages from the client
  req.on('data', (chunk) => {
    try {
      const data = chunk.toString();
      console.log('Received data:', data);
      
      const lines = data.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const messageData = line.substring(6);
          console.log('Processing message data:', messageData);
          
          try {
            const message = JSON.parse(messageData);
            console.log('Parsed message:', message);
            
            // Handle initialization request
            if (message.method === 'initialize' && !initialized) {
              console.log('Handling initialize request');
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
              
              const responseData = `data: ${JSON.stringify(initResponse)}\n\n`;
              console.log('Sending init response:', responseData);
              res.write(responseData);
              initialized = true;
              console.log('MCP initialization completed');
            }
            
            // Handle tools/list request
            else if (message.method === 'tools/list' && initialized) {
              console.log('Handling tools/list request');
              const toolsResponse = {
                jsonrpc: "2.0",
                id: message.id,
                result: {
                  tools: Object.values(tools)
                }
              };
              
              const responseData = `data: ${JSON.stringify(toolsResponse)}\n\n`;
              console.log('Sending tools response:', responseData);
              res.write(responseData);
            }
            
            // Handle tools/call request
            else if (message.method === 'tools/call' && initialized) {
              console.log('Handling tools/call request');
              const toolName = message.params.name;
              const args = message.params.arguments || {};
              
              // Check if OAuth is required for this tool call
              // For now, return a placeholder response indicating OAuth is needed
              const callResponse = {
                jsonrpc: "2.0",
                id: message.id,
                error: {
                  code: -32001,
                  message: "OAuth authentication required for Google Drive access",
                  data: {
                    oauth_required: true,
                    tool_name: toolName
                  }
                }
              };
              
              const responseData = `data: ${JSON.stringify(callResponse)}\n\n`;
              console.log('Sending OAuth required response:', responseData);
              res.write(responseData);
            }
          } catch (parseError) {
            console.error('Error parsing JSON:', parseError);
          }
        }
      }
    } catch (error) {
      console.error('Error processing data:', error);
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

  req.on('error', (error) => {
    console.error('SSE connection error:', error);
    clearInterval(interval);
  });
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`🚀 Google Drive MCP Server running on port ${port}`);
  console.log(`📊 Health check: http://localhost:${port}/health`);
  console.log(`📡 SSE endpoint: http://localhost:${port}/sse`);
}); 