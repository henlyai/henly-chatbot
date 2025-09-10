// Debug script to test MCP loading directly
const { createClient } = require('@supabase/supabase-js');

console.log('=== MCP Loading Debug Script ===');

// Check environment variables
console.log('DEFAULT_ORGANIZATION_ID:', process.env.DEFAULT_ORGANIZATION_ID);
console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'SET' : 'NOT SET');
console.log('SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? 'SET' : 'NOT SET');

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  console.error('❌ Supabase credentials not found!');
  process.exit(1);
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const organizationId = process.env.DEFAULT_ORGANIZATION_ID || 'ad82fce8-ba9a-438f-9fe2-956a86f479a5';

console.log(`\n=== Testing MCP Loading for Organization: ${organizationId} ===`);

async function testMCPLoading() {
  try {
    // Test 1: Check if we can connect to Supabase
    console.log('\n1. Testing Supabase connection...');
    const { data: testData, error: testError } = await supabase
      .from('mcp_servers')
      .select('count')
      .limit(1);
    
    if (testError) {
      console.error('❌ Supabase connection failed:', testError);
      return;
    }
    console.log('✅ Supabase connection successful');

    // Test 2: Get all MCPs for the organization
    console.log('\n2. Fetching MCPs for organization...');
    const { data: mcpServers, error } = await supabase
      .from('mcp_servers')
      .select('id, name, description, endpoint, capabilities, is_active')
      .eq('organization_id', organizationId)
      .eq('is_active', true);

    if (error) {
      console.error('❌ Error fetching MCPs:', error);
      return;
    }

    console.log(`✅ Found ${mcpServers.length} MCP servers`);
    console.log('MCP Names:', mcpServers.map(m => m.name));

    // Test 3: Convert to LibreChat format (like OrganizationMCP.js does)
    console.log('\n3. Converting to LibreChat format...');
    const librechatConfig = {};
    
    for (const server of mcpServers) {
      librechatConfig[server.name] = {
        type: 'sse',
        url: server.endpoint,
        timeout: 60000,
        description: server.description,
        capabilities: server.capabilities || [],
        headers: {
          'X-MCP-Client': organizationId
        }
      };
    }

    console.log('✅ LibreChat config created with keys:', Object.keys(librechatConfig));
    console.log('Full config:', JSON.stringify(librechatConfig, null, 2));

  } catch (err) {
    console.error('❌ Unexpected error:', err);
  }
}

testMCPLoading();
