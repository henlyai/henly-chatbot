#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

// Encrypt Slack token
function encryptSlackToken(token) {
  try {
    const encryptionKey = process.env.MCP_ENCRYPTION_KEY;
    if (!encryptionKey) {
      throw new Error('MCP_ENCRYPTION_KEY environment variable is required');
    }

    // Derive key using scrypt
    const key = crypto.scryptSync(encryptionKey, 'salt', 32);
    
    // Generate IV
    const iv = crypto.randomBytes(16);
    
    // Encrypt
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(token, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Return IV:encrypted format
    return `${iv.toString('hex')}:${encrypted}`;
  } catch (error) {
    console.error('Error encrypting Slack token:', error);
    throw new Error('Failed to encrypt Slack token');
  }
}

async function setupSlackMCP() {
  try {
    console.log('🚀 Slack MCP Setup Script');
    console.log('========================\n');

    // Get Supabase credentials
    const supabaseUrl = await question('Enter your Supabase URL: ');
    const supabaseAnonKey = await question('Enter your Supabase Anon Key: ');
    
    // Get organization details
    const organizationId = await question('Enter your Organization ID: ');
    const workspaceName = await question('Enter your Slack workspace name: ');
    
    // Get Slack credentials
    const slackBotToken = await question('Enter your Slack Bot Token (xoxb-...): ');
    
    // Validate inputs
    if (!supabaseUrl || !supabaseAnonKey || !organizationId || !workspaceName || !slackBotToken) {
      throw new Error('All fields are required');
    }

    if (!slackBotToken.startsWith('xoxb-')) {
      throw new Error('Invalid Slack bot token format. Should start with xoxb-');
    }

    console.log('\n🔐 Encrypting Slack token...');
    const encryptedToken = encryptSlackToken(slackBotToken);

    console.log('📡 Connecting to Supabase...');
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Check if MCP server already exists
    const { data: existingMCP, error: checkError } = await supabase
      .from('mcp_servers')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('name', 'Slack')
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      throw new Error(`Error checking existing MCP: ${checkError.message}`);
    }

    const mcpConfig = {
      name: 'Slack',
      description: `Slack integration for ${workspaceName} workspace`,
      endpoint: 'https://slack-mcp-server-production-18b7.up.railway.app/mcp',
      capabilities: [
        'slack_list_channels',
        'slack_list_users', 
        'slack_send_message',
        'slack_search_messages',
        'slack_get_channel_history',
        'slack_create_channel',
        'slack_invite_users_to_channel',
        'slack_get_workspace_info'
      ],
      organization_id: organizationId,
      is_active: true,
      auth_type: 'service_account',
      auth_config: {
        slack_token: encryptedToken,
        workspace_name: workspaceName
      }
    };

    let result;
    if (existingMCP) {
      console.log('🔄 Updating existing Slack MCP configuration...');
      result = await supabase
        .from('mcp_servers')
        .update(mcpConfig)
        .eq('id', existingMCP.id);
    } else {
      console.log('➕ Creating new Slack MCP configuration...');
      result = await supabase
        .from('mcp_servers')
        .insert(mcpConfig);
    }

    if (result.error) {
      throw new Error(`Database error: ${result.error.message}`);
    }

    console.log('\n✅ Success! Slack MCP configured successfully!');
    console.log('\n📋 Configuration Summary:');
    console.log(`   Organization ID: ${organizationId}`);
    console.log(`   Workspace: ${workspaceName}`);
    console.log(`   MCP Endpoint: ${mcpConfig.endpoint}`);
    console.log(`   Status: ${existingMCP ? 'Updated' : 'Created'}`);
    
    console.log('\n🎯 Next Steps:');
    console.log('1. Test the Slack MCP in your LibreChat chatbot');
    console.log('2. Try using the slack_list_channels tool');
    console.log('3. Send a test message with slack_send_message');
    
    console.log('\n💡 Available Slack Tools:');
    mcpConfig.capabilities.forEach(tool => {
      console.log(`   - ${tool}`);
    });

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Check for required environment variable
if (!process.env.MCP_ENCRYPTION_KEY) {
  console.error('❌ Error: MCP_ENCRYPTION_KEY environment variable is required');
  console.log('Please set it with: export MCP_ENCRYPTION_KEY="your-32-character-key"');
  process.exit(1);
}

setupSlackMCP(); 