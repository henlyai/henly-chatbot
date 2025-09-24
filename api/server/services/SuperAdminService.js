const { createClient } = require('@supabase/supabase-js');
const { logger } = require('@librechat/data-schemas');
const { getAgent, updateAgent } = require('~/models/Agent');
const { getPromptGroup, updatePromptGroup } = require('~/models/Prompt');
const MarketplaceService = require('./MarketplaceService');

class SuperAdminService {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );
    this.marketplaceService = new MarketplaceService();
  }

  /**
   * Get all agents across all organizations (super admin only)
   * @returns {Promise<Array>} All agents with organization info
   */
  async getAllAgents() {
    try {
      const { data, error } = await this.supabase
        .from('agent_library')
        .select(`
          *,
          organizations (
            name,
            domain,
            plan_type
          ),
          profiles!agent_library_created_by_fkey (
            full_name,
            email
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      // Enrich with LibreChat data
      const enrichedAgents = await Promise.all(
        data.map(async (agent) => {
          try {
            const librechatAgent = await getAgent({ _id: agent.librechat_agent_id });
            return {
              ...agent,
              organization_name: agent.organizations?.name || 'Unknown',
              creator_name: agent.profiles?.full_name || 'Unknown',
              librechat_data: librechatAgent ? {
                model: librechatAgent.model,
                provider: librechatAgent.provider,
                tools: librechatAgent.tools || [],
                instructions: librechatAgent.instructions
              } : null
            };
          } catch (err) {
            logger.warn(`Failed to get LibreChat data for agent ${agent.librechat_agent_id}:`, err);
            return {
              ...agent,
              organization_name: agent.organizations?.name || 'Unknown',
              creator_name: agent.profiles?.full_name || 'Unknown',
              librechat_data: null
            };
          }
        })
      );

      return enrichedAgents;
    } catch (error) {
      logger.error('[SuperAdminService] Error getting all agents:', error);
      throw error;
    }
  }

  /**
   * Get all prompts across all organizations (super admin only)
   * @returns {Promise<Array>} All prompts with organization info
   */
  async getAllPrompts() {
    try {
      const { data, error } = await this.supabase
        .from('prompt_library')
        .select(`
          *,
          organizations (
            name,
            domain,
            plan_type
          ),
          profiles!prompt_library_created_by_fkey (
            full_name,
            email
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return data.map(prompt => ({
        ...prompt,
        organization_name: prompt.organizations?.name || 'Unknown',
        creator_name: prompt.profiles?.full_name || 'Unknown'
      }));
    } catch (error) {
      logger.error('[SuperAdminService] Error getting all prompts:', error);
      throw error;
    }
  }

  /**
   * Get all organizations with stats (super admin only)
   * @returns {Promise<Array>} All organizations with member and resource counts
   */
  async getAllOrganizations() {
    try {
      const { data, error } = await this.supabase
        .from('organizations')
        .select(`
          *,
          profiles (count)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      // Get agent and prompt counts for each organization
      const enrichedOrgs = await Promise.all(
        data.map(async (org) => {
          const [agentCount, promptCount] = await Promise.all([
            this.getOrganizationResourceCount('agent_library', org.id),
            this.getOrganizationResourceCount('prompt_library', org.id)
          ]);

          return {
            ...org,
            member_count: org.profiles?.[0]?.count || 0,
            agent_count: agentCount,
            prompt_count: promptCount
          };
        })
      );

      return enrichedOrgs;
    } catch (error) {
      logger.error('[SuperAdminService] Error getting all organizations:', error);
      throw error;
    }
  }

  /**
   * Share an agent to another organization
   * @param {string} agentId - Supabase agent library ID
   * @param {string} sourceOrgId - Source organization ID
   * @param {string} targetOrgId - Target organization ID
   * @param {string} adminUserId - Super admin user ID
   * @returns {Promise<Object>} Shared agent data
   */
  async shareAgentToOrganization(agentId, sourceOrgId, targetOrgId, adminUserId) {
    try {
      logger.info(`[SuperAdminService] Sharing agent ${agentId} from ${sourceOrgId} to ${targetOrgId}`);

      // Get the source agent
      const { data: sourceAgent, error: fetchError } = await this.supabase
        .from('agent_library')
        .select('*')
        .eq('id', agentId)
        .eq('organization_id', sourceOrgId)
        .single();

      if (fetchError || !sourceAgent) {
        throw new Error('Source agent not found');
      }

      // Check if already shared
      const { data: existingShare } = await this.supabase
        .from('agent_library')
        .select('id')
        .eq('librechat_agent_id', sourceAgent.librechat_agent_id)
        .eq('organization_id', targetOrgId)
        .single();

      if (existingShare) {
        throw new Error('Agent already shared to this organization');
      }

      // Create shared copy
      const sharedAgentData = {
        organization_id: targetOrgId,
        librechat_agent_id: sourceAgent.librechat_agent_id,
        name: `${sourceAgent.name} (Shared)`,
        description: sourceAgent.description,
        category: sourceAgent.category,
        is_default: false,
        usage_count: 0,
        created_by: adminUserId
      };

      const { data: sharedAgent, error: shareError } = await this.supabase
        .from('agent_library')
        .insert([sharedAgentData])
        .select()
        .single();

      if (shareError) {
        throw shareError;
      }

      logger.info(`[SuperAdminService] Agent shared successfully: ${sharedAgent.id}`);
      return sharedAgent;

    } catch (error) {
      logger.error('[SuperAdminService] Error sharing agent:', error);
      throw error;
    }
  }

  /**
   * Duplicate an agent to another organization
   * @param {string} agentId - Supabase agent library ID
   * @param {string} sourceOrgId - Source organization ID
   * @param {string} targetOrgId - Target organization ID
   * @param {string} adminUserId - Super admin user ID
   * @returns {Promise<Object>} Duplicated agent data
   */
  async duplicateAgentToOrganization(agentId, sourceOrgId, targetOrgId, adminUserId) {
    try {
      logger.info(`[SuperAdminService] Duplicating agent ${agentId} from ${sourceOrgId} to ${targetOrgId}`);

      // Get the source agent and its LibreChat data
      const { data: sourceAgent, error: fetchError } = await this.supabase
        .from('agent_library')
        .select('*')
        .eq('id', agentId)
        .eq('organization_id', sourceOrgId)
        .single();

      if (fetchError || !sourceAgent) {
        throw new Error('Source agent not found');
      }

      // Get LibreChat agent data
      const librechatAgent = await getAgent({ _id: sourceAgent.librechat_agent_id });
      if (!librechatAgent) {
        throw new Error('LibreChat agent data not found');
      }

      // Create new LibreChat agent (duplicate)
      // Note: This would need to be implemented in LibreChat's agent creation API
      // For now, we'll create a placeholder and log what needs to be done
      
      const newLibrechatAgentId = `duplicate_${Date.now()}_${sourceAgent.librechat_agent_id}`;
      
      // TODO: Implement actual LibreChat agent creation API call
      logger.info(`[SuperAdminService] Would create new LibreChat agent with data:`, {
        name: `${librechatAgent.name} (Copy)`,
        description: librechatAgent.description,
        instructions: librechatAgent.instructions,
        model: librechatAgent.model,
        provider: librechatAgent.provider,
        tools: librechatAgent.tools
      });

      // Create Supabase entry for the duplicated agent
      const duplicatedAgentData = {
        organization_id: targetOrgId,
        librechat_agent_id: newLibrechatAgentId,
        name: `${sourceAgent.name} (Copy)`,
        description: sourceAgent.description,
        category: sourceAgent.category,
        is_default: false,
        usage_count: 0,
        created_by: adminUserId
      };

      const { data: duplicatedAgent, error: duplicateError } = await this.supabase
        .from('agent_library')
        .insert([duplicatedAgentData])
        .select()
        .single();

      if (duplicateError) {
        throw duplicateError;
      }

      logger.info(`[SuperAdminService] Agent duplicated successfully: ${duplicatedAgent.id}`);
      return duplicatedAgent;

    } catch (error) {
      logger.error('[SuperAdminService] Error duplicating agent:', error);
      throw error;
    }
  }

  /**
   * Share a prompt to another organization
   * @param {string} promptId - Supabase prompt library ID
   * @param {string} sourceOrgId - Source organization ID
   * @param {string} targetOrgId - Target organization ID
   * @param {string} adminUserId - Super admin user ID
   * @returns {Promise<Object>} Shared prompt data
   */
  async sharePromptToOrganization(promptId, sourceOrgId, targetOrgId, adminUserId) {
    try {
      logger.info(`[SuperAdminService] Sharing prompt ${promptId} from ${sourceOrgId} to ${targetOrgId}`);

      // Get the source prompt
      const { data: sourcePrompt, error: fetchError } = await this.supabase
        .from('prompt_library')
        .select('*')
        .eq('id', promptId)
        .eq('organization_id', sourceOrgId)
        .single();

      if (fetchError || !sourcePrompt) {
        throw new Error('Source prompt not found');
      }

      // Check if already shared
      const { data: existingShare } = await this.supabase
        .from('prompt_library')
        .select('id')
        .eq('librechat_group_id', sourcePrompt.librechat_group_id)
        .eq('organization_id', targetOrgId)
        .single();

      if (existingShare) {
        throw new Error('Prompt already shared to this organization');
      }

      // Create shared copy
      const sharedPromptData = {
        organization_id: targetOrgId,
        librechat_group_id: sourcePrompt.librechat_group_id,
        name: `${sourcePrompt.name} (Shared)`,
        description: sourcePrompt.description,
        category: sourcePrompt.category,
        prompt_text: sourcePrompt.prompt_text,
        is_default: false,
        usage_count: 0,
        created_by: adminUserId
      };

      const { data: sharedPrompt, error: shareError } = await this.supabase
        .from('prompt_library')
        .insert([sharedPromptData])
        .select()
        .single();

      if (shareError) {
        throw shareError;
      }

      logger.info(`[SuperAdminService] Prompt shared successfully: ${sharedPrompt.id}`);
      return sharedPrompt;

    } catch (error) {
      logger.error('[SuperAdminService] Error sharing prompt:', error);
      throw error;
    }
  }

  /**
   * Delete a shared resource (remove access from organization)
   * @param {string} resourceType - 'agent' or 'prompt'
   * @param {string} resourceId - Supabase resource ID
   * @param {string} organizationId - Organization to remove access from
   * @returns {Promise<void>}
   */
  async revokeResourceAccess(resourceType, resourceId, organizationId) {
    try {
      const tableName = resourceType === 'agent' ? 'agent_library' : 'prompt_library';
      
      const { error } = await this.supabase
        .from(tableName)
        .delete()
        .eq('id', resourceId)
        .eq('organization_id', organizationId);

      if (error) {
        throw error;
      }

      logger.info(`[SuperAdminService] Revoked ${resourceType} access: ${resourceId} from org ${organizationId}`);
    } catch (error) {
      logger.error(`[SuperAdminService] Error revoking ${resourceType} access:`, error);
      throw error;
    }
  }

  /**
   * Get resource count for an organization
   * @param {string} tableName - Table to count from
   * @param {string} organizationId - Organization ID
   * @returns {Promise<number>} Count of resources
   */
  async getOrganizationResourceCount(tableName, organizationId) {
    try {
      const { count, error } = await this.supabase
        .from(tableName)
        .select('id', { count: 'exact' })
        .eq('organization_id', organizationId);

      if (error) {
        throw error;
      }

      return count || 0;
    } catch (error) {
      logger.error(`[SuperAdminService] Error getting resource count for ${tableName}:`, error);
      return 0;
    }
  }

  /**
   * Get super admin dashboard stats
   * @returns {Promise<Object>} Dashboard statistics
   */
  async getDashboardStats() {
    try {
      const [
        { count: totalOrgs },
        { count: totalAgents },
        { count: totalPrompts },
        { count: totalUsers }
      ] = await Promise.all([
        this.supabase.from('organizations').select('id', { count: 'exact' }),
        this.supabase.from('agent_library').select('id', { count: 'exact' }),
        this.supabase.from('prompt_library').select('id', { count: 'exact' }),
        this.supabase.from('profiles').select('id', { count: 'exact' })
      ]);

      return {
        totalOrganizations: totalOrgs || 0,
        totalAgents: totalAgents || 0,
        totalPrompts: totalPrompts || 0,
        totalUsers: totalUsers || 0
      };
    } catch (error) {
      logger.error('[SuperAdminService] Error getting dashboard stats:', error);
      throw error;
    }
  }
}

module.exports = SuperAdminService;
