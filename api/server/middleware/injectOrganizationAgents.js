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
    _id: agent.librechat_agent_id || agent.id, // LibreChat expects _id field
    id: agent.librechat_agent_id || agent.id, // Also include id field for compatibility
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
  
  // Check if this is a chat request that might need agent lookup (POST /api/agents/chat/agents)
  const isChatRequest = req.method === 'POST' && 
    req.originalUrl?.includes('/api/agents/chat/agents');
  
  // Check if this is any agent-related request that might need validation
  const isAgentRelated = req.originalUrl?.includes('/api/agents/');
  
  if (isChatRequest) {
    logger.warn(`[AgentInjection] Chat request detected - Body:`, JSON.stringify(req.body, null, 2));
    logger.warn(`[AgentInjection] Chat request headers:`, req.headers);
    
    // Check if the chat request contains an agent ID that we need to validate
    if (req.body?.agentId) {
      logger.warn(`[AgentInjection] Chat request with agentId: ${req.body.agentId}`);
      
      const organizationId = req.user?.organization_id;
      if (organizationId) {
        try {
          // Check if this is one of our organization agents
          const { data: orgAgent, error } = await supabase
            .from('agent_library')
            .select('*')
            .eq('organization_id', organizationId)
            .or(`librechat_agent_id.eq.${req.body.agentId},id.eq.${req.body.agentId}`)
            .single();

          if (!error && orgAgent) {
            logger.warn(`[AgentInjection] ✅ Chat request for organization agent: ${orgAgent.name} (ID: ${orgAgent.id})`);
            // The agent exists, let the request continue
          } else {
            logger.warn(`[AgentInjection] ❌ Chat request for unknown agent: ${req.body.agentId}`);
          }
        } catch (error) {
          logger.error('[AgentInjection] Error validating agent for chat:', error);
        }
      }
    }
  }

  if (isSingleAgentLookup) {
    logger.warn(`[AgentInjection] Single agent lookup for ID: ${req.params.id}`);
    
    const organizationId = req.user?.organization_id;
    if (organizationId) {
      try {
        // First try to find by librechat_agent_id
        let { data: orgAgent, error } = await supabase
          .from('agent_library')
          .select('*')
          .eq('organization_id', organizationId)
          .eq('librechat_agent_id', req.params.id)
          .single();

        // If not found by librechat_agent_id, try by regular id
        if (error || !orgAgent) {
          logger.warn(`[AgentInjection] Not found by librechat_agent_id, trying by id`);
          const { data: orgAgentById, error: errorById } = await supabase
            .from('agent_library')
            .select('*')
            .eq('organization_id', organizationId)
            .eq('id', req.params.id)
            .single();
          
          orgAgent = orgAgentById;
          error = errorById;
        }

        // If still not found, try to find any agent with matching name or similar ID
        if (error || !orgAgent) {
          logger.warn(`[AgentInjection] Not found by id either, trying broader search`);
          const { data: allOrgAgents, error: allError } = await supabase
            .from('agent_library')
            .select('*')
            .eq('organization_id', organizationId)
            .eq('is_active', true);

          if (!allError && allOrgAgents?.length > 0) {
            logger.warn(`[AgentInjection] Found ${allOrgAgents.length} agents for organization. Looking for match...`);
            // Log all available agents for debugging
            allOrgAgents.forEach(agent => {
              logger.warn(`[AgentInjection] Available agent: ID=${agent.id}, LibreChatID=${agent.librechat_agent_id}, Name=${agent.name}`);
            });
            
            // Try to find a match by checking if the requested ID is similar to any agent's ID or librechat_agent_id
            orgAgent = allOrgAgents.find(agent => 
              agent.id === req.params.id || 
              agent.librechat_agent_id === req.params.id ||
              agent.id.includes(req.params.id) ||
              req.params.id.includes(agent.id)
            );
          }
        }

        if (!error && orgAgent) {
          logger.warn(`[AgentInjection] ✅ Found organization agent: ${orgAgent.name} (ID: ${orgAgent.id}, LibreChatID: ${orgAgent.librechat_agent_id})`);
          
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
      logger.warn(`[AgentInjection] Request URL: ${req.originalUrl}`);
      logger.warn(`[AgentInjection] Request Method: ${req.method}`);
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