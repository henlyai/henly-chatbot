# Google Drive MCP Server for ScaleWize AI

A custom Model Context Protocol (MCP) server that provides comprehensive Google Drive integration for LibreChat, enabling AI assistants to read, search, and manage Google Drive files.

## Features

- **File Listing**: List files and folders in Google Drive
- **Full-Text Search**: Search across all files in Google Drive
- **Content Reading**: Read content from Google Docs, Sheets, Slides, and text files
- **File Metadata**: Get detailed metadata for files
- **Folder Creation**: Create new folders
- **File Upload**: Upload files to Google Drive
- **OAuth Authentication**: Secure Google OAuth 2.0 integration

## Installation

1. **Clone and install dependencies:**
```bash
cd custom-mcp-servers/google-drive-mcp
npm install
```

2. **Set up Google Cloud Project:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing one
   - Enable Google Drive API
   - Create OAuth 2.0 credentials
   - Add authorized redirect URIs

3. **Configure environment variables:**
```bash
cp env.example .env
# Edit .env with your Google API credentials
```

4. **Build the project:**
```bash
npm run build
```

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | Yes |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | Yes |
| `GOOGLE_REDIRECT_URI` | OAuth callback URL | Yes |
| `PORT` | Server port (default: 3001) | No |
| `MCP_TRANSPORT` | Transport type: 'sse' or 'stdio' | No |

### Google Cloud Setup

1. **Enable APIs:**
   - Google Drive API
   - Google Docs API (for document content)

2. **Create OAuth 2.0 Credentials:**
   - Application type: Web application
   - Authorized redirect URIs: `http://localhost:3001/oauth/callback`
   - Scopes: `https://www.googleapis.com/auth/drive.readonly`

## Usage

### Development
```bash
npm run dev
```

### Production
```bash
npm run build
npm start
```

### Docker
```bash
docker build -t google-drive-mcp .
docker run -p 3001:3001 --env-file .env google-drive-mcp
```

## Integration with LibreChat

Update your `librechat.yaml` configuration:

```yaml
mcpServers:
  "Google Drive":
    type: sse
    url: http://localhost:3001/sse
    timeout: 60000
    oauth:
      authorization_url: https://accounts.google.com/o/oauth2/auth
      token_url: https://oauth2.googleapis.com/token
      scope: https://www.googleapis.com/auth/drive.readonly
      client_id: ${GOOGLE_CLIENT_ID}
      client_secret: ${GOOGLE_CLIENT_SECRET}
      redirect_uri: http://localhost:3001/oauth/callback
```

## Available Tools

### 1. List Files (`google_drive_list_files`)
List files and folders in a Google Drive folder.

**Parameters:**
- `folderId` (optional): Folder ID to list (default: root)
- `query` (optional): Search query to filter files
- `maxResults` (optional): Maximum results (default: 50)

### 2. Search Files (`google_drive_search_files`)
Search for files using full-text search.

**Parameters:**
- `query` (required): Search query
- `fileType` (optional): File type filter
- `maxResults` (optional): Maximum results (default: 50)

### 3. Get File Content (`google_drive_get_file_content`)
Read content from Google Drive files.

**Supported formats:**
- Google Docs (exported as text)
- Google Sheets (exported as CSV)
- Google Slides (exported as text)
- Text files (direct download)
- PDF files (metadata only)

**Parameters:**
- `fileId` (required): File ID to read

### 4. Get File Metadata (`google_drive_get_file_metadata`)
Get detailed metadata for a file.

**Parameters:**
- `fileId` (required): File ID

### 5. Create Folder (`google_drive_create_folder`)
Create a new folder in Google Drive.

**Parameters:**
- `name` (required): Folder name
- `parentId` (optional): Parent folder ID (default: root)

### 6. Upload File (`google_drive_upload_file`)
Upload a file to Google Drive.

**Parameters:**
- `name` (required): File name
- `content` (required): File content
- `mimeType` (optional): MIME type (default: text/plain)
- `parentId` (optional): Parent folder ID (default: root)

## Deployment

### Railway Deployment

1. **Create Railway project**
2. **Set environment variables**
3. **Deploy from GitHub**

### Docker Deployment

```bash
# Build image
docker build -t google-drive-mcp .

# Run container
docker run -d \
  --name google-drive-mcp \
  -p 3001:3001 \
  --env-file .env \
  google-drive-mcp
```

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: google-drive-mcp
spec:
  replicas: 1
  selector:
    matchLabels:
      app: google-drive-mcp
  template:
    metadata:
      labels:
        app: google-drive-mcp
    spec:
      containers:
      - name: google-drive-mcp
        image: google-drive-mcp:latest
        ports:
        - containerPort: 3001
        env:
        - name: GOOGLE_CLIENT_ID
          valueFrom:
            secretKeyRef:
              name: google-credentials
              key: client-id
        - name: GOOGLE_CLIENT_SECRET
          valueFrom:
            secretKeyRef:
              name: google-credentials
              key: client-secret
```

## Troubleshooting

### Common Issues

1. **OAuth Error**: Check redirect URI and client credentials
2. **Permission Denied**: Ensure proper Google Drive API scopes
3. **File Not Found**: Verify file ID and permissions
4. **Rate Limiting**: Implement exponential backoff for API calls

### Debug Mode

Enable debug logging:
```bash
DEBUG=* npm run dev
```

## Security Considerations

- Store credentials securely (use environment variables)
- Implement proper CORS policies
- Use HTTPS in production
- Regular credential rotation
- Monitor API usage and quotas

## Contributing

1. Fork the repository
2. Create feature branch
3. Make changes
4. Add tests
5. Submit pull request

## License

MIT License - see LICENSE file for details. # Trigger rebuild for Google Drive MCP debug
