/**
 * MCP-style middleware to inject organization agents into LibreChat responses
 * This is MUCH simpler than replacing the entire data layer
 */

const { createClient } = require('@supabase/supabase-js');
const { logger } = require('@librechat/data-schemas');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

/**
 * Middleware to inject organization agents into agent list responses
 * Works exactly like MCP injection - intercepts the response and adds our agents
 */
const injectOrganizationAgents = async (req, res, next) => {
  // Store original json method
  const originalJson = res.json;
  
  // Override res.json to inject our agents
  res.json = async function(data) {
    try {
      // Only inject for agent list requests
      if (req.method === 'GET' && req.path === '/agents' && Array.isArray(data)) {
        const organizationId = req.user?.organization_id;
        
        if (organizationId) {
          logger.info(`[AgentInjection] Injecting agents for organization: ${organizationId}`);
          
          // Fetch organization agents from Supabase
          const { data: orgAgents, error } = await supabase
            .from('agent_library')
            .select('*')
            .eq('organization_id', organizationId);

          if (!error && orgAgents?.length > 0) {
            // Format for LibreChat and prepend to existing agents
            const formattedAgents = orgAgents.map(formatAgentForLibreChat);
            data.unshift(...formattedAgents);
            
            logger.info(`[AgentInjection] Added ${formattedAgents.length} organization agents`);
          }
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
 * Format Supabase agent for LibreChat (minimal version)
 */
function formatAgentForLibreChat(supabaseAgent) {
  return {
    _id: supabaseAgent.id,
    id: supabaseAgent.id,
    name: supabaseAgent.name,
    description: supabaseAgent.description,
    instructions: buildInstructions(supabaseAgent),
    model: getModelForCategory(supabaseAgent.category),
    provider: getProviderForCategory(supabaseAgent.category),
    tools: getToolsForCategory(supabaseAgent.category),
    avatar: supabaseAgent.avatar_url ? { 
      source: 'url', 
      filepath: supabaseAgent.avatar_url 
    } : null,
    author: supabaseAgent.created_by,
    createdAt: supabaseAgent.created_at,
    updatedAt: supabaseAgent.updated_at,
    // Mark as organization agent
    isOrgAgent: true,
    category: supabaseAgent.category
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

module.exports = injectOrganizationAgents;
