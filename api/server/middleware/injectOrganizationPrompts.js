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
 * Format Supabase prompt for LibreChat
 */
const formatPromptForLibreChat = (prompt) => ({
  id: prompt.id,
  name: prompt.name,
  description: prompt.description || '',
  prompt_text: prompt.prompt_text || '',
  category: prompt.category || 'general',
  variables: prompt.variables || [],
  created_at: prompt.created_at,
  updated_at: prompt.updated_at
});

/**
 * Middleware to inject organization prompts into prompt list responses
 */
const injectOrganizationPrompts = async (req, res, next) => {
  logger.warn(`[PromptInjection] ===== MIDDLEWARE CALLED =====`);
  logger.warn(`[PromptInjection] Method: ${req.method}`);
  logger.warn(`[PromptInjection] Original URL: ${req.originalUrl}`);
  logger.warn(`[PromptInjection] Path: ${req.path}`);
  logger.warn(`[PromptInjection] User ID: ${req.user?.id}`);
  logger.warn(`[PromptInjection] Organization ID: ${req.user?.organization_id}`);
  
  // Store original json method
  const originalJson = res.json;
  
  // Override res.json to inject our prompts
  res.json = async function(data) {
    try {
      logger.warn(`[PromptInjection] ===== JSON RESPONSE INTERCEPTED =====`);
      logger.warn(`[PromptInjection] Data type: ${typeof data}`);
      logger.warn(`[PromptInjection] Data is array: ${Array.isArray(data)}`);
      logger.warn(`[PromptInjection] Data length: ${Array.isArray(data) ? data.length : 'N/A'}`);
      logger.warn(`[PromptInjection] Data sample:`, Array.isArray(data) ? data.slice(0, 2) : data);
      
      // Only inject for main prompt list requests
      const isMainPromptsList = req.method === 'GET' && 
        req.originalUrl?.includes('/api/prompts') && 
        Array.isArray(data);
      
      logger.warn(`[PromptInjection] Is main prompts list: ${isMainPromptsList}`);
      logger.warn(`[PromptInjection] Method check: ${req.method === 'GET'}`);
      logger.warn(`[PromptInjection] URL check: ${req.originalUrl?.includes('/api/prompts')}`);
      logger.warn(`[PromptInjection] Data is array: ${Array.isArray(data)}`);
      
      if (isMainPromptsList) {
        logger.warn(`[PromptInjection] Processing prompt list request. User: ${req.user?.id}, Organization: ${req.user?.organization_id}`);
        
        // Add cache-busting headers
        res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
        
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
            data.unshift(...formattedPrompts);
            
            logger.warn(`[PromptInjection] ✅ Added ${formattedPrompts.length} organization prompts: ${formattedPrompts.map(p => p.name).join(', ')}`);
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