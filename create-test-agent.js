/**
 * Script to create a test agent in the agent_library table
 */

const { createClient } = require('@supabase/supabase-js');

// You'll need to set these environment variables or replace with actual values
const supabaseUrl = process.env.SUPABASE_URL || 'https://mtybaactacapokejmtxy.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createTestAgent() {
  console.log('Creating test agent...');
  
  const testAgent = {
    id: 'henly-sales-assistant',
    name: 'Henly Sales Assistant',
    description: 'A professional sales assistant for Henly AI that helps create proposals and manage client relationships.',
    instructions: 'You are a professional sales assistant for Henly AI. Help users create compelling proposals, manage client relationships, and provide sales support. Focus on understanding client needs and crafting tailored solutions.',
    organization_id: 'ad82fce8-ba9a-438f-9fe2-956a86f479a5', // Henly AI organization ID
    model: 'gpt-4',
    provider: 'openai',
    tools: ['web_search', 'file_search'],
    conversation_starters: [
      'Create a proposal for a new client opportunity',
      'Help me understand our client\'s requirements',
      'Generate a sales follow-up email',
      'Analyze our competitive advantages'
    ],
    model_parameters: {
      temperature: 0.7,
      max_tokens: 2000
    },
    avatar_url: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  try {
    const { data, error } = await supabase
      .from('agent_library')
      .insert([testAgent])
      .select();

    if (error) {
      console.error('Error creating test agent:', error);
    } else {
      console.log('✅ Test agent created successfully:', data);
    }
  } catch (err) {
    console.error('Exception creating test agent:', err);
  }
}

createTestAgent();
