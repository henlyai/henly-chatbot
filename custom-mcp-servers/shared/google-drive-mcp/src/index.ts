import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

class GoogleDriveMCPServer {
  private server: Server;
  private oauth2Client: OAuth2Client;
  private drive: any;

  constructor() {
    this.server = new Server({
      name: 'google-drive-mcp-server',
      version: '1.0.0'
    });

    this.oauth2Client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    this.setupTools();
    this.setupResources();
  }

  private setupTools() {
    // List files tool
    this.server.setRequestHandler('tools/call', async (request) => {
      const { name, arguments: args } = request.params;
      
      try {
        switch (name) {
          case 'list':
            return await this.listFiles(args?.folderId || 'root', args?.maxResults || 50);
          
          case 'search':
            return await this.searchFiles(args?.query || '', args?.maxResults || 50);
          
          case 'getFileContent':
            return await this.getFileContent(args?.fileId);
          
          case 'getFileMetadata':
            return await this.getFileMetadata(args?.fileId);
          
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        throw new Error(`Tool execution failed: ${error.message}`);
      }
    });
  }

  private async listFiles(folderId: string, maxResults: number) {
    if (!this.drive) {
      throw new Error('Not authenticated. Please authenticate first.');
    }

    const response = await this.drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      pageSize: maxResults,
      fields: 'files(id,name,mimeType,size,modifiedTime,webViewLink)'
    });

    return {
      content: response.data.files.map((file: any) => ({
        id: file.id,
        name: file.name,
        type: file.mimeType,
        size: file.size,
        modifiedTime: file.modifiedTime,
        webViewLink: file.webViewLink
      }))
    };
  }

  private async searchFiles(query: string, maxResults: number) {
    if (!this.drive) {
      throw new Error('Not authenticated. Please authenticate first.');
    }

    const response = await this.drive.files.list({
      q: `fullText contains '${query}' and trashed=false`,
      pageSize: maxResults,
      fields: 'files(id,name,mimeType,size,modifiedTime,webViewLink)'
    });

    return {
      content: response.data.files.map((file: any) => ({
        id: file.id,
        name: file.name,
        type: file.mimeType,
        size: file.size,
        modifiedTime: file.modifiedTime,
        webViewLink: file.webViewLink
      }))
    };
  }

  private async getFileContent(fileId: string) {
    if (!this.drive) {
      throw new Error('Not authenticated. Please authenticate first.');
    }

    try {
      // Get file metadata first
      const metadata = await this.drive.files.get({ fileId });
      const mimeType = metadata.data.mimeType;

      let content = '';
      
      if (mimeType === 'application/vnd.google-apps.document') {
        // Google Docs
        const docs = google.docs({ version: 'v1', auth: this.oauth2Client });
        const doc = await docs.documents.get({ documentId: fileId });
        content = this.extractTextFromGoogleDoc(doc.data);
      } else if (mimeType === 'application/vnd.google-apps.spreadsheet') {
        // Google Sheets
        const sheets = google.sheets({ version: 'v4', auth: this.oauth2Client });
        const sheet = await sheets.spreadsheets.get({ spreadsheetId: fileId });
        content = this.extractTextFromGoogleSheet(sheet.data);
      } else if (mimeType === 'application/vnd.google-apps.presentation') {
        // Google Slides
        const slides = google.slides({ version: 'v1', auth: this.oauth2Client });
        const presentation = await slides.presentations.get({ presentationId: fileId });
        content = this.extractTextFromGoogleSlides(presentation.data);
      } else {
        // Regular files (text, PDF, etc.)
        const response = await this.drive.files.get({
          fileId,
          alt: 'media'
        });
        content = response.data;
      }

      return {
        content: {
          id: fileId,
          name: metadata.data.name,
          type: mimeType,
          content: content,
          size: metadata.data.size,
          webViewLink: metadata.data.webViewLink
        }
      };
    } catch (error) {
      throw new Error(`Failed to get file content: ${error.message}`);
    }
  }

  private async getFileMetadata(fileId: string) {
    if (!this.drive) {
      throw new Error('Not authenticated. Please authenticate first.');
    }

    const response = await this.drive.files.get({ fileId });
    
    return {
      content: {
        id: response.data.id,
        name: response.data.name,
        type: response.data.mimeType,
        size: response.data.size,
        modifiedTime: response.data.modifiedTime,
        webViewLink: response.data.webViewLink
      }
    };
  }

  private extractTextFromGoogleDoc(doc: any): string {
    if (!doc.body || !doc.body.content) return '';
    
    let text = '';
    for (const element of doc.body.content) {
      if (element.paragraph && element.paragraph.elements) {
        for (const paraElement of element.paragraph.elements) {
          if (paraElement.textRun) {
            text += paraElement.textRun.content;
          }
        }
        text += '\n';
      }
    }
    return text.trim();
  }

  private extractTextFromGoogleSheet(sheet: any): string {
    if (!sheet.sheets) return '';
    
    let text = '';
    for (const sheetData of sheet.sheets) {
      if (sheetData.properties && sheetData.properties.title) {
        text += `Sheet: ${sheetData.properties.title}\n`;
      }
    }
    return text.trim();
  }

  private extractTextFromGoogleSlides(presentation: any): string {
    if (!presentation.slides) return '';
    
    let text = '';
    for (const slide of presentation.slides) {
      if (slide.pageElements) {
        for (const element of slide.pageElements) {
          if (element.shape && element.shape.text && element.shape.text.textElements) {
            for (const textElement of element.shape.text.textElements) {
              if (textElement.textRun) {
                text += textElement.textRun.content;
              }
            }
          }
        }
      }
      text += '\n---\n';
    }
    return text.trim();
  }

  private setupResources() {
    // Handle gdrive:// URIs
    this.server.setRequestHandler('resources/read', async (request) => {
      const { uri } = request.params;
      
      if (uri.startsWith('gdrive://')) {
        const fileId = uri.replace('gdrive://', '');
        
        try {
          const response = await this.drive.files.get({
            fileId,
            alt: 'media'
          });

          return {
            contents: [{
              uri,
              mimeType: 'text/plain',
              text: response.data
            }]
          };
        } catch (error) {
          throw new Error(`Failed to read file: ${error.message}`);
        }
      }
    });
  }

  async authenticate(accessToken: string) {
    this.oauth2Client.setCredentials({
      access_token: accessToken
    });

    this.drive = google.drive({ version: 'v3', auth: this.oauth2Client });
  }

  async start() {
    // Start HTTP server for OAuth callback
    const app = express();
    app.use(cors());
    app.use(express.json());

    // OAuth callback endpoint
    app.get('/oauth/callback', async (req, res) => {
      const { code } = req.query;
      
      try {
        const { tokens } = await this.oauth2Client.getToken(code as string);
        this.oauth2Client.setCredentials(tokens);
        this.drive = google.drive({ version: 'v3', auth: this.oauth2Client });
        
        res.json({ success: true, access_token: tokens.access_token });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Health check endpoint
    app.get('/health', (req, res) => {
      res.json({ status: 'ok' });
    });

    const port = process.env.PORT || 3001;
    app.listen(port, () => {
      console.log(`Google Drive MCP Server running on port ${port}`);
    });

    // Start MCP server
    const transport = process.env.MCP_TRANSPORT === 'stdio' 
      ? new StdioServerTransport()
      : new SSEServerTransport();

    await this.server.connect(transport);
    console.log('Google Drive MCP Server connected');
  }
}

// Start the server
const server = new GoogleDriveMCPServer();
server.start().catch(console.error); 