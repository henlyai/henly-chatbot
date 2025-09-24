/**
 * Test script to debug LibreChat setup issues
 * Run this to check if agents, prompts, and MCPs are configured correctly
 */

const { createClient } = require('@supabase/supabase-js');

async function testSupabaseConnection() {
  console.log('🔍 Testing Supabase connection...');
  
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  const defaultOrgId = process.env.DEFAULT_ORGANIZATION_ID;
  
  console.log('📋 Environment variables:');
  console.log(`  SUPABASE_URL: ${supabaseUrl ? '✅ Set' : '❌ Missing'}`);
  console.log(`  SUPABASE_ANON_KEY: ${supabaseKey ? '✅ Set' : '❌ Missing'}`);
  console.log(`  DEFAULT_ORGANIZATION_ID: ${defaultOrgId ? '✅ Set' : '❌ Missing'}`);
  
  if (!supabaseUrl || !supabaseKey) {
    console.log('❌ Missing required Supabase environment variables');
    return;
  }
  
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Test basic connection
    const { data, error } = await supabase.from('organizations').select('count').limit(1);
    if (error) {
      console.log('❌ Supabase connection failed:', error.message);
      return;
    }
    console.log('✅ Supabase connection successful');
    
    // Test organization exists
    if (defaultOrgId) {
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('id, name')
        .eq('id', defaultOrgId)
        .single();
        
      if (orgError) {
        console.log(`❌ Default organization ${defaultOrgId} not found:`, orgError.message);
      } else {
        console.log(`✅ Default organization found: ${org.name}`);
      }
      
      // Test MCPs for organization
      const { data: mcps, error: mcpError } = await supabase
        .from('mcp_servers')
        .select('name, is_active')
        .eq('organization_id', defaultOrgId);
        
      if (mcpError) {
        console.log('❌ Error fetching MCPs:', mcpError.message);
      } else {
        console.log(`📡 MCPs found: ${mcps.length}`);
        mcps.forEach(mcp => {
          console.log(`  - ${mcp.name} (${mcp.is_active ? 'active' : 'inactive'})`);
        });
      }
      
      // Test agents for organization
      const { data: agents, error: agentError } = await supabase
        .from('agent_library')
        .select('name, category, is_active')
        .eq('organization_id', defaultOrgId);
        
      if (agentError) {
        console.log('❌ Error fetching agents:', agentError.message);
      } else {
        console.log(`🤖 Agents found: ${agents.length}`);
        agents.forEach(agent => {
          console.log(`  - ${agent.name} (${agent.category}, ${agent.is_active ? 'active' : 'inactive'})`);
        });
      }
      
      // Test prompts for organization
      const { data: prompts, error: promptError } = await supabase
        .from('prompt_library')
        .select('name, category, is_active')
        .eq('organization_id', defaultOrgId);
        
      if (promptError) {
        console.log('❌ Error fetching prompts:', promptError.message);
      } else {
        console.log(`💬 Prompts found: ${prompts.length}`);
        prompts.forEach(prompt => {
          console.log(`  - ${prompt.name} (${prompt.category}, ${prompt.is_active ? 'active' : 'inactive'})`);
        });
      }
    }
    
  } catch (error) {
    console.log('❌ Supabase test failed:', error.message);
  }
}

async function testLibreChatConfig() {
  console.log('\n🔍 Testing LibreChat configuration...');
  
  try {
    // Check if librechat.yaml exists and has required config
    const fs = require('fs');
    const yaml = require('yaml');
    
    if (fs.existsSync('./librechat.yaml')) {
      const config = yaml.parse(fs.readFileSync('./librechat.yaml', 'utf8'));
      
      console.log('📋 LibreChat config:');
      console.log(`  agents: ${config.interface?.agents ? '✅ enabled' : '❌ disabled'}`);
      console.log(`  prompts: ${config.interface?.prompts ? '✅ enabled' : '❌ disabled'}`);
      console.log(`  mcpServers: ${config.interface?.mcpServers ? '✅ enabled' : '❌ disabled'}`);
      console.log(`  agentsTab: ${config.interface?.agentsTab ? '✅ enabled' : '❌ disabled'}`);
      console.log(`  promptsTab: ${config.interface?.promptsTab ? '✅ enabled' : '❌ disabled'}`);
      
      if (config.endpoints?.agents) {
        console.log('🤖 Agents endpoint configured:');
        console.log(`  disableBuilder: ${config.endpoints.agents.disableBuilder ? '❌ disabled' : '✅ enabled'}`);
        console.log(`  capabilities: ${config.endpoints.agents.capabilities?.join(', ') || 'default'}`);
      } else {
        console.log('❌ Agents endpoint not configured');
      }
      
    } else {
      console.log('❌ librechat.yaml not found');
    }
    
  } catch (error) {
    console.log('❌ LibreChat config test failed:', error.message);
  }
}

async function main() {
  console.log('🚀 LibreChat Debug Test Starting...\n');
  
  await testSupabaseConnection();
  await testLibreChatConfig();
  
  console.log('\n✅ Debug test completed');
  console.log('\n💡 Next steps:');
  console.log('1. Check Railway logs for debug output after deployment');
  console.log('2. Verify organization ID matches between website and chatbot');
  console.log('3. Ensure Supabase RLS policies allow access to resources');
  console.log('4. Check browser network tab for failed API calls');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testSupabaseConnection, testLibreChatConfig };
