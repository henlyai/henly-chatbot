#!/usr/bin/env node

/**
 * Setup Script for First Google Drive Client
 * This script helps you set up Google Drive MCP for your first client
 */

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const fs = require('fs');
const readline = require('readline');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Encryption key
const ENCRYPTION_KEY = process.env.MCP_ENCRYPTION_KEY || 'your-encryption-key-32-chars-long!';

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

function encryptServiceAccountKey(serviceAccountKey) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipher('aes-256-cbc', ENCRYPTION_KEY);
  
  let encrypted = cipher.update(serviceAccountKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return iv.toString('hex') + ':' + encrypted;
}

async function setupFirstClient() {
  console.log('🚀 Google Drive MCP Client Setup');
  console.log('================================\n');

  try {
    // Get organization ID
    const organizationId = await question('Enter your organization ID: ');
    if (!organizationId) {
      throw new Error('Organization ID is required');
    }

    // Get service account key file path
    const keyFilePath = await question('Enter path to your service account key JSON file: ');
    if (!keyFilePath) {
      throw new Error('Service account key file path is required');
    }

    // Read and validate service account key
    let serviceAccountKey;
    try {
      serviceAccountKey = fs.readFileSync(keyFilePath, 'utf8');
      const credentials = JSON.parse(serviceAccountKey);
      
      // Validate required fields
      const requiredFields = ['type', 'project_id', 'private_key_id', 'private_key', 'client_email'];
      for (const field of requiredFields) {
        if (!credentials[field]) {
          throw new Error(`Missing required field: ${field}`);
        }
      }
      
      console.log(`✅ Service account key validated for: ${credentials.client_email}`);
    } catch (error) {
      throw new Error(`Invalid service account key file: ${error.message}`);
    }

    // Get Google Drive folder ID
    const folderId = await question('Enter Google Drive folder ID (or press Enter for root): ');
    const targetFolderId = folderId || 'root';

    // Encrypt service account key
    const encryptedKey = encryptServiceAccountKey(serviceAccountKey);

    // Prepare auth config
    const authConfig = {
      service_account_key: encryptedKey,
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
      client_email: JSON.parse(serviceAccountKey).client_email
    };

    console.log('\n📝 Setting up Google Drive MCP server...');

    // Insert or update MCP server configuration
    const { data, error } = await supabase
      .from('mcp_servers')
      .upsert({
        name: 'Google Drive',
        description: 'Access Google Drive files and folders with full content reading capabilities',
        endpoint: 'https://mcp-servers-production-c189.up.railway.app/mcp',
        capabilities: ['search_file', 'list_files', 'get_file_metadata', 'read_content'],
        organization_id: organizationId,
        auth_type: 'service_account',
        auth_config: authConfig,
        google_drive_folder_id: targetFolderId,
        is_active: true
      }, {
        onConflict: 'name,organization_id'
      });

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    console.log('✅ Google Drive MCP server configured successfully!');
    console.log('\n📋 Configuration Summary:');
    console.log(`   Organization ID: ${organizationId}`);
    console.log(`   Service Account: ${authConfig.client_email}`);
    console.log(`   Drive Folder: ${targetFolderId}`);
    console.log(`   Endpoint: https://mcp-servers-production-c189.up.railway.app/mcp`);

    // Verify configuration
    console.log('\n🔍 Verifying configuration...');
    const { data: verifyData, error: verifyError } = await supabase
      .from('mcp_servers')
      .select('name, auth_type, google_drive_folder_id, is_active')
      .eq('organization_id', organizationId)
      .eq('name', 'Google Drive')
      .single();

    if (verifyError || !verifyData) {
      throw new Error('Configuration verification failed');
    }

    console.log('✅ Configuration verified successfully!');
    console.log('\n🎉 Setup complete! Your Google Drive MCP is ready to use.');
    console.log('\n📝 Next steps:');
    console.log('1. Deploy the updated MCP server to Railway');
    console.log('2. Test Google Drive access in your chatbot');
    console.log('3. Try searching for files in your Google Drive');

  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Check environment variables
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('   - SUPABASE_URL');
  console.error('   - SUPABASE_ANON_KEY');
  console.error('\nPlease set these environment variables and try again.');
  process.exit(1);
}

// Run setup
setupFirstClient(); 