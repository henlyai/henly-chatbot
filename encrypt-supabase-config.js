const crypto = require('crypto');

// Your encryption key
const ENCRYPTION_KEY = '0bc7f44e89c759e546b9f1f10ed05d083a7071d5';

// Your Supabase credentials
const SUPABASE_URL = 'https://mtybaactacapokejmtxy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10eWJhYWN0YWNhcG9rZWptdHh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE3MTE5MTMsImV4cCI6MjA2NzI4NzkxM30.u9EudibnPY-rGAFX4E2TfCgyKEBa9_7a2nojUcICJGQ';

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

console.log('�� Encrypting Supabase credentials...\n');

const encryptedUrl = encryptValue(SUPABASE_URL);
const encryptedKey = encryptValue(SUPABASE_ANON_KEY);

console.log('✅ Encrypted Supabase URL:');
console.log(encryptedUrl);
console.log('\n✅ Encrypted Supabase Anon Key:');
console.log(encryptedKey);

console.log('\n📋 SQL to update your MCP configuration:');
console.log(`
UPDATE mcp_servers 
SET auth_type = 'service_account',
    auth_config = '{
      "supabase_url": "${encryptedUrl}",
      "supabase_key": "${encryptedKey}"
    }'::jsonb
WHERE name = 'Supabase' AND organization_id = 'ad82fce8-ba9a-438f-9fe2-956a86f479a5';
`);

console.log('\n🎯 Complete auth_config JSON:');
console.log(JSON.stringify({
  supabase_url: encryptedUrl,
  supabase_key: encryptedKey
}, null, 2));
