#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

// Test configuration
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
const ORGANIZATION_ID = 'ad82fce8-ba9a-438f-9fe2-956a86f479a5';
const MCP_ENCRYPTION_KEY = '0bc7f44e89c759e546b9f1f10ed05d083a7071d5';

async function testSlackMCPConnection() {
  try {
    console.log('🔍 Testing Slack MCP Connection...\n');

    // Initialize Supabase
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Get MCP server configuration
    console.log('📡 Fetching MCP server configuration...');
    const { data: mcpServer, error } = await supabase
      .from('mcp_servers')
      .select('*')
      .eq('organization_id', ORGANIZATION_ID)
      .eq('name', 'Slack')
      .eq('is_active', true)
      .single();

    if (error) {
      console.error('❌ Error fetching MCP server:', error);
      return;
    }

    if (!mcpServer) {
      console.error('❌ Slack MCP server not found for organization');
      return;
    }

    console.log('✅ MCP server found:', {
      id: mcpServer.id,
      name: mcpServer.name,
      endpoint: mcpServer.endpoint,
      capabilities: mcpServer.capabilities,
      auth_type: mcpServer.auth_type
    });

    // Test token decryption
    console.log('\n🔐 Testing token decryption...');
    const encryptedToken = mcpServer.auth_config?.slack_token;
    
    if (!encryptedToken) {
      console.error('❌ No encrypted token found in auth_config');
      return;
    }

    try {
      // Derive key using scrypt
      const key = crypto.scryptSync(MCP_ENCRYPTION_KEY, 'salt', 32);
      
      // Extract IV and encrypted data
      const parts = encryptedToken.split(':');
      if (parts.length !== 2) {
        throw new Error('Invalid encrypted token format');
      }
      
      const iv = Buffer.from(parts[0], 'hex');
      const encryptedData = Buffer.from(parts[1], 'hex');
      
      // Decrypt
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
      let decrypted = decipher.update(encryptedData, undefined, 'utf8');
      decrypted += decipher.final('utf8');
      
      console.log('✅ Token decrypted successfully');
      console.log('🔑 Token starts with:', decrypted.substring(0, 10) + '...');
      
      // Test Slack API connection
      console.log('\n📡 Testing Slack API connection...');
      const { WebClient } = require('@slack/web-api');
      const client = new WebClient(decrypted);
      
      const authTest = await client.auth.test();
      console.log('✅ Slack API connection successful');
      console.log('👤 Connected as:', authTest.user);
      console.log('🏢 Team:', authTest.team);
      
    } catch (decryptError) {
      console.error('❌ Token decryption failed:', decryptError.message);
      return;
    }

    // Test MCP endpoint
    console.log('\n🌐 Testing MCP endpoint...');
    const response = await fetch(mcpServer.endpoint, {
      method: 'GET',
      headers: {
        'Accept': 'text/event-stream',
        'X-MCP-Client': ORGANIZATION_ID
      }
    });

    if (response.ok) {
      console.log('✅ MCP endpoint responding correctly');
      console.log('📊 Status:', response.status);
      console.log('🔗 Endpoint:', mcpServer.endpoint);
    } else {
      console.error('❌ MCP endpoint error:', response.status, response.statusText);
    }

    console.log('\n🎉 All tests completed successfully!');
    console.log('\n💡 If the Slack MCP still doesn\'t show up in LibreChat:');
    console.log('1. Restart your LibreChat application');
    console.log('2. Check LibreChat logs for any errors');
    console.log('3. Verify the organization ID is correct');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Check if required environment variables are set
if (!SUPABASE_URL || SUPABASE_URL === 'YOUR_SUPABASE_URL') {
  console.error('❌ Please set SUPABASE_URL in the script');
  process.exit(1);
}

if (!SUPABASE_ANON_KEY || SUPABASE_ANON_KEY === 'YOUR_SUPABASE_ANON_KEY') {
  console.error('❌ Please set SUPABASE_ANON_KEY in the script');
  process.exit(1);
}

testSlackMCPConnection(); 