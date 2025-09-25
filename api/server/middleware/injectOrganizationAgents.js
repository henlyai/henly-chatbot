/**
 * MCP-style middleware to inject organization agents into LibreChat responses
 * This is MUCH simpler than replacing the entire data layer
 */

const { createClient } = require('@supabase/supabase-js');
const { logger } = require('@librechat/data-schemas');

    // Use service role key for server-side operations to bypass RLS
    console.log('[AgentInjection] Environment variables check:', {
      hasSupabaseUrl: !!process.env.SUPABASE_URL,
      hasSupabaseAnonKey: !!process.env.SUPABASE_ANON_KEY,
      hasSupabaseServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      serviceRoleKeyLength: process.env.SUPABASE_SERVICE_ROLE_KEY ? process.env.SUPABASE_SERVICE_ROLE_KEY.length : 0,
      serviceRoleKeyPrefix: process.env.SUPABASE_SERVICE_ROLE_KEY ? process.env.SUPABASE_SERVICE_ROLE_KEY.substring(0, 20) + '...' : 'none'
    });

    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.log('[AgentInjection] Service role key details:', {
        keyLength: process.env.SUPABASE_SERVICE_ROLE_KEY.length,
        keyPrefix: process.env.SUPABASE_SERVICE_ROLE_KEY.substring(0, 30) + '...',
        keySuffix: '...' + process.env.SUPABASE_SERVICE_ROLE_KEY.substring(process.env.SUPABASE_SERVICE_ROLE_KEY.length - 10),
        supabaseUrl: process.env.SUPABASE_URL,
        urlPrefix: process.env.SUPABASE_URL?.substring(0, 30) + '...'
      });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

/**
 * Middleware to inject organization agents into agent list responses
 * Works exactly like MCP injection - intercepts the response and adds our agents
 */
const injectOrganizationAgents = async (req, res, next) => {
  // DEBUG: Log when middleware is called
  logger.warn(`[AgentInjection] Middleware called for ${req.method} ${req.originalUrl} (path: ${req.path})`);
  
  // Store original json method
  const originalJson = res.json;
  
  // Override res.json to inject our agents
  res.json = async function(data) {
    try {
      // Only inject for agent list requests
      if (req.method === 'GET' && (req.path === '/' || req.originalUrl?.includes('/api/agents')) && Array.isArray(data)) {
        const organizationId = req.user?.organization_id;
        logger.warn(`[AgentInjection] Processing agent list request. User: ${req.user?.id}, Organization: ${organizationId}, Data type: ${typeof data}, Is array: ${Array.isArray(data)}`);
        
        if (organizationId) {
          logger.warn(`[AgentInjection] Injecting agents for organization: ${organizationId}`);
          
          // First, test if the agent_library table exists
          try {
            const { data: testData, error: testError } = await supabase
              .from('agent_library')
              .select('id')
              .limit(1);
            
            console.log('[AgentInjection] Table existence test:', {
              hasTestData: !!testData,
              testError: testError?.message || 'none',
              testErrorCode: testError?.code || 'none'
            });
          } catch (testErr) {
            console.log('[AgentInjection] Table existence test failed:', testErr.message);
          }

          // Fetch organization agents from Supabase
          const { data: orgAgents, error } = await supabase
            .from('agent_library')
            .select('*')
            .eq('organization_id', organizationId);

          logger.warn(`[AgentInjection] Supabase query result - Error: ${error?.message || 'none'}, Agents found: ${orgAgents?.length || 0}`);

          if (!error && orgAgents?.length > 0) {
            // Format for LibreChat and prepend to existing agents
            const formattedAgents = orgAgents.map(formatAgentForLibreChat);
            data.unshift(...formattedAgents);
            
            logger.warn(`[AgentInjection] Added ${formattedAgents.length} organization agents: ${formattedAgents.map(a => a.name).join(', ')}`);
          } else {
            logger.warn(`[AgentInjection] No agents found or error occurred for organization ${organizationId}`);
          }
        } else {
          logger.warn(`[AgentInjection] No organization_id found in request`);
        }
      }
    } catch (error) {
      logger.error('[AgentInjection] Error injecting agents:', error);
    }
    
    // Call original json method
    return originalJson.call(this, data);
  };
  
  next();
};

/**
 * Format Supabase agent for LibreChat using stored configuration
 */
function formatAgentForLibreChat(supabaseAgent) {
  return {
    _id: supabaseAgent.id,
    id: supabaseAgent.id,
    name: supabaseAgent.name,
    description: supabaseAgent.description,
    instructions: supabaseAgent.instructions || buildInstructions(supabaseAgent),
    model: supabaseAgent.model || getModelForCategory(supabaseAgent.category),
    provider: supabaseAgent.provider || getProviderForCategory(supabaseAgent.category),
    tools: supabaseAgent.tools || getToolsForCategory(supabaseAgent.category),
    model_parameters: supabaseAgent.model_parameters || getModelParameters(supabaseAgent.category),
    conversation_starters: supabaseAgent.conversation_starters || getConversationStarters(supabaseAgent),
    avatar: supabaseAgent.avatar_url ? { 
      source: 'url', 
      filepath: supabaseAgent.avatar_url 
    } : null,
    author: supabaseAgent.created_by,
    authorName: 'Henly AI', // Could be fetched from profiles table
    createdAt: supabaseAgent.created_at,
    updatedAt: supabaseAgent.updated_at,
    // LibreChat agent configuration
    access_level: supabaseAgent.access_level || 1,
    recursion_limit: supabaseAgent.recursion_limit || 25,
    artifacts: supabaseAgent.artifacts || 'auto',
    hide_sequential_outputs: supabaseAgent.hide_sequential_outputs || false,
    end_after_tools: supabaseAgent.end_after_tools || false,
    // Mark as organization agent
    isOrgAgent: true,
    category: supabaseAgent.category,
    // LibreChat expects versions array
    versions: [{
      name: supabaseAgent.name,
      description: supabaseAgent.description,
      instructions: supabaseAgent.instructions || buildInstructions(supabaseAgent),
      model: supabaseAgent.model || getModelForCategory(supabaseAgent.category),
      provider: supabaseAgent.provider || getProviderForCategory(supabaseAgent.category),
      tools: supabaseAgent.tools || getToolsForCategory(supabaseAgent.category),
      createdAt: supabaseAgent.created_at,
      updatedAt: supabaseAgent.updated_at
    }]
  };
}

function buildInstructions(agent) {
  return `You are ${agent.name}. ${agent.description}\n\nProvide helpful, professional assistance in your area of expertise.`;
}

function getModelForCategory(category) {
  const modelMap = {
    'sales_marketing': 'claude-3-sonnet-20240229',
    'customer_support': 'gpt-4-turbo-preview',
    'content_creation': 'claude-3-sonnet-20240229',
    'data_analytics': 'gpt-4-turbo-preview'
  };
  return modelMap[category] || 'gpt-4-turbo-preview';
}

function getProviderForCategory(category) {
  const model = getModelForCategory(category);
  return model.includes('claude') ? 'anthropic' : 'openai';
}

function getToolsForCategory(category) {
  const toolMap = {
    'sales_marketing': ['Google Drive', 'HubSpot'],
    'customer_support': ['Zendesk', 'Slack'],
    'content_creation': ['Google Drive'],
    'data_analytics': ['Google Drive', 'BigQuery']
  };
  return toolMap[category] || ['Google Drive'];
}

function getModelParameters(category) {
  const parameterMap = {
    'sales_marketing': { temperature: 0.7, max_tokens: 2000 },
    'customer_support': { temperature: 0.3, max_tokens: 1500 },
    'content_creation': { temperature: 0.8, max_tokens: 3000 },
    'data_analytics': { temperature: 0.2, max_tokens: 2000 },
    'project_management': { temperature: 0.4, max_tokens: 1500 },
    'operations': { temperature: 0.3, max_tokens: 1500 },
    'hr_recruitment': { temperature: 0.5, max_tokens: 1500 },
    'finance_accounting': { temperature: 0.1, max_tokens: 2000 }
  };
  return parameterMap[category] || { temperature: 0.5, max_tokens: 1500 };
}

function getConversationStarters(agent) {
  const starterMap = {
    'sales_marketing': [
      "Help me qualify this lead and determine next steps",
      "Create a proposal for a new client opportunity",
      "Analyze our sales pipeline and suggest improvements"
    ],
    'customer_support': [
      "Help me troubleshoot a client's technical issue",
      "Draft a response to a customer complaint",
      "Create onboarding materials for new users"
    ],
    'content_creation': [
      "Create a blog post outline about AI trends",
      "Write social media content for our latest feature",
      "Develop a case study from client success data"
    ]
  };
  return starterMap[agent.category] || [
    `How can I help you with ${agent.category?.replace('_', ' ')} tasks?`,
    "What would you like to work on today?"
  ];
}

module.exports = injectOrganizationAgents;
