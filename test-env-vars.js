// Test script to check environment variables
console.log('=== Environment Variables Test ===');
console.log('DEFAULT_ORGANIZATION_ID:', process.env.DEFAULT_ORGANIZATION_ID);
console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'SET' : 'NOT SET');
console.log('SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? 'SET' : 'NOT SET');
console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'SET' : 'NOT SET');

// Test Supabase connection
if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
  
  console.log('\n=== Testing Supabase Connection ===');
  supabase
    .from('mcp_servers')
    .select('name, organization_id')
    .eq('organization_id', process.env.DEFAULT_ORGANIZATION_ID || 'ad82fce8-ba9a-438f-9fe2-956a86f479a5')
    .then(({ data, error }) => {
      if (error) {
        console.error('Supabase error:', error);
      } else {
        console.log('Found MCPs:', data?.length || 0);
        console.log('MCP names:', data?.map(m => m.name) || []);
      }
    });
} else {
  console.log('Supabase credentials not available');
}
