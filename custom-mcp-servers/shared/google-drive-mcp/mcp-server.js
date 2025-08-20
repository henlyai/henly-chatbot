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
  find_document: {
    name: "find_document",
    description: "Find specific documents by title or ID",
    inputSchema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Document title to search for"
        },
        fileId: {
          type: "string",
          description: "Specific file ID to retrieve"
        }
      }
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
  download_file: {
    name: "download_file",
    description: "Download a file from Google Drive",
    inputSchema: {
      type: "object",
      properties: {
        fileId: {
          type: "string",
          description: "Google Drive file ID"
        },
        format: {
          type: "string",
          description: "Download format",
          default: "original"
        }
      },
      required: ["fileId"]
    }
  },
  upload_file: {
    name: "upload_file",
    description: "Upload a file to Google Drive",
    inputSchema: {
      type: "object",
      properties: {
        fileName: {
          type: "string",
          description: "Name for the uploaded file"
        },
        content: {
          type: "string",
          description: "File content (base64 encoded for binary files)"
        },
        mimeType: {
          type: "string",
          description: "MIME type of the file"
        },
        parentFolderId: {
          type: "string",
          description: "Parent folder ID (default: root)"
        }
      },
      required: ["fileName", "content"]
    }
  },
  create_folder: {
    name: "create_folder",
    description: "Create a new folder in Google Drive",
    inputSchema: {
      type: "object",
      properties: {
        folderName: {
          type: "string",
          description: "Name for the new folder"
        },
        parentFolderId: {
          type: "string",
          description: "Parent folder ID (default: root)"
        }
      },
      required: ["folderName"]
    }
  },
  delete_file: {
    name: "delete_file",
    description: "Delete a file or folder from Google Drive",
    inputSchema: {
      type: "object",
      properties: {
        fileId: {
          type: "string",
          description: "Google Drive file ID to delete"
        }
      },
      required: ["fileId"]
    }
  },
  share_file: {
    name: "share_file",
    description: "Share a file with specific users or make it publicly accessible",
    inputSchema: {
      type: "object",
      properties: {
        fileId: {
          type: "string",
          description: "Google Drive file ID"
        },
        email: {
          type: "string",
          description: "Email address to share with"
        },
        role: {
          type: "string",
          description: "Permission role (reader, writer, owner)",
          default: "reader"
        },
        type: {
          type: "string",
          description: "Permission type (user, group, domain, anyone)",
          default: "user"
        }
      },
      required: ["fileId"]
    }
  },
  get_file_permissions: {
    name: "get_file_permissions",
    description: "Get current permissions for a file",
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
  search_documents: {
    name: "search_documents",
    description: "Search for Google Docs, Sheets, and Slides",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query for documents"
        },
        documentType: {
          type: "string",
          description: "Document type (document, spreadsheet, presentation)",
          enum: ["document", "spreadsheet", "presentation"]
        }
      },
      required: ["query"]
    }
  },
  read_document_content: {
    name: "read_document_content",
    description: "Read content from Google Docs, Sheets, or Slides",
    inputSchema: {
      type: "object",
      properties: {
        fileId: {
          type: "string",
          description: "Google Drive file ID"
        },
        exportFormat: {
          type: "string",
          description: "Export format (pdf, docx, txt, etc.)",
          default: "txt"
        }
      },
      required: ["fileId"]
    }
  },
  extract_text: {
    name: "extract_text",
    description: "Extract text content from various file types",
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
  get_file_versions: {
    name: "get_file_versions",
    description: "Get version history for a file",
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

// Helper function to send JSON-RPC notification
function sendJsonRpcNotification(res, method, params = {}) {
  const notification = {
    jsonrpc: "2.0",
    method: method,
    params: params
  };
  
  const data = `data: ${JSON.stringify(notification)}\n\n`;
  console.log(`📤 Sending JSON-RPC notification:`, JSON.stringify(notification, null, 2));
  res.write(data);
}

// Health check endpoint
app.get('/health', (req, res) => {
  console.log('🏥 Health check request received');
  res.status(200).send('OK');
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

// POST endpoint for client→server communication
app.post('/sse', (req, res) => {
  console.log('📨 POST /sse request received');
  console.log('📨 Request headers:', req.headers);
  console.log('📨 Request body:', JSON.stringify(req.body, null, 2));
  
  try {
    const { id, method, params } = req.body;
    
    if (!id || !method) {
      console.error('❌ Invalid JSON-RPC request: missing id or method');
      return res.status(400).json({
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32600,
          message: "Invalid Request"
        }
      });
    }
    
    console.log(`📨 Processing JSON-RPC request: id=${id}, method=${method}`);
    
    // Extract session identifier
    const sessionId = req.headers['x-mcp-client'] || req.query.sessionId;
    
    if (!sessionId) {
      console.error('❌ No session ID provided in headers or query params');
      return res.status(400).json({
        jsonrpc: "2.0",
        id: id,
        error: {
          code: -32001,
          message: "Session not found"
        }
      });
    }
    
    console.log(`📨 Session ID: ${sessionId}`);
    
    // Find the corresponding SSE session
    const session = sessions.get(sessionId);
    
    if (!session || !session.connected) {
      console.error(`❌ Session not found or disconnected: ${sessionId}`);
      return res.status(400).json({
        jsonrpc: "2.0",
        id: id,
        error: {
          code: -32001,
          message: "Session not found or disconnected"
        }
      });
    }
    
    // Update last activity
    session.lastActivity = Date.now();
    
    // Handle different methods
    switch (method) {
      case 'initialize':
        console.log(`📨 Handling initialize request: ${id}`);
        const initResult = {
          protocolVersion: "2024-11-05",
          capabilities: {
            tools: {},
            resources: {}
          },
          serverInfo: {
            name: "Google Drive MCP Server",
            version: "2.0.0"
          }
        };
        sendJsonRpcResponse(session.res, id, initResult);
        break;
        
      case 'tools/list':
        console.log(`📨 Handling tools/list request: ${id}`);
        const toolsResult = {
          tools: Object.values(tools)
        };
        sendJsonRpcResponse(session.res, id, toolsResult);
        break;
        
      case 'tools/call':
        console.log(`📨 Handling tools/call request: ${id}`);
        const { name, arguments: args } = params;
        
        if (!name || !tools[name]) {
          sendJsonRpcResponse(session.res, id, null, {
            code: -32601,
            message: `Tool '${name}' not found`
          });
          break;
        }
        
        // For now, return a placeholder response indicating OAuth is required
        // In a real implementation, this would handle the actual Google Drive API calls
        sendJsonRpcResponse(session.res, id, {
          content: [
            {
              type: "text",
              text: `Tool '${name}' requires OAuth authentication. Please authenticate with Google Drive to use this tool.`
            }
          ]
        });
        break;
        
      default:
        console.log(`📨 Unknown method: ${method}`);
        sendJsonRpcResponse(session.res, id, null, {
          code: -32601,
          message: `Method '${method}' not found`
        });
    }
    
    // Send success response to POST request
    res.status(200).json({
      jsonrpc: "2.0",
      id: id,
      result: { status: "processed" }
    });
    
  } catch (error) {
    console.error('❌ Error processing POST /sse request:', error);
    res.status(500).json({
      jsonrpc: "2.0",
      id: req.body?.id || null,
      error: {
        code: -32603,
        message: "Internal error"
      }
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 MCP Server running on port ${PORT}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`🧪 Test endpoint: http://localhost:${PORT}/test`);
  console.log(`📡 SSE endpoint: http://localhost:${PORT}/sse`);
  console.log(`📨 POST endpoint: http://localhost:${PORT}/sse`);
  console.log(`🛠️  Available tools: ${Object.keys(tools).length}`);
  console.log(`📋 Tools: ${Object.keys(tools).join(', ')}`);
}); 