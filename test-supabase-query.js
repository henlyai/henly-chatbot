const { createClient } = require('@supabase/supabase-js');

// Use the same environment variables as LibreChat
const supabaseUrl = process.env.SUPABASE_URL || 'https://mtybaactacapokejmtxy.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10eWJhYWN0YWNhcG9rZWptdHh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE3MTE5MTMsImV4cCI6MjA2NzI4NzkxM30.u9EudibnPY-rGAFX4E2TfCgyKEBa9_7a2nojUcICJGQ';
const organizationId = process.env.DEFAULT_ORGANIZATION_ID || 'ad82fce8-ba9a-438f-9fe2-956a86f479a5';

console.log('🧪 Testing Supabase MCP Query...\n');
console.log('Environment variables:');
console.log(`SUPABASE_URL: ${supabaseUrl ? 'SET' : 'NOT SET'}`);
console.log(`SUPABASE_ANON_KEY: ${supabaseKey ? 'SET' : 'NOT SET'}`);
console.log(`DEFAULT_ORGANIZATION_ID: ${organizationId}`);
console.log('');

// Create Supabase client (same as LibreChat)
const supabase = createClient(supabaseUrl, supabaseKey);

async function testMCPServerQuery() {
  try {
    console.log(`🔍 Querying MCP servers for organization: ${organizationId}`);
    
    // Exact same query as LibreChat
    const { data: mcpServers, error } = await supabase
      .from('mcp_servers')
      .select('id, name, description, endpoint, capabilities, is_active')
      .eq('organization_id', organizationId)
      .eq('is_active', true);

    if (error) {
      console.error('❌ Supabase query error:', error);
      return;
    }

    console.log('✅ Supabase query successful');
    console.log(`📊 Raw result: ${JSON.stringify(mcpServers, null, 2)}`);
    console.log(`📊 Found ${mcpServers ? mcpServers.length : 0} MCP servers`);

    if (mcpServers && mcpServers.length > 0) {
      console.log('\n📋 MCP Servers found:');
      mcpServers.forEach((server, index) => {
        console.log(`${index + 1}. ${server.name}`);
        console.log(`   ID: ${server.id}`);
        console.log(`   Endpoint: ${server.endpoint}`);
        console.log(`   Active: ${server.is_active}`);
        console.log(`   Capabilities: ${JSON.stringify(server.capabilities)}`);
        console.log('');
      });
    } else {
      console.log('❌ No MCP servers found in database');
      
      // Let's also check what's in the table
      console.log('\n🔍 Checking all records in mcp_servers table...');
      const { data: allServers, error: allError } = await supabase
        .from('mcp_servers')
        .select('*');
      
      if (allError) {
        console.error('❌ Error fetching all servers:', allError);
      } else {
        console.log(`📊 Total records in mcp_servers table: ${allServers.length}`);
        if (allServers.length > 0) {
          console.log('📋 All records:');
          allServers.forEach((server, index) => {
            console.log(`${index + 1}. ${server.name} (org: ${server.organization_id})`);
          });
        }
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testMCPServerQuery(); 