/**
 * MCP-style middleware to inject organization prompts into LibreChat responses
 * Simple injection approach instead of replacing the entire data layer
 */

const { createClient } = require('@supabase/supabase-js');
const { logger } = require('@librechat/data-schemas');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

/**
 * Middleware to inject organization prompts into prompt list responses
 */
const injectOrganizationPrompts = async (req, res, next) => {
  // Store original json method
  const originalJson = res.json;
  
  // Override res.json to inject our prompts
  res.json = async function(data) {
    try {
      // Only inject for prompt list requests
      if (req.method === 'GET' && req.path.includes('/prompts') && Array.isArray(data)) {
        const organizationId = req.user?.organization_id;
        
        if (organizationId) {
          logger.info(`[PromptInjection] Injecting prompts for organization: ${organizationId}`);
          
          // Fetch organization prompts from Supabase
          const { data: orgPrompts, error } = await supabase
            .from('prompt_library')
            .select('*')
            .eq('organization_id', organizationId);

          if (!error && orgPrompts?.length > 0) {
            // Format for LibreChat and prepend to existing prompts
            const formattedPrompts = orgPrompts.map(formatPromptForLibreChat);
            data.unshift(...formattedPrompts);
            
            logger.info(`[PromptInjection] Added ${formattedPrompts.length} organization prompts`);
          }
        }
      }
    } catch (error) {
      logger.error('[PromptInjection] Error injecting prompts:', error);
    }
    
    // Call original json method
    return originalJson.call(this, data);
  };
  
  next();
};

/**
 * Format Supabase prompt for LibreChat using stored configuration
 */
function formatPromptForLibreChat(supabasePrompt) {
  return {
    _id: supabasePrompt.id,
    id: supabasePrompt.id,
    name: supabasePrompt.name,
    oneliner: supabasePrompt.description,
    category: supabasePrompt.category || 'general',
    author: supabasePrompt.created_by,
    authorName: 'Henly AI', // Could be fetched from profiles table
    numberOfGenerations: supabasePrompt.usage_count || 0,
    createdAt: supabasePrompt.created_at,
    updatedAt: supabasePrompt.updated_at,
    // LibreChat expects production prompt data
    productionPrompt: {
      _id: `${supabasePrompt.id}_production`,
      prompt: supabasePrompt.prompt_text || buildDefaultPrompt(supabasePrompt),
      type: supabasePrompt.type || 'text'
    },
    // Production ID points to the prompt text
    productionId: `${supabasePrompt.id}_production`,
    // Optional: Include variables if they exist
    variables: supabasePrompt.variables || [],
    // Mark as organization prompt
    isOrgPrompt: true,
    // Optional: Include project IDs if using LibreChat projects
    projectIds: []
  };
}

/**
 * Build default prompt text if none provided
 */
function buildDefaultPrompt(supabasePrompt) {
  return `You are helping with ${supabasePrompt.name?.toLowerCase() || 'a task'}.

Request: {{USER_INPUT}}

Please provide helpful, professional assistance that addresses the user's needs effectively.`;
}

module.exports = injectOrganizationPrompts;
