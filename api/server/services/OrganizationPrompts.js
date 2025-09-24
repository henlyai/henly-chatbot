const { createClient } = require('@supabase/supabase-js');
const { logger } = require('@librechat/data-schemas');

class OrganizationPromptsService {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );
  }

  /**
   * Get prompts for a specific organization from Supabase
   * @param {string} organizationId - The organization ID
   * @returns {Promise<Array>} Array of prompt configurations
   */
  async getOrganizationPrompts(organizationId) {
    try {
      logger.info(`[OrganizationPrompts] Fetching prompts for organization: ${organizationId}`);
      
      const { data: prompts, error } = await this.supabase
        .from('prompt_library')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error(`[OrganizationPrompts] Error fetching prompts: ${error.message}`);
        return [];
      }

      logger.info(`[OrganizationPrompts] Found ${prompts?.length || 0} prompts for organization ${organizationId}`);
      return prompts || [];
    } catch (err) {
      logger.error(`[OrganizationPrompts] Error in getOrganizationPrompts: ${err.message}`);
      return [];
    }
  }

  /**
   * Get prompt IDs that an organization has access to (for LibreChat filtering)
   * @param {string} organizationId - Organization ID
   * @returns {Promise<Array>} Array of accessible LibreChat prompt group IDs
   */
  async getAccessiblePromptIds(organizationId) {
    try {
      const { data, error } = await this.supabase
        .from('prompt_library')
        .select('librechat_group_id')
        .eq('organization_id', organizationId);

      if (error) {
        logger.error(`[OrganizationPrompts] Error getting accessible prompt IDs: ${error.message}`);
        return [];
      }

      const promptIds = (data || [])
        .map(item => item.librechat_group_id)
        .filter(id => id); // Remove any null/undefined IDs

      logger.info(`[OrganizationPrompts] Organization ${organizationId} has access to ${promptIds.length} prompts`);
      return promptIds;
    } catch (error) {
      logger.error('[OrganizationPrompts] Error in getAccessiblePromptIds:', error);
      return [];
    }
  }

  /**
   * Check if organization has access to a specific prompt
   * @param {string} organizationId - Organization ID
   * @param {string} promptGroupId - LibreChat Prompt Group ID
   * @returns {Promise<boolean>} Whether organization has access
   */
  async hasPromptAccess(organizationId, promptGroupId) {
    try {
      const { data, error } = await this.supabase
        .from('prompt_library')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('librechat_group_id', promptGroupId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
        logger.error(`[OrganizationPrompts] Error checking prompt access: ${error.message}`);
        return false;
      }

      return !!data;
    } catch (error) {
      logger.error('[OrganizationPrompts] Error in hasPromptAccess:', error);
      return false;
    }
  }

  /**
   * Add default prompts for a new organization
   * @param {string} organizationId - Organization ID
   * @param {string} userId - User ID who is setting up the organization
   * @returns {Promise<Array>} Created default prompts
   */
  async setupDefaultPrompts(organizationId, userId) {
    const defaultPrompts = [
      {
        organization_id: organizationId,
        librechat_group_id: null, // Will be set when LibreChat prompt is created
        name: 'Meeting Summary',
        description: 'Summarize meeting notes into key action items and decisions.',
        category: 'general',
        is_public: false,
        is_default: true,
        created_by: userId
      },
      {
        organization_id: organizationId,
        librechat_group_id: null,
        name: 'Email Response Template',
        description: 'Generate a professional email response to a customer inquiry.',
        category: 'customer_support',
        is_public: false,
        is_default: true,
        created_by: userId
      },
      {
        organization_id: organizationId,
        librechat_group_id: null,
        name: 'Content Outline Generator',
        description: 'Create an outline for a blog post on a given topic.',
        category: 'content_creation',
        is_public: false,
        is_default: true,
        created_by: userId
      },
      {
        organization_id: organizationId,
        librechat_group_id: null,
        name: 'Sales Proposal Framework',
        description: 'Outline a sales proposal for a client, including problem, solution, and pricing.',
        category: 'sales_marketing',
        is_public: false,
        is_default: true,
        created_by: userId
      }
    ];

    try {
      const { data, error } = await this.supabase
        .from('prompt_library')
        .insert(defaultPrompts)
        .select();

      if (error) {
        logger.error(`[OrganizationPrompts] Error creating default prompts: ${error.message}`);
        return [];
      }

      logger.info(`[OrganizationPrompts] Created ${data?.length || 0} default prompts for organization ${organizationId}`);
      return data || [];
    } catch (error) {
      logger.error('[OrganizationPrompts] Error in setupDefaultPrompts:', error);
      return [];
    }
  }

  /**
   * Convert Supabase prompt to LibreChat format
   * @param {Object} supabasePrompt - Prompt from Supabase
   * @returns {Object} LibreChat-formatted prompt
   */
  formatForLibreChat(supabasePrompt) {
    return {
      _id: supabasePrompt.librechat_group_id,
      title: supabasePrompt.name,
      description: supabasePrompt.description,
      category: supabasePrompt.category,
      isPublic: supabasePrompt.is_public,
      // Add other LibreChat-specific fields as needed
    };
  }
}

module.exports = OrganizationPromptsService;
