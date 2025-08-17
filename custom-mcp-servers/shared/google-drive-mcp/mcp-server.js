import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';

dotenv.config();

async function start() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // Health
  app.get('/health', (_req, res) => res.json({ status: 'ok', server: 'google-drive-mcp', ts: new Date().toISOString() }));

  // Create MCP server
  const mcp = new Server({ name: 'Google Drive MCP', version: '1.0.0' });

  // Minimal tools so UI appears; real Drive tools can be added after
  mcp.tool(
    'ping',
    {
      description: 'Returns a pong response for health checks',
      inputSchema: { type: 'object', properties: {} },
    },
    async () => ({ content: [{ type: 'text', text: 'pong' }] })
  );

  mcp.tool(
    'info',
    {
      description: 'Describes available Google Drive capabilities',
      inputSchema: { type: 'object', properties: {} },
    },
    async () => ({ content: [{ type: 'text', text: 'Available: list_files, search_files, get_file_content, get_file_metadata (requires OAuth)."' }] })
  );

  // Wire SSE transport at /sse
  const transport = new SSEServerTransport('/sse', app);
  await mcp.connect(transport);

  const port = process.env.PORT || 3001;
  app.listen(port, () => {
    console.log(`MCP (SDK) server listening on ${port}`);
    console.log(`SSE endpoint: http://localhost:${port}/sse`);
  });
}

start().catch((e) => {
  console.error('Failed to start MCP server:', e);
  process.exit(1);
}); 