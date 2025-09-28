/**
 * MCP-style middleware to inject organization prompts into LibreChat responses
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
 * Format Supabase prompt for LibreChat TPromptGroup structure
 */
const formatPromptForLibreChat = (prompt) => ({
  _id: prompt.id, // LibreChat expects _id for MongoDB ObjectId
  name: prompt.name,
  oneliner: prompt.description || '', // LibreChat expects oneliner for short description
  category: prompt.category || 'general',
  author: prompt.created_by || 'system', // User who created the prompt
  projectIds: [], // Empty array for organization prompts
  productionPrompt: {
    prompt: prompt.prompt_text || '', // LibreChat expects productionPrompt.prompt
    _id: `${prompt.id}_prod`
  },
  prompts: [
    {
      _id: `${prompt.id}_prompt`,
      prompt: prompt.prompt_text || '',
      type: 'text'
    }
  ],
  createdAt: prompt.created_at,
  updatedAt: prompt.updated_at,
  // Additional fields that might be expected
  command: prompt.command || prompt.name.toLowerCase().replace(/\s+/g, '-'),
  isPublic: true, // Set to true so organization prompts are visible to all users
  tags: prompt.variables || []
});

/**
 * Middleware to inject organization prompts into prompt list responses
 */
const injectOrganizationPrompts = async (req, res, next) => {
  // Store original json method
  const originalJson = res.json;
  
  // Override res.json to inject our prompts
  res.json = async function(data) {
    try {
      // Only inject for main prompt list requests (both /all and /groups endpoints)
      const isAllEndpoint = req.method === 'GET' && req.originalUrl?.includes('/api/prompts/all') && Array.isArray(data);
      const isGroupsEndpoint = req.method === 'GET' && req.originalUrl?.includes('/api/prompts/groups') && data && typeof data === 'object' && Array.isArray(data.promptGroups);
      const isMainPromptsList = isAllEndpoint || isGroupsEndpoint;
      
      logger.warn(`[PromptInjection] Processing request: ${req.method} ${req.originalUrl}, isMainPromptsList: ${isMainPromptsList}`);
      logger.warn(`[PromptInjection] Request details:`, {
        method: req.method,
        originalUrl: req.originalUrl,
        path: req.path,
        query: req.query,
        dataType: typeof data,
        dataIsArray: Array.isArray(data),
        dataLength: Array.isArray(data) ? data.length : 'N/A'
      });
      
      if (isMainPromptsList) {
        logger.warn(`[PromptInjection] Processing prompt list request. User: ${req.user?.id}, Organization: ${req.user?.organization_id}`);
        
        // Add aggressive cache-busting headers
        res.set('Cache-Control', 'no-cache, no-store, must-revalidate, private');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
        res.set('Last-Modified', new Date().toUTCString());
        res.set('ETag', `"${Date.now()}"`);
        
        const organizationId = req.user?.organization_id;
        
        if (organizationId) {
          logger.warn(`[PromptInjection] Fetching prompts for organization: ${organizationId}`);
          
          // Fetch organization prompts from Supabase
          const { data: orgPrompts, error } = await supabase
            .from('prompt_library')
            .select('*')
            .eq('organization_id', organizationId);

          logger.warn(`[PromptInjection] Supabase query result - Error: ${error?.message || 'none'}, Prompts found: ${orgPrompts?.length || 0}`);

          if (!error && orgPrompts?.length > 0) {
            // Format for LibreChat and prepend to existing prompts
            const formattedPrompts = orgPrompts.map(formatPromptForLibreChat);
            
            if (isAllEndpoint) {
              // For /api/prompts/all - data is an array
              data.unshift(...formattedPrompts);
              logger.warn(`[PromptInjection] ✅ Added ${formattedPrompts.length} organization prompts to /all endpoint`);
            } else if (isGroupsEndpoint) {
              // For /api/prompts/groups - data is an object with promptGroups array
              data.promptGroups.unshift(...formattedPrompts);
              logger.warn(`[PromptInjection] ✅ Added ${formattedPrompts.length} organization prompts to /groups endpoint`);
            }
            
            logger.warn(`[PromptInjection] ✅ Added ${formattedPrompts.length} organization prompts: ${formattedPrompts.map(p => p.name).join(', ')}`);
            logger.warn(`[PromptInjection] Final data structure:`, {
              endpoint: isAllEndpoint ? '/all' : '/groups',
              totalPrompts: isAllEndpoint ? data.length : data.promptGroups?.length,
              firstPrompt: isAllEndpoint ? data[0] : data.promptGroups?.[0],
              dataKeys: Object.keys(isAllEndpoint ? (data[0] || {}) : (data.promptGroups?.[0] || {}))
            });
          } else {
            logger.warn(`[PromptInjection] ❌ No prompts found or error occurred for organization ${organizationId}`);
          }
        } else {
          logger.warn(`[PromptInjection] ❌ No organization_id found in request`);
        }
      }
    } catch (error) {
      logger.error('[PromptInjection] Error injecting prompts:', error);
    }
    
    return originalJson.call(this, data);
  };
  
  next();
};

module.exports = injectOrganizationPrompts;