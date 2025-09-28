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
const formatAgentForLibreChat = (agent) => {
  // Parse JSON fields if they're strings
  let tools = [];
  let conversation_starters = [];
  let model_parameters = {};
  
  try {
    tools = typeof agent.tools === 'string' ? JSON.parse(agent.tools) : (agent.tools || []);
  } catch (e) {
    logger.warn(`[AgentInjection] Error parsing tools for agent ${agent.name}:`, e.message);
  }
  
  try {
    conversation_starters = typeof agent.conversation_starters === 'string' ? 
      JSON.parse(agent.conversation_starters) : (agent.conversation_starters || []);
  } catch (e) {
    logger.warn(`[AgentInjection] Error parsing conversation_starters for agent ${agent.name}:`, e.message);
  }
  
  try {
    model_parameters = typeof agent.model_parameters === 'string' ? 
      JSON.parse(agent.model_parameters) : (agent.model_parameters || {});
  } catch (e) {
    logger.warn(`[AgentInjection] Error parsing model_parameters for agent ${agent.name}:`, e.message);
  }

  return {
    id: agent.librechat_agent_id || agent.id, // Use librechat_agent_id as the primary ID
    name: agent.name,
    description: agent.description || '',
    instructions: agent.instructions || '',
    model: agent.model || 'gpt-4',
    provider: agent.provider || 'openai',
    tools: tools,
    conversation_starters: conversation_starters,
    model_parameters: model_parameters,
    avatar: agent.avatar_url || null,
    created_at: agent.created_at,
    updated_at: agent.updated_at,
    // Additional LibreChat fields
    author: agent.created_by,
    version: 1,
    isCollaborative: true,
    projectIds: [],
    access_level: agent.access_level || 1,
    recursion_limit: agent.recursion_limit || 25
  };
};

/**
 * Middleware to inject organization agents into agent list responses and handle agent lookups
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
  
  // Check if this is a single agent lookup request (GET /api/agents/:id)
  const isSingleAgentLookup = req.method === 'GET' && 
    req.originalUrl?.includes('/api/agents/') && 
    !req.originalUrl?.includes('/api/agents/tools') &&
    req.params?.id;
  
  if (isSingleAgentLookup) {
    logger.warn(`[AgentInjection] Single agent lookup for ID: ${req.params.id}`);
    
    const organizationId = req.user?.organization_id;
    if (organizationId) {
      try {
        // Try to find the agent in organization's agent_library
        const { data: orgAgent, error } = await supabase
          .from('agent_library')
          .select('*')
          .eq('organization_id', organizationId)
          .eq('librechat_agent_id', req.params.id)
          .single();

        if (!error && orgAgent) {
          logger.warn(`[AgentInjection] ✅ Found organization agent: ${orgAgent.name}`);
          
          // Format for LibreChat and return it
          const formattedAgent = formatAgentForLibreChat(orgAgent);
          
          // Add cache-busting headers
          res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
          res.set('Pragma', 'no-cache');
          res.set('Expires', '0');
          
          return res.json(formattedAgent);
        } else {
          logger.warn(`[AgentInjection] ❌ Organization agent not found for ID: ${req.params.id}, Error: ${error?.message || 'none'}`);
        }
      } catch (error) {
        logger.error('[AgentInjection] Error looking up organization agent:', error);
      }
    }
  }
  
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