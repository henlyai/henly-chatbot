#!/usr/bin/env node

/**
 * Setup script for Slack MCP Server
 * This script helps configure the first Slack MCP client for an organization
 */

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ad82fce8-ba9a-438f-9fe2-956a86f479a5.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const ENCRYPTION_KEY = process.env.MCP_ENCRYPTION_KEY || 'your-encryption-key-32-chars-long!';

if (!SUPABASE_ANON_KEY) {
  console.error('❌ SUPABASE_ANON_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Helper function to encrypt Slack token
function encryptSlackToken(token) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipher('aes-256-cbc', ENCRYPTION_KEY);
  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return `${iv.toString('hex')}:${encrypted}`;
}

// Helper function to prompt for input
function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function setupSlackMCP() {
  console.log('🚀 Slack MCP Server Setup');
  console.log('========================\n');

  try {
    // Get organization ID
    const organizationId = await question('Enter the organization ID: ');
    if (!organizationId) {
      console.error('❌ Organization ID is required');
      process.exit(1);
    }

    // Get Slack Bot Token
    const slackToken = await question('Enter the Slack Bot Token (xoxb-...): ');
    if (!slackToken || !slackToken.startsWith('xoxb-')) {
      console.error('❌ Valid Slack Bot Token is required (should start with xoxb-)');
      process.exit(1);
    }

    // Get Slack workspace name
    const workspaceName = await question('Enter the Slack workspace name (optional): ') || 'Slack Workspace';

    // Get Railway deployment URL
    const railwayUrl = await question('Enter the Railway deployment URL (e.g., https://slack-mcp-production.up.railway.app): ');
    if (!railwayUrl) {
      console.error('❌ Railway deployment URL is required');
      process.exit(1);
    }

    // Encrypt the Slack token
    const encryptedToken = encryptSlackToken(slackToken);

    // Prepare MCP server configuration
    const mcpServerConfig = {
      name: 'Slack',
      description: `Slack integration for ${workspaceName}`,
      endpoint: `${railwayUrl}/mcp`,
      capabilities: [
        'list_channels',
        'list_users', 
        'send_message',
        'search_messages',
        'get_channel_history',
        'create_channel',
        'invite_users_to_channel',
        'get_workspace_info'
      ],
      organization_id: organizationId,
      is_active: true,
      auth_type: 'service_account',
      auth_config: {
        slack_token: encryptedToken,
        workspace_name: workspaceName
      }
    };

    console.log('\n📋 Configuration Summary:');
    console.log(`Organization ID: ${organizationId}`);
    console.log(`Workspace Name: ${workspaceName}`);
    console.log(`Railway URL: ${railwayUrl}`);
    console.log(`Token Encrypted: ✅`);
    console.log(`Capabilities: ${mcpServerConfig.capabilities.length} tools`);

    const confirm = await question('\nProceed with this configuration? (y/N): ');
    if (confirm.toLowerCase() !== 'y') {
      console.log('❌ Setup cancelled');
      process.exit(0);
    }

    // Insert into Supabase
    console.log('\n🔄 Inserting configuration into Supabase...');
    
    const { data, error } = await supabase
      .from('mcp_servers')
      .insert([mcpServerConfig])
      .select();

    if (error) {
      console.error('❌ Error inserting configuration:', error);
      process.exit(1);
    }

    console.log('✅ Slack MCP configuration created successfully!');
    console.log(`📊 MCP Server ID: ${data[0].id}`);
    
    console.log('\n🎉 Setup Complete!');
    console.log('\nNext steps:');
    console.log('1. Deploy the Slack MCP server to Railway');
    console.log('2. Test the connection in LibreChat');
    console.log('3. Verify the tools appear in the chatbot UI');
    
    console.log('\n📚 Documentation:');
    console.log('- Slack API Documentation: https://api.slack.com/');
    console.log('- MCP Protocol: https://modelcontextprotocol.io/');
    console.log('- Henley AI Documentation: Check your project docs');

  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Run the setup
setupSlackMCP(); 