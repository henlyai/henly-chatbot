const { createClient } = require('@supabase/supabase-js');
const { logger } = require('@librechat/data-schemas');

class OrganizationAgentsService {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );
  }

  /**
   * Get agents for a specific organization from Supabase
   * @param {string} organizationId - The organization ID
   * @returns {Promise<Array>} Array of agent configurations
   */
  async getOrganizationAgents(organizationId) {
    try {
      logger.info(`[OrganizationAgents] Fetching agents for organization: ${organizationId}`);
      
      const { data: agents, error } = await this.supabase
        .from('agent_library')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error(`[OrganizationAgents] Error fetching agents: ${error.message}`);
        return [];
      }

      logger.info(`[OrganizationAgents] Found ${agents?.length || 0} agents for organization ${organizationId}`);
      return agents || [];
    } catch (err) {
      logger.error(`[OrganizationAgents] Error in getOrganizationAgents: ${err.message}`);
      return [];
    }
  }

  /**
   * Get agent IDs that an organization has access to (for LibreChat filtering)
   * @param {string} organizationId - Organization ID
   * @returns {Promise<Array>} Array of accessible LibreChat agent IDs
   */
  async getAccessibleAgentIds(organizationId) {
    try {
      const { data, error } = await this.supabase
        .from('agent_library')
        .select('librechat_agent_id')
        .eq('organization_id', organizationId);

      if (error) {
        logger.error(`[OrganizationAgents] Error getting accessible agent IDs: ${error.message}`);
        return [];
      }

      const agentIds = (data || [])
        .map(item => item.librechat_agent_id)
        .filter(id => id); // Remove any null/undefined IDs

      logger.info(`[OrganizationAgents] Organization ${organizationId} has access to ${agentIds.length} agents`);
      return agentIds;
    } catch (error) {
      logger.error('[OrganizationAgents] Error in getAccessibleAgentIds:', error);
      return [];
    }
  }

  /**
   * Check if organization has access to a specific agent
   * @param {string} organizationId - Organization ID
   * @param {string} agentId - LibreChat Agent ID
   * @returns {Promise<boolean>} Whether organization has access
   */
  async hasAgentAccess(organizationId, agentId) {
    try {
      const { data, error } = await this.supabase
        .from('agent_library')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('librechat_agent_id', agentId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
        logger.error(`[OrganizationAgents] Error checking agent access: ${error.message}`);
        return false;
      }

      return !!data;
    } catch (error) {
      logger.error('[OrganizationAgents] Error in hasAgentAccess:', error);
      return false;
    }
  }

  /**
   * Add default agents for a new organization
   * @param {string} organizationId - Organization ID
   * @param {string} userId - User ID who is setting up the organization
   * @returns {Promise<Array>} Created default agents
   */
  async setupDefaultAgents(organizationId, userId) {
    const defaultAgents = [
      {
        organization_id: organizationId,
        librechat_agent_id: null, // Will be set when LibreChat agent is created
        name: 'Sales Assistant',
        description: 'Helps with lead qualification, proposal generation, and CRM updates.',
        category: 'sales_marketing',
        is_public: false,
        is_default: true,
        created_by: userId
      },
      {
        organization_id: organizationId,
        librechat_agent_id: null,
        name: 'Customer Support Agent',
        description: 'Assists with troubleshooting, answering FAQs, and managing support tickets.',
        category: 'customer_support',
        is_public: false,
        is_default: true,
        created_by: userId
      },
      {
        organization_id: organizationId,
        librechat_agent_id: null,
        name: 'Content Creator',
        description: 'Generates marketing content, blog posts, and SEO-optimized articles.',
        category: 'content_creation',
        is_public: false,
        is_default: true,
        created_by: userId
      }
    ];

    try {
      const { data, error } = await this.supabase
        .from('agent_library')
        .insert(defaultAgents)
        .select();

      if (error) {
        logger.error(`[OrganizationAgents] Error creating default agents: ${error.message}`);
        return [];
      }

      logger.info(`[OrganizationAgents] Created ${data?.length || 0} default agents for organization ${organizationId}`);
      return data || [];
    } catch (error) {
      logger.error('[OrganizationAgents] Error in setupDefaultAgents:', error);
      return [];
    }
  }
}

module.exports = OrganizationAgentsService;
