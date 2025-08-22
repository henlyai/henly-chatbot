#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const readline = require('readline');

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Encryption key should be stored in environment variables
const ENCRYPTION_KEY = process.env.MCP_ENCRYPTION_KEY || 'your-encryption-key-32-chars-long!';

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

function encryptValue(value) {
  try {
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(value, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
  } catch (error) {
    console.error('Error encrypting value:', error);
    throw new Error('Failed to encrypt value');
  }
}

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function setupSupabaseMCP() {
  try {
    console.log('🚀 Supabase MCP Setup Script');
    console.log('============================\n');

    // Get organization ID
    const organizationId = await question('Enter your organization ID: ');
    if (!organizationId.trim()) {
      throw new Error('Organization ID is required');
    }

    // Get Railway URL
    const railwayUrl = await question('Enter your Railway deployment URL (e.g., https://supabase-mcp-production.up.railway.app): ');
    if (!railwayUrl.trim()) {
      throw new Error('Railway URL is required');
    }

    // Check if custom Supabase credentials are needed
    const useCustomCredentials = await question('Do you want to use custom Supabase credentials? (y/N): ');
    
    let supabaseUrl = process.env.SUPABASE_URL;
    let supabaseKey = process.env.SUPABASE_ANON_KEY;
    
    if (useCustomCredentials.toLowerCase() === 'y' || useCustomCredentials.toLowerCase() === 'yes') {
      supabaseUrl = await question('Enter your custom Supabase URL: ');
      supabaseKey = await question('Enter your custom Supabase anon key: ');
      
      if (!supabaseUrl.trim() || !supabaseKey.trim()) {
        throw new Error('Custom Supabase credentials are required');
      }
    }

    // Encrypt credentials if custom ones are provided
    let authConfig = {};
    if (useCustomCredentials.toLowerCase() === 'y' || useCustomCredentials.toLowerCase() === 'yes') {
      const encryptedUrl = encryptValue(supabaseUrl);
      const encryptedKey = encryptValue(supabaseKey);
      
      authConfig = {
        supabase_url: encryptedUrl,
        supabase_key: encryptedKey
      };
    }

    console.log('\n📝 Configuration Summary:');
    console.log(`Organization ID: ${organizationId}`);
    console.log(`Railway URL: ${railwayUrl}`);
    console.log(`Using custom credentials: ${useCustomCredentials.toLowerCase() === 'y' || useCustomCredentials.toLowerCase() === 'yes' ? 'Yes' : 'No'}`);

    const confirm = await question('\nProceed with this configuration? (y/N): ');
    if (confirm.toLowerCase() !== 'y' && confirm.toLowerCase() !== 'yes') {
      console.log('❌ Setup cancelled');
      return;
    }

    // Insert or update MCP server configuration
    const { data: existingServer, error: checkError } = await supabase
      .from('mcp_servers')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('name', 'Supabase')
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      throw new Error(`Error checking existing configuration: ${checkError.message}`);
    }

    const mcpConfig = {
      name: 'Supabase',
      description: 'Supabase database integration for querying, inserting, updating, and deleting data',
      endpoint: `${railwayUrl}/mcp`,
      capabilities: [
        'supabase_list_tables',
        'supabase_describe_table', 
        'supabase_query_table',
        'supabase_insert_data',
        'supabase_update_data',
        'supabase_delete_data',
        'supabase_count_records',
        'supabase_get_database_info'
      ],
      organization_id: organizationId,
      is_active: true,
      auth_type: useCustomCredentials.toLowerCase() === 'y' || useCustomCredentials.toLowerCase() === 'yes' ? 'service_account' : 'none',
      auth_config: authConfig
    };

    let result;
    if (existingServer) {
      // Update existing configuration
      const { data, error } = await supabase
        .from('mcp_servers')
        .update(mcpConfig)
        .eq('id', existingServer.id)
        .select();

      if (error) {
        throw new Error(`Error updating MCP server: ${error.message}`);
      }
      result = data;
      console.log('✅ Updated existing Supabase MCP configuration');
    } else {
      // Insert new configuration
      const { data, error } = await supabase
        .from('mcp_servers')
        .insert(mcpConfig)
        .select();

      if (error) {
        throw new Error(`Error inserting MCP server: ${error.message}`);
      }
      result = data;
      console.log('✅ Created new Supabase MCP configuration');
    }

    console.log('\n🎉 Supabase MCP setup completed successfully!');
    console.log('\n📋 Next Steps:');
    console.log('1. Deploy your Supabase MCP server to Railway');
    console.log('2. Test the connection in your LibreChat chatbot');
    console.log('3. Use the Supabase tools to interact with your database');
    
    console.log('\n🛠️ Available Tools:');
    console.log('• supabase_list_tables - Explore database structure');
    console.log('• supabase_describe_table - Get table details');
    console.log('• supabase_query_table - Query data with filtering');
    console.log('• supabase_insert_data - Add new records');
    console.log('• supabase_update_data - Modify existing records');
    console.log('• supabase_delete_data - Remove records');
    console.log('• supabase_count_records - Count records');
    console.log('• supabase_get_database_info - Database information');

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Check environment variables
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  console.error('❌ Error: SUPABASE_URL and SUPABASE_ANON_KEY environment variables are required');
  console.log('\nPlease set these environment variables:');
  console.log('export SUPABASE_URL="your_supabase_url"');
  console.log('export SUPABASE_ANON_KEY="your_supabase_anon_key"');
  console.log('export MCP_ENCRYPTION_KEY="your-32-character-encryption-key"');
  process.exit(1);
}

if (!process.env.MCP_ENCRYPTION_KEY) {
  console.error('❌ Error: MCP_ENCRYPTION_KEY environment variable is required');
  console.log('\nPlease set this environment variable:');
  console.log('export MCP_ENCRYPTION_KEY="your-32-character-encryption-key"');
  process.exit(1);
}

// Run the setup
setupSupabaseMCP();
