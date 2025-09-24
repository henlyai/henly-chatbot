/**
 * Middleware to sync LibreChat agent/prompt operations to Supabase
 * Maintains the simple MCP-style approach while ensuring bidirectional sync
 */

const { createClient } = require('@supabase/supabase-js');
const { logger } = require('@librechat/data-schemas');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

/**
 * Middleware to sync agent operations to Supabase
 * Intercepts POST/PUT/DELETE operations and syncs to agent_library
 */
const syncAgentsToSupabase = async (req, res, next) => {
  // Store original json method
  const originalJson = res.json;
  
  // Override res.json to sync after successful operations
  res.json = async function(data) {
    try {
      const organizationId = req.user?.organization_id;
      const userId = req.user?.id;
      
      if (organizationId && userId && res.statusCode >= 200 && res.statusCode < 300) {
        // Handle different agent operations
        if (req.method === 'POST' && req.path === '/agents' && data && data._id) {
          await syncAgentToSupabase(data, organizationId, userId, 'create');
        } else if (req.method === 'PUT' && req.path.includes('/agents/') && data && data._id) {
          await syncAgentToSupabase(data, organizationId, userId, 'update');
        } else if (req.method === 'DELETE' && req.path.includes('/agents/')) {
          const agentId = req.path.split('/').pop();
          await removeAgentFromSupabase(agentId, organizationId);
        }
      }
    } catch (error) {
      logger.error('[AgentSync] Error syncing to Supabase:', error);
      // Don't fail the request if sync fails
    }
    
    // Call original json method
    return originalJson.call(this, data);
  };
  
  next();
};

/**
 * Middleware to sync prompt operations to Supabase
 * Intercepts POST/PUT/DELETE operations and syncs to prompt_library
 */
const syncPromptsToSupabase = async (req, res, next) => {
  // Store original json method
  const originalJson = res.json;
  
  // Override res.json to sync after successful operations
  res.json = async function(data) {
    try {
      const organizationId = req.user?.organization_id;
      const userId = req.user?.id;
      
      if (organizationId && userId && res.statusCode >= 200 && res.statusCode < 300) {
        // Handle different prompt operations
        if (req.method === 'POST' && req.path.includes('/prompts') && data && data._id) {
          await syncPromptToSupabase(data, organizationId, userId, 'create');
        } else if (req.method === 'PUT' && req.path.includes('/prompts/') && data && data._id) {
          await syncPromptToSupabase(data, organizationId, userId, 'update');
        } else if (req.method === 'DELETE' && req.path.includes('/prompts/')) {
          const promptId = req.path.split('/').pop();
          await removePromptFromSupabase(promptId, organizationId);
        }
      }
    } catch (error) {
      logger.error('[PromptSync] Error syncing to Supabase:', error);
      // Don't fail the request if sync fails
    }
    
    // Call original json method
    return originalJson.call(this, data);
  };
  
  next();
};

/**
 * Sync agent to Supabase agent_library
 * @param {Object} librechatAgent - Agent data from LibreChat
 * @param {string} organizationId - Organization ID
 * @param {string} userId - User ID
 * @param {string} operation - 'create' or 'update'
 */
async function syncAgentToSupabase(librechatAgent, organizationId, userId, operation) {
  try {
    logger.info(`[AgentSync] ${operation} agent "${librechatAgent.name}" for organization ${organizationId}`);
    
    // Check if agent is shared with organization (has projectIds or specific sharing flags)
    const isSharedWithOrg = isAgentSharedWithOrganization(librechatAgent);
    
    if (!isSharedWithOrg) {
      logger.info(`[AgentSync] Agent "${librechatAgent.name}" is private, not syncing to organization`);
      return;
    }
    
    const supabaseAgent = {
      organization_id: organizationId,
      librechat_agent_id: librechatAgent._id.toString(),
      name: librechatAgent.name,
      description: librechatAgent.description || '',
      category: inferCategoryFromAgent(librechatAgent),
      avatar_url: librechatAgent.avatar?.filepath || null,
      created_by: userId,
      usage_count: 0,
      is_default: false,
      sync_status: 'synced',
      // Store full LibreChat configuration
      provider: librechatAgent.provider || 'openai',
      model: librechatAgent.model || 'gpt-4-turbo-preview',
      instructions: librechatAgent.instructions || '',
      tools: librechatAgent.tools || [],
      model_parameters: librechatAgent.model_parameters || { temperature: 0.5, max_tokens: 2000 },
      conversation_starters: librechatAgent.conversation_starters || [],
      access_level: librechatAgent.access_level || 1,
      recursion_limit: librechatAgent.recursion_limit || 25,
      artifacts: librechatAgent.artifacts || 'auto',
      hide_sequential_outputs: librechatAgent.hide_sequential_outputs || false,
      end_after_tools: librechatAgent.end_after_tools || false,
      is_active: true
    };

    if (operation === 'create') {
      const { error } = await supabase
        .from('agent_library')
        .upsert([supabaseAgent], { 
          onConflict: 'organization_id,librechat_agent_id',
          ignoreDuplicates: false 
        });
      
      if (error) {
        logger.error(`[AgentSync] Error creating agent in Supabase: ${error.message}`);
      } else {
        logger.info(`[AgentSync] Successfully synced agent "${librechatAgent.name}" to Supabase`);
      }
    } else if (operation === 'update') {
      const { error } = await supabase
        .from('agent_library')
        .update({
          ...supabaseAgent,
          updated_at: new Date().toISOString()
        })
        .eq('librechat_agent_id', librechatAgent._id.toString())
        .eq('organization_id', organizationId);
      
      if (error) {
        logger.error(`[AgentSync] Error updating agent in Supabase: ${error.message}`);
      } else {
        logger.info(`[AgentSync] Successfully updated agent "${librechatAgent.name}" in Supabase`);
      }
    }
  } catch (error) {
    logger.error('[AgentSync] Error in syncAgentToSupabase:', error);
  }
}

/**
 * Sync prompt to Supabase prompt_library
 * @param {Object} librechatPrompt - Prompt data from LibreChat
 * @param {string} organizationId - Organization ID
 * @param {string} userId - User ID
 * @param {string} operation - 'create' or 'update'
 */
async function syncPromptToSupabase(librechatPrompt, organizationId, userId, operation) {
  try {
    logger.info(`[PromptSync] ${operation} prompt "${librechatPrompt.name}" for organization ${organizationId}`);
    
    // Check if prompt is shared with organization
    const isSharedWithOrg = isPromptSharedWithOrganization(librechatPrompt);
    
    if (!isSharedWithOrg) {
      logger.info(`[PromptSync] Prompt "${librechatPrompt.name}" is private, not syncing to organization`);
      return;
    }
    
    const supabasePrompt = {
      organization_id: organizationId,
      librechat_group_id: librechatPrompt._id.toString(),
      name: librechatPrompt.name,
      description: librechatPrompt.oneliner || librechatPrompt.description || '',
      prompt_text: librechatPrompt.productionPrompt?.prompt || librechatPrompt.prompt || '',
      category: librechatPrompt.category || 'general',
      created_by: userId,
      usage_count: librechatPrompt.numberOfGenerations || 0,
      is_default: false,
      sync_status: 'synced',
      type: librechatPrompt.productionPrompt?.type || 'text',
      variables: extractVariablesFromPrompt(librechatPrompt.productionPrompt?.prompt),
      is_active: true
    };

    if (operation === 'create') {
      const { error } = await supabase
        .from('prompt_library')
        .upsert([supabasePrompt], { 
          onConflict: 'organization_id,librechat_group_id',
          ignoreDuplicates: false 
        });
      
      if (error) {
        logger.error(`[PromptSync] Error creating prompt in Supabase: ${error.message}`);
      } else {
        logger.info(`[PromptSync] Successfully synced prompt "${librechatPrompt.name}" to Supabase`);
      }
    } else if (operation === 'update') {
      const { error } = await supabase
        .from('prompt_library')
        .update({
          ...supabasePrompt,
          updated_at: new Date().toISOString()
        })
        .eq('librechat_group_id', librechatPrompt._id.toString())
        .eq('organization_id', organizationId);
      
      if (error) {
        logger.error(`[PromptSync] Error updating prompt in Supabase: ${error.message}`);
      } else {
        logger.info(`[PromptSync] Successfully updated prompt "${librechatPrompt.name}" in Supabase`);
      }
    }
  } catch (error) {
    logger.error('[PromptSync] Error in syncPromptToSupabase:', error);
  }
}

/**
 * Remove agent from Supabase when deleted in LibreChat
 */
async function removeAgentFromSupabase(agentId, organizationId) {
  try {
    const { error } = await supabase
      .from('agent_library')
      .delete()
      .eq('librechat_agent_id', agentId)
      .eq('organization_id', organizationId);
    
    if (error) {
      logger.error(`[AgentSync] Error removing agent from Supabase: ${error.message}`);
    } else {
      logger.info(`[AgentSync] Successfully removed agent ${agentId} from organization ${organizationId}`);
    }
  } catch (error) {
    logger.error('[AgentSync] Error in removeAgentFromSupabase:', error);
  }
}

/**
 * Remove prompt from Supabase when deleted in LibreChat
 */
async function removePromptFromSupabase(promptId, organizationId) {
  try {
    const { error } = await supabase
      .from('prompt_library')
      .delete()
      .eq('librechat_group_id', promptId)
      .eq('organization_id', organizationId);
    
    if (error) {
      logger.error(`[PromptSync] Error removing prompt from Supabase: ${error.message}`);
    } else {
      logger.info(`[PromptSync] Successfully removed prompt ${promptId} from organization ${organizationId}`);
    }
  } catch (error) {
    logger.error('[PromptSync] Error in removePromptFromSupabase:', error);
  }
}

/**
 * Check if agent is shared with organization
 * LibreChat uses projectIds to determine sharing
 */
function isAgentSharedWithOrganization(agent) {
  // If agent has projectIds, it might be shared
  if (agent.projectIds && agent.projectIds.length > 0) {
    return true;
  }
  
  // Check for any sharing flags or indicators
  // For now, assume all agents created by users should be available to their organization
  // This can be refined based on LibreChat's sharing model
  return true;
}

/**
 * Check if prompt is shared with organization
 */
function isPromptSharedWithOrganization(prompt) {
  // Similar logic to agents
  if (prompt.projectIds && prompt.projectIds.length > 0) {
    return true;
  }
  
  // For now, assume all prompts created by users should be available to their organization
  return true;
}

/**
 * Infer category from agent properties
 */
function inferCategoryFromAgent(agent) {
  const name = (agent.name || '').toLowerCase();
  const description = (agent.description || '').toLowerCase();
  const instructions = (agent.instructions || '').toLowerCase();
  const content = `${name} ${description} ${instructions}`;

  if (content.includes('sales') || content.includes('marketing') || content.includes('lead')) return 'sales_marketing';
  if (content.includes('support') || content.includes('customer') || content.includes('help')) return 'customer_support';
  if (content.includes('content') || content.includes('writing') || content.includes('blog')) return 'content_creation';
  if (content.includes('data') || content.includes('analytics') || content.includes('report')) return 'data_analytics';
  if (content.includes('project') || content.includes('management') || content.includes('plan')) return 'project_management';
  if (content.includes('operations') || content.includes('ops') || content.includes('process')) return 'operations';
  if (content.includes('hr') || content.includes('recruitment') || content.includes('hiring')) return 'hr_recruitment';
  if (content.includes('finance') || content.includes('accounting') || content.includes('budget')) return 'finance_accounting';

  return 'general';
}

/**
 * Extract variables from prompt text ({{VARIABLE_NAME}} format)
 */
function extractVariablesFromPrompt(promptText) {
  if (!promptText) return [];
  
  const variableMatches = promptText.match(/\{\{([^}]+)\}\}/g);
  if (!variableMatches) return [];
  
  return variableMatches.map(match => match.replace(/[{}]/g, ''));
}

module.exports = {
  syncAgentsToSupabase,
  syncPromptsToSupabase
};
