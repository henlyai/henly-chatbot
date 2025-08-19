const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://mtybaactacapokejmtxy.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10eWJhYWN0YWNhcG9rZWptdHh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE3MTE5MTMsImV4cCI6MjA2NzI4NzkxM30.u9EudibnPY-rGAFX4E2TfCgyKEBa9_7a2nojUcICJGQ';

console.log('🧪 Testing Supabase Permissions...\n');

const supabase = createClient(supabaseUrl, supabaseKey);

async function testPermissions() {
  try {
    console.log('1. Testing general connectivity...');
    
    // Test if we can connect at all
    const { data: testData, error: testError } = await supabase
      .from('mcp_servers')
      .select('count', { count: 'exact', head: true });
    
    if (testError) {
      console.error('❌ Cannot access mcp_servers table:', testError);
      
      // Check if it's an RLS issue
      if (testError.code === 'PGRST116' || testError.message.includes('RLS')) {
        console.log('🔒 This appears to be a Row Level Security (RLS) issue');
      }
      
      return;
    }
    
    console.log(`✅ Can access mcp_servers table. Row count: ${testData}`);
    
    console.log('\n2. Testing without filters...');
    const { data: allData, error: allError } = await supabase
      .from('mcp_servers')
      .select('*');
    
    if (allError) {
      console.error('❌ Cannot select all from mcp_servers:', allError);
      return;
    }
    
    console.log(`📊 Total accessible records: ${allData.length}`);
    if (allData.length > 0) {
      console.log('📋 Records found:');
      allData.forEach((record, index) => {
        console.log(`${index + 1}. ${record.name} (org: ${record.organization_id}, active: ${record.is_active})`);
      });
    }
    
    console.log('\n3. Testing with organization_id filter...');
    const { data: orgData, error: orgError } = await supabase
      .from('mcp_servers')
      .select('*')
      .eq('organization_id', 'ad82fce8-ba9a-438f-9fe2-956a86f479a5');
    
    if (orgError) {
      console.error('❌ Cannot filter by organization_id:', orgError);
      return;
    }
    
    console.log(`📊 Records for organization ad82fce8-ba9a-438f-9fe2-956a86f479a5: ${orgData.length}`);
    
    console.log('\n4. Testing with active filter...');
    const { data: activeData, error: activeError } = await supabase
      .from('mcp_servers')
      .select('*')
      .eq('is_active', true);
    
    if (activeError) {
      console.error('❌ Cannot filter by is_active:', activeError);
      return;
    }
    
    console.log(`📊 Active records: ${activeData.length}`);
    
    console.log('\n5. Testing exact LibreChat query...');
    const { data: exactData, error: exactError } = await supabase
      .from('mcp_servers')
      .select('id, name, description, endpoint, capabilities, is_active')
      .eq('organization_id', 'ad82fce8-ba9a-438f-9fe2-956a86f479a5')
      .eq('is_active', true);
    
    if (exactError) {
      console.error('❌ Exact LibreChat query failed:', exactError);
      return;
    }
    
    console.log(`📊 Exact LibreChat query result: ${exactData.length} records`);
    console.log(`📊 Raw result: ${JSON.stringify(exactData, null, 2)}`);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testPermissions(); 