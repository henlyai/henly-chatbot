const { createClient } = require('@supabase/supabase-js');
const { logger } = require('@librechat/data-schemas');

/**
 * Simple Super Admin Service for cross-organization management
 * Works with the MCP-style approach using direct Supabase queries
 */
class SuperAdminService {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );
  }

  /**
   * Get dashboard statistics
   * @returns {Promise<Object>} Dashboard stats
   */
  async getDashboardStats() {
    try {
      const [orgsResult, agentsResult, promptsResult, usersResult] = await Promise.all([
        this.supabase.from('organizations').select('id', { count: 'exact' }),
        this.supabase.from('agent_library').select('id', { count: 'exact' }),
        this.supabase.from('prompt_library').select('id', { count: 'exact' }),
        this.supabase.from('profiles').select('id', { count: 'exact' })
      ]);

      return {
        totalOrganizations: orgsResult.count || 0,
        totalAgents: agentsResult.count || 0,
        totalPrompts: promptsResult.count || 0,
        totalUsers: usersResult.count || 0
      };
    } catch (error) {
      logger.error('[SuperAdmin] Error getting dashboard stats:', error);
      throw error;
    }
  }

  /**
   * Get all agents across organizations
   * @returns {Promise<Array>} All agents with organization info
   */
  async getAllAgents() {
    try {
      const { data: agents, error } = await this.supabase
        .from('agent_library')
        .select(`
          *,
          organizations (id, name, domain),
          profiles (email)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return agents;
    } catch (error) {
      logger.error('[SuperAdmin] Error getting all agents:', error);
      throw error;
    }
  }

  /**
   * Get all prompts across organizations
   * @returns {Promise<Array>} All prompts with organization info
   */
  async getAllPrompts() {
    try {
      const { data: prompts, error } = await this.supabase
        .from('prompt_library')
        .select(`
          *,
          organizations (id, name, domain),
          profiles (email)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return prompts;
    } catch (error) {
      logger.error('[SuperAdmin] Error getting all prompts:', error);
      throw error;
    }
  }

  /**
   * Get all organizations with counts
   * @returns {Promise<Array>} Organizations with member/content counts
   */
  async getAllOrganizations() {
    try {
      const { data: orgs, error } = await this.supabase
        .from('organizations')
        .select(`
          id,
          name,
          domain,
          plan_type,
          created_at,
          updated_at
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get counts for each organization
      const orgsWithCounts = await Promise.all(
        orgs.map(async (org) => {
          const [membersResult, agentsResult, promptsResult] = await Promise.all([
            this.supabase.from('profiles').select('id', { count: 'exact' }).eq('organization_id', org.id),
            this.supabase.from('agent_library').select('id', { count: 'exact' }).eq('organization_id', org.id),
            this.supabase.from('prompt_library').select('id', { count: 'exact' }).eq('organization_id', org.id)
          ]);

          return {
            ...org,
            member_count: membersResult.count || 0,
            agent_count: agentsResult.count || 0,
            prompt_count: promptsResult.count || 0
          };
        })
      );

      return orgsWithCounts;
    } catch (error) {
      logger.error('[SuperAdmin] Error getting all organizations:', error);
      throw error;
    }
  }

  /**
   * Share agent to target organization
   * @param {string} agentId - Agent ID to share
   * @param {string} sourceOrgId - Source organization ID
   * @param {string} targetOrgId - Target organization ID
   * @returns {Promise<Object>} Shared agent
   */
  async shareAgent(agentId, sourceOrgId, targetOrgId) {
    try {
      // Get the original agent
      const { data: sourceAgent, error: fetchError } = await this.supabase
        .from('agent_library')
        .select('*')
        .eq('id', agentId)
        .eq('organization_id', sourceOrgId)
        .single();

      if (fetchError || !sourceAgent) {
        throw new Error('Source agent not found');
      }

      // Create a copy in the target organization
      const sharedAgent = {
        organization_id: targetOrgId,
        name: sourceAgent.name,
        description: sourceAgent.description,
        category: sourceAgent.category,
        avatar_url: sourceAgent.avatar_url,
        created_by: sourceAgent.created_by, // Keep original creator
        usage_count: 0,
        is_default: false,
        sync_status: 'synced',
        librechat_config: sourceAgent.librechat_config
      };

      const { data: newAgent, error: createError } = await this.supabase
        .from('agent_library')
        .insert([sharedAgent])
        .select()
        .single();

      if (createError) throw createError;

      logger.info(`[SuperAdmin] Shared agent "${sourceAgent.name}" from ${sourceOrgId} to ${targetOrgId}`);
      return newAgent;
    } catch (error) {
      logger.error('[SuperAdmin] Error sharing agent:', error);
      throw error;
    }
  }

  /**
   * Share prompt to target organization
   * @param {string} promptId - Prompt ID to share
   * @param {string} sourceOrgId - Source organization ID
   * @param {string} targetOrgId - Target organization ID
   * @returns {Promise<Object>} Shared prompt
   */
  async sharePrompt(promptId, sourceOrgId, targetOrgId) {
    try {
      // Get the original prompt
      const { data: sourcePrompt, error: fetchError } = await this.supabase
        .from('prompt_library')
        .select('*')
        .eq('id', promptId)
        .eq('organization_id', sourceOrgId)
        .single();

      if (fetchError || !sourcePrompt) {
        throw new Error('Source prompt not found');
      }

      // Create a copy in the target organization
      const sharedPrompt = {
        organization_id: targetOrgId,
        name: sourcePrompt.name,
        description: sourcePrompt.description,
        prompt_text: sourcePrompt.prompt_text,
        category: sourcePrompt.category,
        created_by: sourcePrompt.created_by, // Keep original creator
        usage_count: 0,
        is_default: false,
        sync_status: 'synced'
      };

      const { data: newPrompt, error: createError } = await this.supabase
        .from('prompt_library')
        .insert([sharedPrompt])
        .select()
        .single();

      if (createError) throw createError;

      logger.info(`[SuperAdmin] Shared prompt "${sourcePrompt.name}" from ${sourceOrgId} to ${targetOrgId}`);
      return newPrompt;
    } catch (error) {
      logger.error('[SuperAdmin] Error sharing prompt:', error);
      throw error;
    }
  }

  /**
   * Duplicate agent to target organization (creates independent copy)
   * @param {string} agentId - Agent ID to duplicate
   * @param {string} sourceOrgId - Source organization ID
   * @param {string} targetOrgId - Target organization ID
   * @returns {Promise<Object>} Duplicated agent
   */
  async duplicateAgent(agentId, sourceOrgId, targetOrgId) {
    try {
      // Get the original agent
      const { data: sourceAgent, error: fetchError } = await this.supabase
        .from('agent_library')
        .select('*')
        .eq('id', agentId)
        .eq('organization_id', sourceOrgId)
        .single();

      if (fetchError || !sourceAgent) {
        throw new Error('Source agent not found');
      }

      // Create a duplicate with modified name
      const duplicatedAgent = {
        organization_id: targetOrgId,
        name: `Copy of ${sourceAgent.name}`,
        description: sourceAgent.description,
        category: sourceAgent.category,
        avatar_url: sourceAgent.avatar_url,
        created_by: sourceAgent.created_by,
        usage_count: 0,
        is_default: false,
        sync_status: 'synced',
        librechat_config: sourceAgent.librechat_config
      };

      const { data: newAgent, error: createError } = await this.supabase
        .from('agent_library')
        .insert([duplicatedAgent])
        .select()
        .single();

      if (createError) throw createError;

      logger.info(`[SuperAdmin] Duplicated agent "${sourceAgent.name}" from ${sourceOrgId} to ${targetOrgId}`);
      return newAgent;
    } catch (error) {
      logger.error('[SuperAdmin] Error duplicating agent:', error);
      throw error;
    }
  }

  /**
   * Revoke access to agent or prompt
   * @param {string} resourceType - 'agents' or 'prompts'
   * @param {string} resourceId - Resource ID to revoke
   * @param {string} organizationId - Organization to revoke from
   * @returns {Promise<Object>} Success result
   */
  async revokeAccess(resourceType, resourceId, organizationId) {
    try {
      const tableName = resourceType === 'agents' ? 'agent_library' : 'prompt_library';
      
      const { error } = await this.supabase
        .from(tableName)
        .delete()
        .eq('id', resourceId)
        .eq('organization_id', organizationId);

      if (error) throw error;

      logger.info(`[SuperAdmin] Revoked ${resourceType} ${resourceId} from organization ${organizationId}`);
      return { success: true };
    } catch (error) {
      logger.error('[SuperAdmin] Error revoking access:', error);
      throw error;
    }
  }

  /**
   * Update agent details
   * @param {string} agentId - Agent ID
   * @param {string} organizationId - Organization ID
   * @param {Object} updates - Updates to apply
   * @returns {Promise<Object>} Updated agent
   */
  async updateAgent(agentId, organizationId, updates) {
    try {
      const { data: updatedAgent, error } = await this.supabase
        .from('agent_library')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', agentId)
        .eq('organization_id', organizationId)
        .select()
        .single();

      if (error) throw error;
      return updatedAgent;
    } catch (error) {
      logger.error('[SuperAdmin] Error updating agent:', error);
      throw error;
    }
  }

  /**
   * Update prompt details
   * @param {string} promptId - Prompt ID
   * @param {string} organizationId - Organization ID
   * @param {Object} updates - Updates to apply
   * @returns {Promise<Object>} Updated prompt
   */
  async updatePrompt(promptId, organizationId, updates) {
    try {
      const { data: updatedPrompt, error } = await this.supabase
        .from('prompt_library')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', promptId)
        .eq('organization_id', organizationId)
        .select()
        .single();

      if (error) throw error;
      return updatedPrompt;
    } catch (error) {
      logger.error('[SuperAdmin] Error updating prompt:', error);
      throw error;
    }
  }
}

module.exports = SuperAdminService;
