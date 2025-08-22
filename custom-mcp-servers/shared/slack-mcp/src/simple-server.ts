import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

console.log('🚀 Starting Simple Slack MCP Server...');

// Create a simple MCP server instance for testing
const server = new McpServer(
  {
    name: 'slack-mcp-server-simple',
    version: '1.0.0'
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

// Simple test tool
server.tool('test_slack_connection', 'Test the Slack MCP connection', {
  message: z.string().optional().describe('Optional test message')
}, async ({ message = 'Hello from Slack MCP!' }, context) => {
  try {
    console.log('🧪 Testing Slack MCP connection...');
    
    return {
      content: [
        {
          type: 'text',
          text: `✅ Slack MCP Server is working!\n\nTest message: "${message}"\n\nThis is a simple test implementation. For full functionality, use the main server with Supabase integration.`
        }
      ]
    };
  } catch (error) {
    console.error(`❌ Error in test_slack_connection: ${error}`);
    return {
      content: [
        {
          type: 'text',
          text: `Error testing connection: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      ]
    };
  }
});

// List channels tool (mock)
server.tool('list_channels', 'List all channels in the Slack workspace (mock)', {
  includePrivate: z.boolean().optional().describe('Include private channels (default: true)').default(true),
  includeArchived: z.boolean().optional().describe('Include archived channels (default: false)').default(false)
}, async ({ includePrivate, includeArchived }, context) => {
  try {
    console.log('📋 Mock listing channels...');
    
    const mockChannels = [
      { id: 'C1234567890', name: 'general', is_private: false, is_archived: false, num_members: 25 },
      { id: 'C1234567891', name: 'random', is_private: false, is_archived: false, num_members: 15 },
      { id: 'C1234567892', name: 'private-channel', is_private: true, is_archived: false, num_members: 8 },
      { id: 'C1234567893', name: 'archived-channel', is_private: false, is_archived: true, num_members: 5 }
    ];
    
    let filteredChannels = mockChannels;
    if (!includePrivate) {
      filteredChannels = filteredChannels.filter(channel => !channel.is_private);
    }
    if (!includeArchived) {
      filteredChannels = filteredChannels.filter(channel => !channel.is_archived);
    }

    const channelList = filteredChannels.map(channel => 
      `#${channel.name} (${channel.id}) - ${channel.is_private ? 'Private' : 'Public'}${channel.is_archived ? ' - Archived' : ''} - ${channel.num_members} members`
    ).join('\n');

    return {
      content: [
        {
          type: 'text',
          text: `📋 Mock Slack Channels (${filteredChannels.length} channels):\n\n${channelList}\n\n💡 This is a mock response. Use the full server for real Slack integration.`
        }
      ]
    };
  } catch (error) {
    console.error(`❌ Error in list_channels: ${error}`);
    return {
      content: [
        {
          type: 'text',
          text: `Error listing channels: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      ]
    };
  }
});

// Send message tool (mock)
server.tool('send_message', 'Send a message to a Slack channel or user (mock)', {
  channel: z.string().describe('Channel ID or user ID to send message to'),
  message: z.string().describe('Message text to send'),
  threadTs: z.string().optional().describe('Thread timestamp to reply to a specific message')
}, async ({ channel, message, threadTs }, context) => {
  try {
    console.log(`💬 Mock sending message to ${channel}...`);
    
    const timestamp = Date.now() / 1000;
    const threadInfo = threadTs ? ` (reply to ${threadTs})` : '';
    
    return {
      content: [
        {
          type: 'text',
          text: `✅ Mock message sent successfully!\n\nChannel: ${channel}\nMessage: "${message}"${threadInfo}\nTimestamp: ${timestamp}\n\n💡 This is a mock response. Use the full server for real Slack integration.`
        }
      ]
    };
  } catch (error) {
    console.error(`❌ Error in send_message: ${error}`);
    return {
      content: [
        {
          type: 'text',
          text: `Error sending message: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      ]
    };
  }
});

// Search messages tool (mock)
server.tool('search_messages', 'Search for messages in Slack channels (mock)', {
  query: z.string().describe('Search query to find messages'),
  channel: z.string().optional().describe('Specific channel ID to search in (optional)'),
  limit: z.number().optional().describe('Maximum number of results (default: 20)').default(20)
}, async ({ query, channel, limit }, context) => {
  try {
    console.log(`🔍 Mock searching messages for "${query}"...`);
    
    const mockMessages = [
      { username: 'john.doe', channel: { name: 'general' }, text: `Found a message about ${query}`, ts: '1703123456.789' },
      { username: 'jane.smith', channel: { name: 'random' }, text: `Another message mentioning ${query}`, ts: '1703123455.123' },
      { username: 'bot.user', channel: { name: 'general' }, text: `Automated message with ${query}`, ts: '1703123454.456' }
    ];
    
    const filteredMessages = channel 
      ? mockMessages.filter(msg => msg.channel.name === channel)
      : mockMessages;
    
    const limitedMessages = filteredMessages.slice(0, limit);
    
    const messageList = limitedMessages.map(msg => 
      `📝 ${msg.username} in #${msg.channel.name} at ${new Date(parseFloat(msg.ts) * 1000).toLocaleString()}:\n"${msg.text}"\n`
    ).join('\n');

    return {
      content: [
        {
          type: 'text',
          text: `🔍 Mock search results for "${query}" (${limitedMessages.length} messages):\n\n${messageList}\n\n💡 This is a mock response. Use the full server for real Slack integration.`
        }
      ]
    };
  } catch (error) {
    console.error(`❌ Error in search_messages: ${error}`);
    return {
      content: [
        {
          type: 'text',
          text: `Error searching messages: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      ]
    };
  }
});

// Get workspace info tool (mock)
server.tool('get_workspace_info', 'Get information about the Slack workspace (mock)', {}, async (_, context) => {
  try {
    console.log('🏢 Mock getting workspace info...');
    
    const workspaceInfo = `
🏢 **Mock Workspace Information**
Name: Test Slack Workspace
Domain: test-workspace
Description: A test workspace for development
Created: January 1, 2024

👤 **Current User**
Name: test-bot
Team: Test Team
User ID: U1234567890

📊 **Workspace Stats**
Channels: 15
Users: 50
Active Users: 35

💡 This is mock data. Use the full server for real Slack integration.
`;

    return {
      content: [
        {
          type: 'text',
          text: workspaceInfo
        }
      ]
    };
  } catch (error) {
    console.error(`❌ Error in get_workspace_info: ${error}`);
    return {
      content: [
        {
          type: 'text',
          text: `Error getting workspace info: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      ]
    };
  }
});

// Connect to stdio transport for testing
const transport = new StdioServerTransport();
server.connect(transport);

console.log('✅ Simple Slack MCP Server ready for testing');
console.log('💡 Use this for development and testing. For production, use the main server with Supabase integration.'); 