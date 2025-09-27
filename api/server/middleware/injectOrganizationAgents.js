/**
 * MCP-style middleware to inject organization agents into LibreChat responses
 * This is MUCH simpler than replacing the entire data layer
 */

const { createClient } = require('@supabase/supabase-js');
const { logger } = require('@librechat/data-schemas');

// Initialize Supabase client with service role key if available
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

/**
 * Format Supabase agent for LibreChat
 */
const formatAgentForLibreChat = (agent) => ({
  id: agent.id,
  name: agent.name,
  description: agent.description || '',
  instructions: agent.instructions || '',
  model: agent.model || 'gpt-4',
  provider: agent.provider || 'openai',
  tools: agent.tools || [],
  conversation_starters: agent.conversation_starters || [],
  model_parameters: agent.model_parameters || {},
  avatar: agent.avatar_url || null,
  created_at: agent.created_at,
  updated_at: agent.updated_at
});

/**
 * Middleware to inject organization agents into agent list responses
 */
const injectOrganizationAgents = async (req, res, next) => {
  logger.warn(`[AgentInjection] ===== MIDDLEWARE CALLED =====`);
  logger.warn(`[AgentInjection] Method: ${req.method}`);
  logger.warn(`[AgentInjection] Original URL: ${req.originalUrl}`);
  logger.warn(`[AgentInjection] Path: ${req.path}`);
  logger.warn(`[AgentInjection] Query:`, req.query);
  logger.warn(`[AgentInjection] User ID: ${req.user?.id}`);
  logger.warn(`[AgentInjection] Organization ID: ${req.user?.organization_id}`);
  logger.warn(`[AgentInjection] User Role: ${req.user?.role}`);
  
  // Store original json method
  const originalJson = res.json;
  
  // Override res.json to inject our agents
  res.json = async function(data) {
    try {
      logger.warn(`[AgentInjection] ===== JSON RESPONSE INTERCEPTED =====`);
      logger.warn(`[AgentInjection] Data type: ${typeof data}`);
      logger.warn(`[AgentInjection] Data is array: ${Array.isArray(data)}`);
      logger.warn(`[AgentInjection] Data length: ${Array.isArray(data) ? data.length : 'N/A'}`);
      logger.warn(`[AgentInjection] Data sample:`, Array.isArray(data) ? data.slice(0, 2) : data);
      
      // Only inject for main agent list requests
      const isMainAgentsList = req.method === 'GET' && 
        req.originalUrl?.includes('/api/agents') && 
        !req.originalUrl?.includes('/tools') &&
        data && typeof data === 'object' && Array.isArray(data.data);
      
      logger.warn(`[AgentInjection] Is main agents list: ${isMainAgentsList}`);
      logger.warn(`[AgentInjection] Method check: ${req.method === 'GET'}`);
      logger.warn(`[AgentInjection] URL check: ${req.originalUrl?.includes('/api/agents')}`);
      logger.warn(`[AgentInjection] Not tools check: ${!req.originalUrl?.includes('/tools')}`);
      logger.warn(`[AgentInjection] Data has data array: ${data && typeof data === 'object' && Array.isArray(data.data)}`);
      
      if (isMainAgentsList) {
        logger.warn(`[AgentInjection] Processing agent list request. User: ${req.user?.id}, Organization: ${req.user?.organization_id}`);
        
        // Add cache-busting headers
        res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
        
        const organizationId = req.user?.organization_id;
        
        if (organizationId) {
          logger.warn(`[AgentInjection] Fetching agents for organization: ${organizationId}`);
          
          // Fetch organization agents from Supabase
          const { data: orgAgents, error } = await supabase
            .from('agent_library')
            .select('*')
            .eq('organization_id', organizationId);

          logger.warn(`[AgentInjection] Supabase query result - Error: ${error?.message || 'none'}, Agents found: ${orgAgents?.length || 0}`);

          if (!error && orgAgents?.length > 0) {
            // Format for LibreChat and prepend to existing agents
            const formattedAgents = orgAgents.map(formatAgentForLibreChat);
            data.data.unshift(...formattedAgents);
            
            logger.warn(`[AgentInjection] ✅ Added ${formattedAgents.length} organization agents: ${formattedAgents.map(a => a.name).join(', ')}`);
          } else {
            logger.warn(`[AgentInjection] ❌ No agents found or error occurred for organization ${organizationId}`);
          }
        } else {
          logger.warn(`[AgentInjection] ❌ No organization_id found in request`);
        }
      }
    } catch (error) {
      logger.error('[AgentInjection] Error injecting agents:', error);
    }
    
    return originalJson.call(this, data);
  };
  
  next();
};

module.exports = injectOrganizationAgents;