import { createClient } from '@supabase/supabase-js';
import { GoogleAuth } from 'google-auth-library';
import { google } from 'googleapis';
import crypto from 'crypto';

// Environment variables (you'll need to set these)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const MCP_ENCRYPTION_KEY = process.env.MCP_ENCRYPTION_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !MCP_ENCRYPTION_KEY) {
  console.error('❌ Missing environment variables. Please set SUPABASE_URL, SUPABASE_ANON_KEY, and MCP_ENCRYPTION_KEY');
  process.exit(1);
}

// Initialize Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Decrypt service account key
function decryptServiceAccountKey(encryptedKey) {
  const algorithm = 'aes-256-cbc';
  const key = Buffer.from(MCP_ENCRYPTION_KEY, 'hex');
  const iv = Buffer.from(encryptedKey.substring(0, 32), 'hex');
  const encrypted = encryptedKey.substring(32);
  
  const decipher = crypto.createDecipher(algorithm, key);
  decipher.setAutoPadding(false);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  // Remove PKCS7 padding
  const paddingLength = decrypted.charCodeAt(decrypted.length - 1);
  return decrypted.substring(0, decrypted.length - paddingLength);
}

async function testFileTypes() {
  try {
    console.log('🔍 Testing file types for organization...');
    
    // Get MCP server configuration
    const { data: mcpServer, error } = await supabase
      .from('mcp_servers')
      .select('*')
      .eq('organization_id', 'ad82fce8-ba9a-438f-9fe2-956a86f479a5') // Your organization ID
      .eq('name', 'Google Drive')
      .eq('is_active', true)
      .single();

    if (error || !mcpServer) {
      throw new Error('Google Drive not configured for organization');
    }

    // Decrypt service account key
    const serviceAccountKey = decryptServiceAccountKey(
      mcpServer.auth_config.service_account_key
    );
    const credentials = JSON.parse(serviceAccountKey);
    
    // Initialize Google Drive client
    const auth = new GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive.readonly']
    });
    const drive = google.drive({ version: 'v3', auth });

    // Test specific file IDs from your response
    const testFiles = [
      { name: 'ScaleWize AI Finances.xlsx', id: '1x9js_FQ5WHrqcFbZw_lV0cj5zD67vxZw' },
      { name: 'Support_Tickets_Summary.xlsx', id: '1zzHLgAN1NJcWilVi7KyacrUgKP4iY9t1' },
      { name: 'Product Roadmap 2025.docx', id: '1zMfcDbnpUIkr83VollycccfjA9tIcltE' },
      { name: 'Product_Metrics_Dashboard.xlsx', id: '163JVsdMHiiDmKKNe_mPTEifdtid4O9_P' }
    ];

    console.log('\n📋 Testing file types:');
    console.log('=' .repeat(60));

    for (const file of testFiles) {
      try {
        const response = await drive.files.get({
          fileId: file.id,
          fields: 'id,name,mimeType,size,webViewLink'
        });

        const fileData = response.data;
        const sizeInMB = fileData.size ? (parseInt(fileData.size) / (1024 * 1024)).toFixed(2) : 'Unknown';
        
        console.log(`\n📄 ${fileData.name}`);
        console.log(`   ID: ${fileData.id}`);
        console.log(`   MIME Type: ${fileData.mimeType}`);
        console.log(`   Size: ${sizeInMB} MB`);
        console.log(`   Web Link: ${fileData.webViewLink}`);
        
        // Determine if it's readable
        if (fileData.mimeType === 'application/vnd.google-apps.document') {
          console.log(`   ✅ Readable: Google Doc`);
        } else if (fileData.mimeType === 'application/vnd.google-apps.spreadsheet') {
          console.log(`   ✅ Readable: Google Sheet`);
        } else if (fileData.mimeType.startsWith('text/') || fileData.mimeType === 'application/json') {
          console.log(`   ✅ Readable: Text file`);
        } else {
          console.log(`   ❌ Not readable: ${fileData.mimeType}`);
        }

      } catch (error) {
        console.log(`\n❌ Error testing ${file.name}: ${error.message}`);
      }
    }

    console.log('\n✅ File type testing complete!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testFileTypes(); 