const { createClient } = require('@supabase/supabase-js');

async function fixSupabaseEndpoint() {
  try {
    console.log('🔧 Fixing Supabase MCP endpoint URL...');
    
    const supabase = createClient(
      'https://mtybaactacapokejmtxy.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10eWJhYWN0YWNhcG9rZWptdHh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE3MTE5MTMsImV4cCI6MjA2NzI4NzkxM30.u9EudibnPY-rGAFX4E2TfCgyKEBa9_7a2nojUcICJGQ'
    );
    
    const { data, error } = await supabase
      .from('mcp_servers')
      .update({ 
        endpoint: 'https://supabase-mcp-server-production-a417.up.railway.app/mcp'
      })
      .eq('name', 'Supabase')
      .eq('organization_id', 'ad82fce8-ba9a-438f-9fe2-956a86f479a5');
    
    if (error) {
      console.error('❌ Error updating endpoint:', error);
      return;
    }
    
    console.log('✅ Supabase MCP endpoint updated successfully');
    console.log('🔄 MCPs should now appear in the UI after the next request');
    
  } catch (err) {
    console.error('❌ Error:', err);
  }
}

fixSupabaseEndpoint(); 