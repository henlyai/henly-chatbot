import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

dotenv.config();

class SimpleGoogleDriveServer {
  constructor() {
    this.oauth2Client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
  }

  async start() {
    const app = express();
    app.use(cors());
    app.use(express.json());

    // Health check endpoint
    app.get('/health', (req, res) => {
      res.json({ 
        status: 'ok',
        message: 'Google Drive MCP Server is running',
        timestamp: new Date().toISOString()
      });
    });

    // OAuth callback endpoint
    app.get('/oauth/callback', async (req, res) => {
      const { code } = req.query;
      
      try {
        const { tokens } = await this.oauth2Client.getToken(code);
        this.oauth2Client.setCredentials(tokens);
        this.drive = google.drive({ version: 'v3', auth: this.oauth2Client });
        
        res.json({ 
          success: true, 
          access_token: tokens.access_token,
          message: 'Authentication successful'
        });
      } catch (error) {
        console.error('OAuth error:', error);
        res.status(500).json({ 
          error: error instanceof Error ? error.message : 'Unknown error',
          message: 'Authentication failed'
        });
      }
    });

    // List files endpoint
    app.get('/api/files', async (req, res) => {
      try {
        if (!this.drive) {
          return res.status(401).json({ error: 'Not authenticated' });
        }

        const { folderId = 'root', maxResults = 50 } = req.query;
        
        const response = await this.drive.files.list({
          q: `'${folderId}' in parents and trashed=false`,
          pageSize: Number(maxResults),
          fields: 'files(id,name,mimeType,size,modifiedTime,webViewLink)'
        });

        res.json({
          success: true,
          files: response.data.files.map((file) => ({
            id: file.id,
            name: file.name,
            type: file.mimeType,
            size: file.size,
            modifiedTime: file.modifiedTime,
            webViewLink: file.webViewLink
          }))
        });
      } catch (error) {
        console.error('List files error:', error);
        res.status(500).json({ 
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Search files endpoint
    app.get('/api/search', async (req, res) => {
      try {
        if (!this.drive) {
          return res.status(401).json({ error: 'Not authenticated' });
        }

        const { query, maxResults = 50 } = req.query;
        
        if (!query) {
          return res.status(400).json({ error: 'Query parameter is required' });
        }

        const response = await this.drive.files.list({
          q: `fullText contains '${query}' and trashed=false`,
          pageSize: Number(maxResults),
          fields: 'files(id,name,mimeType,size,modifiedTime,webViewLink)'
        });

        res.json({
          success: true,
          files: response.data.files.map((file) => ({
            id: file.id,
            name: file.name,
            type: file.mimeType,
            size: file.size,
            modifiedTime: file.modifiedTime,
            webViewLink: file.webViewLink
          }))
        });
      } catch (error) {
        console.error('Search files error:', error);
        res.status(500).json({ 
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Get file content endpoint
    app.get('/api/files/:fileId/content', async (req, res) => {
      try {
        if (!this.drive) {
          return res.status(401).json({ error: 'Not authenticated' });
        }

        const { fileId } = req.params;

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

        res.json({
          success: true,
          file: {
            id: fileId,
            name: metadata.data.name,
            type: mimeType,
            content: content,
            size: metadata.data.size,
            webViewLink: metadata.data.webViewLink
          }
        });
      } catch (error) {
        console.error('Get file content error:', error);
        res.status(500).json({ 
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Get file metadata endpoint
    app.get('/api/files/:fileId/metadata', async (req, res) => {
      try {
        if (!this.drive) {
          return res.status(401).json({ error: 'Not authenticated' });
        }

        const { fileId } = req.params;
        const response = await this.drive.files.get({ fileId });

        res.json({
          success: true,
          file: {
            id: response.data.id,
            name: response.data.name,
            type: response.data.mimeType,
            size: response.data.size,
            modifiedTime: response.data.modifiedTime,
            webViewLink: response.data.webViewLink
          }
        });
      } catch (error) {
        console.error('Get file metadata error:', error);
        res.status(500).json({ 
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // OAuth authorization endpoint
    app.get('/oauth/authorize', (req, res) => {
      const authUrl = this.oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: [
          'https://www.googleapis.com/auth/drive.readonly',
          'https://www.googleapis.com/auth/drive.file',
          'https://www.googleapis.com/auth/drive.metadata.readonly'
        ]
      });
      res.redirect(authUrl);
    });

    // SSE endpoint for MCP communication
    app.get('/sse', (req, res) => {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });

      // Send initial connection message
      res.write('data: {"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2024-11-05","capabilities":{"tools":{},"resources":{}},"serverInfo":{"name":"Google Drive MCP Server","version":"1.0.0"}}}\n\n');

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
      console.log(`🚀 Simple Google Drive Server running on port ${port}`);
      console.log(`📊 Health check: http://localhost:${port}/health`);
      console.log(`🔐 OAuth authorize: http://localhost:${port}/oauth/authorize`);
      console.log(`📁 List files: http://localhost:${port}/api/files`);
      console.log(`🔍 Search files: http://localhost:${port}/api/search?query=test`);
    });
  }

  extractTextFromGoogleDoc(doc) {
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

  extractTextFromGoogleSheet(sheet) {
    if (!sheet.sheets) return '';

    let text = '';
    for (const sheetData of sheet.sheets) {
      if (sheetData.properties && sheetData.properties.title) {
        text += `Sheet: ${sheetData.properties.title}\n`;
      }
    }
    return text.trim();
  }

  extractTextFromGoogleSlides(presentation) {
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
}

// Start the server
const server = new SimpleGoogleDriveServer();
server.start().catch(console.error); 