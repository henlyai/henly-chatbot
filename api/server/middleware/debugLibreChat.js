/**
 * Comprehensive debugging middleware to diagnose LibreChat UI issues
 * This helps identify why agents, prompts, and MCPs aren't appearing
 */

const { logger } = require('@librechat/data-schemas');

/**
 * Debug middleware for all API responses
 * Logs detailed information about requests and responses
 */
const debugLibreChatAPI = (req, res, next) => {
  // Store original json method
  const originalJson = res.json;
  const originalSend = res.send;
  
  // Override res.json to log response data
  res.json = function(data) {
    try {
      const organizationId = req.user?.organization_id;
      const userId = req.user?.id;
      const userRole = req.user?.role;
      
      // Log request details
      logger.warn(`[DEBUG] ${req.method} ${req.path}`);
      logger.warn(`[DEBUG] User: ${userId}, Org: ${organizationId}, Role: ${userRole}`);
      logger.warn(`[DEBUG] Status: ${res.statusCode}`);
      
      // Log specific endpoints we care about
      if (req.path.includes('/agents') || req.path.includes('/prompts') || req.path.includes('/config') || req.path.includes('/models')) {
        logger.warn(`[DEBUG] Response for ${req.path}:`);
        logger.warn(`[DEBUG] Data type: ${typeof data}, Array: ${Array.isArray(data)}, Length: ${Array.isArray(data) ? data.length : 'N/A'}`);
        
        if (Array.isArray(data)) {
          logger.warn(`[DEBUG] First few items: ${JSON.stringify(data.slice(0, 3), null, 2)}`);
        } else if (data && typeof data === 'object') {
          logger.warn(`[DEBUG] Object keys: ${Object.keys(data).join(', ')}`);
          logger.warn(`[DEBUG] Data sample: ${JSON.stringify(data, null, 2).substring(0, 500)}...`);
        }
      }
      
      // Special debugging for config endpoints
      if (req.path.includes('/config')) {
        logger.warn(`[DEBUG] CONFIG RESPONSE DETAILS:`);
        if (data && data.interface) {
          logger.warn(`[DEBUG] Interface config: agents=${data.interface.agents}, prompts=${data.interface.prompts}, mcpServers=${data.interface.mcpServers}`);
        }
        if (data && data.endpoints) {
          logger.warn(`[DEBUG] Endpoints available: ${Object.keys(data.endpoints || {}).join(', ')}`);
        }
      }
      
      // Debug agents specifically
      if (req.path === '/agents' && req.method === 'GET') {
        logger.warn(`[DEBUG] AGENTS ENDPOINT:`);
        logger.warn(`[DEBUG] Original agents count: ${Array.isArray(data) ? data.length : 'Not an array'}`);
        if (Array.isArray(data)) {
          const orgAgents = data.filter(a => a.isOrgAgent);
          const regularAgents = data.filter(a => !a.isOrgAgent);
          logger.warn(`[DEBUG] Organization agents: ${orgAgents.length}, Regular agents: ${regularAgents.length}`);
          logger.warn(`[DEBUG] Agent names: ${data.map(a => a.name).join(', ')}`);
        }
      }
      
      // Debug prompts specifically
      if (req.path.includes('/prompts') && req.method === 'GET') {
        logger.warn(`[DEBUG] PROMPTS ENDPOINT:`);
        logger.warn(`[DEBUG] Prompts count: ${Array.isArray(data) ? data.length : 'Not an array'}`);
        if (Array.isArray(data)) {
          const orgPrompts = data.filter(p => p.isOrgPrompt);
          const regularPrompts = data.filter(p => !p.isOrgPrompt);
          logger.warn(`[DEBUG] Organization prompts: ${orgPrompts.length}, Regular prompts: ${regularPrompts.length}`);
          logger.warn(`[DEBUG] Prompt names: ${data.map(p => p.name).join(', ')}`);
        }
      }
      
    } catch (error) {
      logger.error('[DEBUG] Error in debug middleware:', error);
    }
    
    // Call original json method
    return originalJson.call(this, data);
  };
  
  // Override res.send to catch non-JSON responses
  res.send = function(data) {
    try {
      if (req.path.includes('/agents') || req.path.includes('/prompts') || req.path.includes('/config')) {
        logger.warn(`[DEBUG] ${req.method} ${req.path} - SEND response (non-JSON)`);
        logger.warn(`[DEBUG] Data type: ${typeof data}, Length: ${data?.length || 'N/A'}`);
      }
    } catch (error) {
      logger.error('[DEBUG] Error in debug send middleware:', error);
    }
    
    return originalSend.call(this, data);
  };
  
  next();
};

/**
 * Debug middleware specifically for MCP loading
 */
const debugMCPLoading = (req, res, next) => {
  // Check if this is an MCP-related request
  if (req.path.includes('/mcp') || req.path.includes('/config') || req.path.includes('/models')) {
    const organizationId = req.user?.organization_id;
    
    logger.warn(`[MCP DEBUG] ${req.method} ${req.path}`);
    logger.warn(`[MCP DEBUG] Organization ID: ${organizationId}`);
    logger.warn(`[MCP DEBUG] Headers: ${JSON.stringify(req.headers, null, 2)}`);
    
    if (req.body && Object.keys(req.body).length > 0) {
      logger.warn(`[MCP DEBUG] Request body: ${JSON.stringify(req.body, null, 2)}`);
    }
  }
  
  next();
};

/**
 * Debug user authentication and organization context
 */
const debugUserContext = (req, res, next) => {
  if (req.user) {
    logger.warn(`[AUTH DEBUG] User authenticated: ${req.user.id}`);
    logger.warn(`[AUTH DEBUG] Organization: ${req.user.organization_id}`);
    logger.warn(`[AUTH DEBUG] Role: ${req.user.role}`);
    logger.warn(`[AUTH DEBUG] Email: ${req.user.email}`);
    
    // Check if organization context is properly set
    if (!req.user.organization_id) {
      logger.error(`[AUTH DEBUG] MISSING ORGANIZATION ID for user ${req.user.id}`);
    }
  } else {
    logger.warn(`[AUTH DEBUG] No user in request for ${req.path}`);
  }
  
  next();
};

/**
 * Debug middleware injection status
 */
const debugMiddlewareExecution = (req, res, next) => {
  logger.warn(`[MIDDLEWARE DEBUG] ${req.method} ${req.path} - debugMiddlewareExecution executed`);
  
  // Check if our middleware is in the right order
  const organizationId = req.user?.organization_id;
  const userId = req.user?.id;
  
  if (req.path.includes('/agents') || req.path.includes('/prompts')) {
    logger.warn(`[MIDDLEWARE DEBUG] Processing ${req.path} for user ${userId}, org ${organizationId}`);
    
    // Store original json to check middleware order
    const originalJson = res.json;
    res.json = function(data) {
      logger.warn(`[MIDDLEWARE DEBUG] ${req.path} response being sent`);
      logger.warn(`[MIDDLEWARE DEBUG] Data type: ${typeof data}, Array: ${Array.isArray(data)}`);
      
      if (Array.isArray(data)) {
        const hasOrgAgents = data.some(item => item.isOrgAgent);
        const hasOrgPrompts = data.some(item => item.isOrgPrompt);
        logger.warn(`[MIDDLEWARE DEBUG] Has org agents: ${hasOrgAgents}, Has org prompts: ${hasOrgPrompts}`);
      }
      
      return originalJson.call(this, data);
    };
  }
  
  next();
};

module.exports = {
  debugLibreChatAPI,
  debugMCPLoading,
  debugUserContext,
  debugMiddlewareExecution
};
