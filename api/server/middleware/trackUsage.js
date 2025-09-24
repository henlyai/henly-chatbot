/**
 * Simple usage tracking middleware for agents and prompts
 * Increments usage counters in Supabase when resources are used
 */

const { createClient } = require('@supabase/supabase-js');
const { logger } = require('@librechat/data-schemas');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

/**
 * Middleware to track agent usage
 * Increments usage count when agent is used in conversations
 */
const trackAgentUsage = async (req, res, next) => {
  // Store original json method
  const originalJson = res.json;
  
  // Override res.json to track usage after successful operations
  res.json = async function(data) {
    try {
      const organizationId = req.user?.organization_id;
      
      // Track usage for agent-related chat operations
      if (organizationId && res.statusCode >= 200 && res.statusCode < 300) {
        if (req.method === 'POST' && req.path.includes('/chat') && req.body?.agent_id) {
          await incrementAgentUsage(req.body.agent_id, organizationId);
        } else if (req.method === 'POST' && req.path.includes('/agents/') && req.path.includes('/chat')) {
          const agentId = req.path.split('/')[3]; // Extract agent ID from path
          await incrementAgentUsage(agentId, organizationId);
        }
      }
    } catch (error) {
      logger.error('[UsageTracking] Error tracking agent usage:', error);
      // Don't fail the request if tracking fails
    }
    
    // Call original json method
    return originalJson.call(this, data);
  };
  
  next();
};

/**
 * Middleware to track prompt usage
 * Increments usage count when prompt is used
 */
const trackPromptUsage = async (req, res, next) => {
  // Store original json method
  const originalJson = res.json;
  
  // Override res.json to track usage after successful operations
  res.json = async function(data) {
    try {
      const organizationId = req.user?.organization_id;
      
      // Track usage for prompt-related operations
      if (organizationId && res.statusCode >= 200 && res.statusCode < 300) {
        if (req.method === 'POST' && req.path.includes('/prompts/') && req.path.includes('/use')) {
          const promptId = req.path.split('/')[3]; // Extract prompt ID from path
          await incrementPromptUsage(promptId, organizationId);
        } else if (req.method === 'GET' && req.path.includes('/prompts/') && !req.path.includes('/groups')) {
          // Track when individual prompts are accessed
          const promptId = req.path.split('/').pop();
          await incrementPromptUsage(promptId, organizationId);
        }
      }
    } catch (error) {
      logger.error('[UsageTracking] Error tracking prompt usage:', error);
      // Don't fail the request if tracking fails
    }
    
    // Call original json method
    return originalJson.call(this, data);
  };
  
  next();
};

/**
 * Increment agent usage count in Supabase
 * @param {string} agentId - Agent ID (can be LibreChat ID or Supabase ID)
 * @param {string} organizationId - Organization ID
 */
async function incrementAgentUsage(agentId, organizationId) {
  try {
    // Try to increment by LibreChat agent ID first
    const { error: error1 } = await supabase
      .rpc('increment_agent_usage', {
        agent_id: agentId,
        org_id: organizationId
      });
    
    if (error1) {
      // If that fails, try by Supabase ID
      const { error: error2 } = await supabase
        .from('agent_library')
        .update({ 
          usage_count: supabase.raw('COALESCE(usage_count, 0) + 1'),
          updated_at: new Date().toISOString()
        })
        .eq('id', agentId)
        .eq('organization_id', organizationId);
      
      if (error2) {
        logger.error(`[UsageTracking] Failed to increment agent usage for ${agentId}: ${error2.message}`);
      } else {
        logger.info(`[UsageTracking] Incremented usage for agent ${agentId} in organization ${organizationId}`);
      }
    } else {
      logger.info(`[UsageTracking] Incremented usage for agent ${agentId} in organization ${organizationId}`);
    }
  } catch (error) {
    logger.error('[UsageTracking] Error in incrementAgentUsage:', error);
  }
}

/**
 * Increment prompt usage count in Supabase
 * @param {string} promptId - Prompt ID (can be LibreChat ID or Supabase ID)
 * @param {string} organizationId - Organization ID
 */
async function incrementPromptUsage(promptId, organizationId) {
  try {
    // Try to increment by LibreChat group ID first
    const { error: error1 } = await supabase
      .rpc('increment_prompt_usage', {
        prompt_id: promptId,
        org_id: organizationId
      });
    
    if (error1) {
      // If that fails, try by Supabase ID
      const { error: error2 } = await supabase
        .from('prompt_library')
        .update({ 
          usage_count: supabase.raw('COALESCE(usage_count, 0) + 1'),
          updated_at: new Date().toISOString()
        })
        .eq('id', promptId)
        .eq('organization_id', organizationId);
      
      if (error2) {
        logger.error(`[UsageTracking] Failed to increment prompt usage for ${promptId}: ${error2.message}`);
      } else {
        logger.info(`[UsageTracking] Incremented usage for prompt ${promptId} in organization ${organizationId}`);
      }
    } else {
      logger.info(`[UsageTracking] Incremented usage for prompt ${promptId} in organization ${organizationId}`);
    }
  } catch (error) {
    logger.error('[UsageTracking] Error in incrementPromptUsage:', error);
  }
}

/**
 * Manual usage tracking function for when agents/prompts are used in conversations
 * Can be called directly from chat controllers
 * @param {string} resourceType - 'agent' or 'prompt'
 * @param {string} resourceId - Resource ID
 * @param {string} organizationId - Organization ID
 */
async function trackResourceUsage(resourceType, resourceId, organizationId) {
  if (resourceType === 'agent') {
    await incrementAgentUsage(resourceId, organizationId);
  } else if (resourceType === 'prompt') {
    await incrementPromptUsage(resourceId, organizationId);
  }
}

module.exports = {
  trackAgentUsage,
  trackPromptUsage,
  trackResourceUsage
};
