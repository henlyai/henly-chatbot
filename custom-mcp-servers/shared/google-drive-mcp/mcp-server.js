import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3001;

// Session management for SSE connections
const sessions = new Map();
const SESSION_TIMEOUT = 5 * 60 * 1000; // 5 minutes

// Clean up expired sessions
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, session] of sessions.entries()) {
    if (now - session.lastActivity > SESSION_TIMEOUT) {
      console.log(`🧹 Cleaning up expired session: ${sessionId}`);
      if (session.res && !session.res.destroyed) {
        session.res.end();
      }
      sessions.delete(sessionId);
    }
  }
}, 30000); // Check every 30 seconds

// CORS configuration
const allowedOrigins = [
  'https://scalewize-production-chatbot-production.up.railway.app',
  'https://scalewize-website.vercel.app',
  'http://localhost:3000',
  'http://localhost:3001'
];

app.use(cors({
  origin: (origin, callback) => {
    console.log(`🌐 CORS request from origin: ${origin}`);
    if (!origin || allowedOrigins.includes(origin)) {
      console.log(`✅ CORS allowed for origin: ${origin}`);
      callback(null, true);
    } else {
      console.log(`❌ CORS blocked for origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));

// Middleware to log all requests
app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.path} - Headers:`, req.headers);
  next();
});

// Google Drive MCP Tools
const tools = {
  search_file: {
    name: "search_file",
    description: "Search for files in Google Drive by name, content, or metadata",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query for files"
        },
        fileType: {
          type: "string",
          description: "Optional file type filter (e.g., 'pdf', 'doc', 'image')"
        }
      },
      required: ["query"]
    }
  },
  list_files: {
    name: "list_files",
    description: "List files and folders in Google Drive",
    inputSchema: {
      type: "object",
      properties: {
        folderId: {
          type: "string",
          description: "Folder ID to list contents (default: root)"
        },
        pageSize: {
          type: "number",
          description: "Number of items per page",
          default: 50
        }
      }
    }
  },
  get_file_metadata: {
    name: "get_file_metadata",
    description: "Get detailed metadata for a file",
    inputSchema: {
      type: "object",
      properties: {
        fileId: {
          type: "string",
          description: "Google Drive file ID"
        }
      },
      required: ["fileId"]
    }
  },
  read_content: {
    name: "read_content",
    description: "Read the content of a file from Google Drive",
    inputSchema: {
      type: "object",
      properties: {
        fileId: {
          type: "string",
          description: "Google Drive file ID"
        },
        format: {
          type: "string",
          description: "Content format (text, html, etc.)",
          default: "text"
        }
      },
      required: ["fileId"]
    }
  }
};

// Helper function to send JSON-RPC response
function sendJsonRpcResponse(res, id, result, error = null) {
  const response = {
    jsonrpc: "2.0",
    id: id
  };
  
  if (error) {
    response.error = error;
  } else {
    response.result = result;
  }
  
  const data = `data: ${JSON.stringify(response)}\n\n`;
  console.log(`📤 Sending JSON-RPC response:`, JSON.stringify(response, null, 2));
  res.write(data);
}

// Health check endpoint
app.get('/health', (req, res) => {
  console.log('🏥 Health check request received');
  res.status(200).json({
    status: 'ok',
    server: 'Google Drive MCP Server',
    version: '2.0.0',
    tools: Object.keys(tools)
  });
});

// Test endpoint
app.get('/test', (req, res) => {
  console.log('🧪 Test endpoint request received');
  res.json({
    status: 'ok',
    message: 'MCP server is running',
    timestamp: new Date().toISOString(),
    tools: Object.keys(tools)
  });
});

// SSE endpoint for server→client communication
app.get('/sse', (req, res) => {
  console.log('🔗 SSE connection request received');
  console.log('🔗 Request headers:', req.headers);
  console.log('🔗 Request method:', req.method);
  console.log('🔗 Request URL:', req.url);
  
  // Extract session identifier from headers or query params
  const sessionId = req.headers['x-mcp-client'] || req.query.sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  console.log(`🔗 Session ID: ${sessionId}`);
  
  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control, X-MCP-Client'
  });

  console.log('🔗 SSE headers set, sending initial keep-alive');
  
  // Send initial keep-alive to establish connection
  res.write(':\n\n');
  console.log('🔗 Initial keep-alive sent');

  // Store session
  const session = {
    res: res,
    sessionId: sessionId,
    lastActivity: Date.now(),
    connected: true
  };
  
  sessions.set(sessionId, session);
  console.log(`🔗 Session stored: ${sessionId}`);
  console.log(`🔗 Active sessions: ${sessions.size}`);

  // Send initialization message with a small delay to ensure connection is established
  setTimeout(() => {
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
          version: "2.0.0"
        }
      }
    };

    console.log('📤 Sending initialization message');
    console.log('📤 Message:', JSON.stringify(initMessage, null, 2));
    
    const initData = `data: ${JSON.stringify(initMessage)}\n\n`;
    res.write(initData);
    console.log('📤 Initialization message sent');

    // Send tools list after initialization
    setTimeout(() => {
      const toolsMessage = {
        jsonrpc: "2.0",
        id: 2,
        result: {
          tools: Object.values(tools)
        }
      };

      console.log('📤 Sending tools list');
      console.log('📤 Tools:', Object.keys(tools));
      
      const toolsData = `data: ${JSON.stringify(toolsMessage)}\n\n`;
      res.write(toolsData);
      console.log('📤 Tools list sent');
    }, 100);
  }, 100);

  // Keep connection alive
  const interval = setInterval(() => {
    if (session.connected && !res.destroyed) {
      console.log(`💓 Sending keep-alive ping for session: ${sessionId}`);
      res.write(':\n\n');
      session.lastActivity = Date.now();
    } else {
      console.log(`💔 Session ${sessionId} disconnected, stopping keep-alive`);
      clearInterval(interval);
    }
  }, 30000);

  // Handle connection close
  req.on('close', () => {
    console.log(`🔌 SSE connection closed for session: ${sessionId}`);
    session.connected = false;
    clearInterval(interval);
    sessions.delete(sessionId);
    console.log(`🔗 Session removed: ${sessionId}`);
    console.log(`🔗 Active sessions: ${sessions.size}`);
  });

  req.on('error', (error) => {
    console.error(`💥 SSE connection error for session ${sessionId}:`, error);
    session.connected = false;
    clearInterval(interval);
    sessions.delete(sessionId);
  });

  req.on('end', () => {
    console.log(`🏁 SSE connection ended for session: ${sessionId}`);
  });
});

// POST endpoint for client→server communication (for future use)
app.post('/sse', (req, res) => {
  console.log('📨 POST /sse request received');
  console.log('📨 Request headers:', req.headers);
  console.log('📨 Request body:', JSON.stringify(req.body, null, 2));
  
  // For now, just acknowledge the request
  res.status(200).json({
    jsonrpc: "2.0",
    id: req.body?.id || null,
    result: { status: "acknowledged" }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 MCP Server running on port ${PORT}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`🧪 Test endpoint: http://localhost:${PORT}/test`);
  console.log(`📡 SSE endpoint: http://localhost:${PORT}/sse`);
  console.log(`🛠️  Available tools: ${Object.keys(tools).length}`);
  console.log(`📋 Tools: ${Object.keys(tools).join(', ')}`);
}); 