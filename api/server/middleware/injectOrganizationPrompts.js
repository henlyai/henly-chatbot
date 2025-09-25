/**
 * MCP-style middleware to inject organization prompts into LibreChat responses
 * Simple injection approach instead of replacing the entire data layer
 */

const { createClient } = require('@supabase/supabase-js');
const { logger } = require('@librechat/data-schemas');

    // Use service role key for server-side operations to bypass RLS
    console.log('[PromptInjection] Environment variables check:', {
      hasSupabaseUrl: !!process.env.SUPABASE_URL,
      hasSupabaseAnonKey: !!process.env.SUPABASE_ANON_KEY,
      hasSupabaseServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      serviceRoleKeyLength: process.env.SUPABASE_SERVICE_ROLE_KEY ? process.env.SUPABASE_SERVICE_ROLE_KEY.length : 0,
      serviceRoleKeyPrefix: process.env.SUPABASE_SERVICE_ROLE_KEY ? process.env.SUPABASE_SERVICE_ROLE_KEY.substring(0, 20) + '...' : 'none'
    });

    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.log('[PromptInjection] Service role key details:', {
        keyLength: process.env.SUPABASE_SERVICE_ROLE_KEY.length,
        keyPrefix: process.env.SUPABASE_SERVICE_ROLE_KEY.substring(0, 30) + '...',
        keySuffix: '...' + process.env.SUPABASE_SERVICE_ROLE_KEY.substring(process.env.SUPABASE_SERVICE_ROLE_KEY.length - 10),
        supabaseUrl: process.env.SUPABASE_URL,
        urlPrefix: process.env.SUPABASE_URL?.substring(0, 30) + '...'
      });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

/**
 * Middleware to inject organization prompts into prompt list responses
 */
const injectOrganizationPrompts = async (req, res, next) => {
  // DEBUG: Log when middleware is called
  logger.warn(`[PromptInjection] Middleware called for ${req.method} ${req.originalUrl} (path: ${req.path})`);
  
  // Store original json method
  const originalJson = res.json;
  
  // Override res.json to inject our prompts
  res.json = async function(data) {
    try {
      // Only inject for prompt list requests
      if (req.method === 'GET' && (req.path === '/' || req.originalUrl?.includes('/api/prompts')) && Array.isArray(data)) {
        const organizationId = req.user?.organization_id;
        logger.warn(`[PromptInjection] Processing prompt list request. User: ${req.user?.id}, Organization: ${organizationId}, Data type: ${typeof data}, Is array: ${Array.isArray(data)}`);
        
        if (organizationId) {
          logger.warn(`[PromptInjection] Injecting prompts for organization: ${organizationId}`);
          
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
            
            logger.warn(`[PromptInjection] Added ${formattedPrompts.length} organization prompts: ${formattedPrompts.map(p => p.name).join(', ')}`);
          } else {
            logger.warn(`[PromptInjection] No prompts found or error occurred for organization ${organizationId}`);
          }
        } else {
          logger.warn(`[PromptInjection] No organization_id found in request`);
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
