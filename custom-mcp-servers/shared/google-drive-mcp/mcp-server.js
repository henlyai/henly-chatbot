const express = require('express');
const app = express();

// Google Drive API tools
const tools = {
  "search_file": {
    "name": "search_file",
    "description": "Search for files in Google Drive by name, content, or metadata",
    "inputSchema": {
      "type": "object",
      "properties": {
        "query": {
          "type": "string",
          "description": "Search query (file name, content, or metadata)"
        },
        "fileType": {
          "type": "string",
          "description": "Optional file type filter (e.g., 'document', 'spreadsheet', 'presentation')"
        },
        "maxResults": {
          "type": "number",
          "description": "Maximum number of results to return (default: 10)"
        }
      },
      "required": ["query"]
    }
  },
  "find_document": {
    "name": "find_document",
    "description": "Find specific documents by name or ID",
    "inputSchema": {
      "type": "object",
      "properties": {
        "fileName": {
          "type": "string",
          "description": "Name of the document to find"
        },
        "fileId": {
          "type": "string",
          "description": "Google Drive file ID (if known)"
        },
        "exactMatch": {
          "type": "boolean",
          "description": "Whether to require exact name match (default: false)"
        }
      }
    }
  },
  "read_content": {
    "name": "read_content",
    "description": "Read the content of a Google Drive file",
    "inputSchema": {
      "type": "object",
      "properties": {
        "fileId": {
          "type": "string",
          "description": "Google Drive file ID"
        },
        "fileType": {
          "type": "string",
          "description": "Type of file (document, spreadsheet, text, etc.)"
        },
        "includeMetadata": {
          "type": "boolean",
          "description": "Whether to include file metadata (default: true)"
        }
      },
      "required": ["fileId"]
    }
  },
  "list_files": {
    "name": "list_files",
    "description": "List files and folders in Google Drive",
    "inputSchema": {
      "type": "object",
      "properties": {
        "folderId": {
          "type": "string",
          "description": "Folder ID to list contents from (default: root)"
        },
        "fileType": {
          "type": "string",
          "description": "Filter by file type"
        },
        "maxResults": {
          "type": "number",
          "description": "Maximum number of results (default: 50)"
        },
        "orderBy": {
          "type": "string",
          "description": "Sort order (modifiedTime, name, createdTime)"
        }
      }
    }
  },
  "get_file_metadata": {
    "name": "get_file_metadata",
    "description": "Get detailed metadata for a Google Drive file",
    "inputSchema": {
      "type": "object",
      "properties": {
        "fileId": {
          "type": "string",
          "description": "Google Drive file ID"
        }
      },
      "required": ["fileId"]
    }
  },
  "download_file": {
    "name": "download_file",
    "description": "Download a file from Google Drive",
    "inputSchema": {
      "type": "object",
      "properties": {
        "fileId": {
          "type": "string",
          "description": "Google Drive file ID"
        },
        "format": {
          "type": "string",
          "description": "Export format for Google Docs (pdf, docx, txt, etc.)"
        }
      },
      "required": ["fileId"]
    }
  },
  "upload_file": {
    "name": "upload_file",
    "description": "Upload a file to Google Drive",
    "inputSchema": {
      "type": "object",
      "properties": {
        "fileName": {
          "type": "string",
          "description": "Name for the uploaded file"
        },
        "fileContent": {
          "type": "string",
          "description": "File content (base64 encoded)"
        },
        "mimeType": {
          "type": "string",
          "description": "MIME type of the file"
        },
        "parentFolderId": {
          "type": "string",
          "description": "Parent folder ID (default: root)"
        }
      },
      "required": ["fileName", "fileContent"]
    }
  },
  "create_folder": {
    "name": "create_folder",
    "description": "Create a new folder in Google Drive",
    "inputSchema": {
      "type": "object",
      "properties": {
        "folderName": {
          "type": "string",
          "description": "Name of the folder to create"
        },
        "parentFolderId": {
          "type": "string",
          "description": "Parent folder ID (default: root)"
        },
        "description": {
          "type": "string",
          "description": "Optional folder description"
        }
      },
      "required": ["folderName"]
    }
  },
  "delete_file": {
    "name": "delete_file",
    "description": "Delete a file or folder from Google Drive",
    "inputSchema": {
      "type": "object",
      "properties": {
        "fileId": {
          "type": "string",
          "description": "Google Drive file ID"
        },
        "permanent": {
          "type": "boolean",
          "description": "Whether to permanently delete (default: false, moves to trash)"
        }
      },
      "required": ["fileId"]
    }
  },
  "share_file": {
    "name": "share_file",
    "description": "Share a file with specific permissions",
    "inputSchema": {
      "type": "object",
      "properties": {
        "fileId": {
          "type": "string",
          "description": "Google Drive file ID"
        },
        "email": {
          "type": "string",
          "description": "Email address to share with"
        },
        "role": {
          "type": "string",
          "description": "Permission role (reader, writer, owner)",
          "enum": ["reader", "writer", "owner"]
        },
        "type": {
          "type": "string",
          "description": "Permission type (user, group, domain, anyone)",
          "enum": ["user", "group", "domain", "anyone"]
        }
      },
      "required": ["fileId", "email", "role"]
    }
  },
  "get_file_permissions": {
    "name": "get_file_permissions",
    "description": "Get current permissions for a file",
    "inputSchema": {
      "type": "object",
      "properties": {
        "fileId": {
          "type": "string",
          "description": "Google Drive file ID"
        }
      },
      "required": ["fileId"]
    }
  },
  "search_documents": {
    "name": "search_documents",
    "description": "Search specifically within Google Docs content",
    "inputSchema": {
      "type": "object",
      "properties": {
        "query": {
          "type": "string",
          "description": "Text to search for in document content"
        },
        "documentType": {
          "type": "string",
          "description": "Type of document (document, spreadsheet, presentation)"
        },
        "maxResults": {
          "type": "number",
          "description": "Maximum number of results (default: 10)"
        }
      },
      "required": ["query"]
    }
  },
  "read_document_content": {
    "name": "read_document_content",
    "description": "Read the full content of a Google Doc",
    "inputSchema": {
      "type": "object",
      "properties": {
        "fileId": {
          "type": "string",
          "description": "Google Drive file ID"
        },
        "includeFormatting": {
          "type": "boolean",
          "description": "Whether to include formatting information (default: false)"
        }
      },
      "required": ["fileId"]
    }
  },
  "extract_text": {
    "name": "extract_text",
    "description": "Extract text content from various file types",
    "inputSchema": {
      "type": "object",
      "properties": {
        "fileId": {
          "type": "string",
          "description": "Google Drive file ID"
        },
        "fileType": {
          "type": "string",
          "description": "Type of file (pdf, image, document, etc.)"
        }
      },
      "required": ["fileId"]
    }
  },
  "get_file_versions": {
    "name": "get_file_versions",
    "description": "Get version history of a file",
    "inputSchema": {
      "type": "object",
      "properties": {
        "fileId": {
          "type": "string",
          "description": "Google Drive file ID"
        },
        "maxVersions": {
          "type": "number",
          "description": "Maximum number of versions to return (default: 10)"
        }
      },
      "required": ["fileId"]
    }
  }
};

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Google Drive MCP Server',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    tools: Object.keys(tools).length
  });
});

// SSE endpoint for MCP protocol
app.get('/sse', (req, res) => {
  console.log('SSE connection request received');
  
  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  // Send initial keep-alive to establish connection
  res.write(':\n\n');

  // Send initialization message proactively (LibreChat expects this)
  const initMessage = {
    jsonrpc: "2.0",
    id: 1,
    result: {
      protocolVersion: "2024-11-05",
      capabilities: {
        tools: tools,
        resources: {}
      },
      serverInfo: {
        name: "Google Drive MCP Server",
        version: "2.0.0"
      }
    }
  };

  console.log('Sending initialization message with', Object.keys(tools).length, 'tools');
  res.write(`data: ${JSON.stringify(initMessage)}\n\n`);

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

// OAuth callback endpoint
app.get('/oauth/callback', (req, res) => {
  const { code, state } = req.query;
  
  if (!code) {
    return res.status(400).json({ error: 'Authorization code not provided' });
  }

  // Handle OAuth callback
  console.log('OAuth callback received:', { code, state });
  
  // TODO: Exchange code for tokens
  res.json({ 
    status: 'success', 
    message: 'OAuth callback received. Token exchange would happen here.' 
  });
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`🚀 Google Drive MCP Server v2.0.0 running on port ${port}`);
  console.log(`📊 Health check: http://localhost:${port}/health`);
  console.log(`📡 SSE endpoint: http://localhost:${port}/sse`);
  console.log(`🔧 Available tools: ${Object.keys(tools).join(', ')}`);
}); 