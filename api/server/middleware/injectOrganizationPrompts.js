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
  isPublic: false,
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
      const isMainPromptsList = req.method === 'GET' &&
        (req.originalUrl?.includes('/api/prompts/all') || req.originalUrl?.includes('/api/prompts/groups')) &&
        Array.isArray(data);
      
      logger.warn(`[PromptInjection] Processing request: ${req.method} ${req.originalUrl}, isMainPromptsList: ${isMainPromptsList}`);
      
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
            logger.warn(`[PromptInjection] Final data structure:`, {
              totalPrompts: data.length,
              firstPrompt: data[0],
              dataKeys: Object.keys(data[0] || {})
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