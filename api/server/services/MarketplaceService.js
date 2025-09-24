const { createClient } = require('@supabase/supabase-js');
const { logger } = require('@librechat/data-schemas');
const { getAgent, updateAgent } = require('~/models/Agent');
const { getPromptGroup, updatePromptGroup } = require('~/models/Prompt');

class MarketplaceService {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );
  }

  /**
   * Publish an agent to the marketplace
   * @param {string} librechatAgentId - LibreChat agent ID
   * @param {string} organizationId - Organization ID
   * @param {string} userId - User ID who is publishing
   * @param {Object} options - Publishing options
   * @returns {Promise<Object>} Published agent data
   */
  async publishAgent(librechatAgentId, organizationId, userId, options = {}) {
    try {
      logger.info(`[MarketplaceService] Publishing agent ${librechatAgentId} for org ${organizationId}`);

      // 1. Get agent from LibreChat MongoDB
      const agent = await getAgent({ id: librechatAgentId });
      if (!agent) {
        throw new Error('Agent not found in LibreChat');
      }

      // 2. Create/update entry in Supabase marketplace
      const marketplaceData = {
        organization_id: organizationId,
        librechat_agent_id: librechatAgentId,
        name: agent.name,
        description: agent.description || '',
        category: options.category || 'general',
        avatar_url: agent.avatar || null,
        is_public: options.isPublic || false,
        created_by: userId,
        updated_at: new Date().toISOString()
      };

      const { data, error } = await this.supabase
        .from('agent_library')
        .upsert(marketplaceData, {
          onConflict: 'librechat_agent_id,organization_id'
        })
        .select()
        .single();

      if (error) {
        logger.error(`[MarketplaceService] Error upserting agent to marketplace: ${error.message}`);
        throw error;
      }

      logger.info(`[MarketplaceService] Agent published successfully: ${data.id}`);
      return data;

    } catch (error) {
      logger.error('[MarketplaceService] Error in publishAgent:', error);
      throw error;
    }
  }

  /**
   * Publish a prompt to the marketplace
   * @param {string} librechatGroupId - LibreChat prompt group ID
   * @param {string} organizationId - Organization ID
   * @param {string} userId - User ID who is publishing
   * @param {Object} options - Publishing options
   * @returns {Promise<Object>} Published prompt data
   */
  async publishPrompt(librechatGroupId, organizationId, userId, options = {}) {
    try {
      logger.info(`[MarketplaceService] Publishing prompt ${librechatGroupId} for org ${organizationId}`);

      // 1. Get prompt group from LibreChat MongoDB
      const promptGroup = await getPromptGroup({ _id: librechatGroupId });
      if (!promptGroup) {
        throw new Error('Prompt group not found in LibreChat');
      }

      // 2. Create/update entry in Supabase marketplace
      const marketplaceData = {
        organization_id: organizationId,
        librechat_group_id: librechatGroupId,
        name: promptGroup.name,
        description: promptGroup.description || '',
        category: options.category || 'general',
        is_public: options.isPublic || false,
        created_by: userId,
        updated_at: new Date().toISOString()
      };

      const { data, error } = await this.supabase
        .from('prompt_library')
        .upsert(marketplaceData, {
          onConflict: 'librechat_group_id,organization_id'
        })
        .select()
        .single();

      if (error) {
        logger.error(`[MarketplaceService] Error upserting prompt to marketplace: ${error.message}`);
        throw error;
      }

      logger.info(`[MarketplaceService] Prompt published successfully: ${data.id}`);
      return data;

    } catch (error) {
      logger.error('[MarketplaceService] Error in publishPrompt:', error);
      throw error;
    }
  }

  /**
   * Get marketplace agents available to an organization
   * @param {string} organizationId - Organization ID
   * @param {Object} filters - Optional filters (category, search, etc.)
   * @returns {Promise<Array>} Available agents
   */
  async getMarketplaceAgents(organizationId, filters = {}) {
    try {
      logger.info(`[MarketplaceService] Getting marketplace agents for org ${organizationId}`);

      let query = this.supabase
        .from('agent_library')
        .select(`
          id,
          organization_id,
          librechat_agent_id,
          name,
          description,
          category,
          avatar_url,
          is_public,
          usage_count,
          created_at,
          updated_at
        `);

      // Apply filters
      if (filters.category && filters.category !== 'all') {
        query = query.eq('category', filters.category);
      }

      if (filters.search) {
        query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
      }

      // Get public agents + own org agents + agents with access granted
      query = query.or(
        `is_public.eq.true,organization_id.eq.${organizationId},id.in.(${await this.getAccessibleResourceIds(organizationId, 'agent')})`
      );

      const { data, error } = await query.order('usage_count', { ascending: false });

      if (error) {
        logger.error(`[MarketplaceService] Error fetching marketplace agents: ${error.message}`);
        throw error;
      }

      logger.info(`[MarketplaceService] Found ${data.length} marketplace agents`);
      return data;

    } catch (error) {
      logger.error('[MarketplaceService] Error in getMarketplaceAgents:', error);
      throw error;
    }
  }

  /**
   * Get marketplace prompts available to an organization
   * @param {string} organizationId - Organization ID
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>} Available prompts
   */
  async getMarketplacePrompts(organizationId, filters = {}) {
    try {
      logger.info(`[MarketplaceService] Getting marketplace prompts for org ${organizationId}`);

      let query = this.supabase
        .from('prompt_library')
        .select(`
          id,
          organization_id,
          librechat_group_id,
          name,
          description,
          category,
          is_public,
          usage_count,
          created_at,
          updated_at
        `);

      // Apply filters
      if (filters.category && filters.category !== 'all') {
        query = query.eq('category', filters.category);
      }

      if (filters.search) {
        query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
      }

      // Get public prompts + own org prompts + prompts with access granted
      query = query.or(
        `is_public.eq.true,organization_id.eq.${organizationId},id.in.(${await this.getAccessibleResourceIds(organizationId, 'prompt')})`
      );

      const { data, error } = await query.order('usage_count', { ascending: false });

      if (error) {
        logger.error(`[MarketplaceService] Error fetching marketplace prompts: ${error.message}`);
        throw error;
      }

      logger.info(`[MarketplaceService] Found ${data.length} marketplace prompts`);
      return data;

    } catch (error) {
      logger.error('[MarketplaceService] Error in getMarketplacePrompts:', error);
      throw error;
    }
  }

  /**
   * Install an agent from marketplace to organization
   * @param {string} agentLibraryId - Marketplace agent ID
   * @param {string} targetOrgId - Target organization ID
   * @param {string} userId - User installing
   * @returns {Promise<Object>} Installation result
   */
  async installAgent(agentLibraryId, targetOrgId, userId) {
    try {
      logger.info(`[MarketplaceService] Installing agent ${agentLibraryId} to org ${targetOrgId}`);

      // 1. Get marketplace agent
      const { data: marketplaceAgent, error } = await this.supabase
        .from('agent_library')
        .select('*')
        .eq('id', agentLibraryId)
        .single();

      if (error || !marketplaceAgent) {
        throw new Error('Marketplace agent not found');
      }

      // 2. Check if already installed
      const existingAccess = await this.checkAccess(targetOrgId, 'agent', agentLibraryId);
      if (existingAccess) {
        return { success: true, message: 'Agent already installed' };
      }

      // 3. Grant access
      const { error: accessError } = await this.supabase
        .from('marketplace_access')
        .insert({
          resource_type: 'agent',
          resource_id: agentLibraryId,
          organization_id: targetOrgId,
          granted_by_org_id: marketplaceAgent.organization_id
        });

      if (accessError) {
        logger.error(`[MarketplaceService] Error granting access: ${accessError.message}`);
        throw accessError;
      }

      // 4. Track usage
      await this.trackUsage('agent', agentLibraryId, targetOrgId, userId, 'install');

      // 5. Update usage count
      await this.supabase
        .from('agent_library')
        .update({ usage_count: marketplaceAgent.usage_count + 1 })
        .eq('id', agentLibraryId);

      logger.info(`[MarketplaceService] Agent installed successfully`);
      return { success: true, message: 'Agent installed successfully' };

    } catch (error) {
      logger.error('[MarketplaceService] Error in installAgent:', error);
      throw error;
    }
  }

  /**
   * Install a prompt from marketplace to organization
   * @param {string} promptLibraryId - Marketplace prompt ID
   * @param {string} targetOrgId - Target organization ID
   * @param {string} userId - User installing
   * @returns {Promise<Object>} Installation result
   */
  async installPrompt(promptLibraryId, targetOrgId, userId) {
    try {
      logger.info(`[MarketplaceService] Installing prompt ${promptLibraryId} to org ${targetOrgId}`);

      // Similar logic to installAgent but for prompts
      const { data: marketplacePrompt, error } = await this.supabase
        .from('prompt_library')
        .select('*')
        .eq('id', promptLibraryId)
        .single();

      if (error || !marketplacePrompt) {
        throw new Error('Marketplace prompt not found');
      }

      const existingAccess = await this.checkAccess(targetOrgId, 'prompt', promptLibraryId);
      if (existingAccess) {
        return { success: true, message: 'Prompt already installed' };
      }

      const { error: accessError } = await this.supabase
        .from('marketplace_access')
        .insert({
          resource_type: 'prompt',
          resource_id: promptLibraryId,
          organization_id: targetOrgId,
          granted_by_org_id: marketplacePrompt.organization_id
        });

      if (accessError) {
        throw accessError;
      }

      await this.trackUsage('prompt', promptLibraryId, targetOrgId, userId, 'install');

      await this.supabase
        .from('prompt_library')
        .update({ usage_count: marketplacePrompt.usage_count + 1 })
        .eq('id', promptLibraryId);

      logger.info(`[MarketplaceService] Prompt installed successfully`);
      return { success: true, message: 'Prompt installed successfully' };

    } catch (error) {
      logger.error('[MarketplaceService] Error in installPrompt:', error);
      throw error;
    }
  }

  /**
   * Track marketplace usage
   * @param {string} resourceType - 'agent' or 'prompt'
   * @param {string} resourceId - Resource ID
   * @param {string} organizationId - Organization ID
   * @param {string} userId - User ID
   * @param {string} actionType - 'install' or 'use'
   * @param {string} sessionId - Optional session ID
   * @returns {Promise<Object>} Usage record
   */
  async trackUsage(resourceType, resourceId, organizationId, userId, actionType, sessionId = null) {
    try {
      const { data, error } = await this.supabase
        .from('marketplace_usage')
        .insert({
          resource_type: resourceType,
          resource_id: resourceId,
          organization_id: organizationId,
          user_id: userId,
          action_type: actionType,
          session_id: sessionId
        })
        .select()
        .single();

      if (error) {
        logger.error(`[MarketplaceService] Error tracking usage: ${error.message}`);
        // Don't throw here, usage tracking shouldn't break main functionality
        return null;
      }

      return data;
    } catch (error) {
      logger.error('[MarketplaceService] Error in trackUsage:', error);
      return null;
    }
  }

  /**
   * Check if organization has access to a resource
   * @param {string} organizationId - Organization ID
   * @param {string} resourceType - 'agent' or 'prompt'
   * @param {string} resourceId - Resource ID
   * @returns {Promise<boolean>} Has access
   */
  async checkAccess(organizationId, resourceType, resourceId) {
    try {
      const { data, error } = await this.supabase
        .from('marketplace_access')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('resource_type', resourceType)
        .eq('resource_id', resourceId)
        .single();

      return !error && data;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get accessible resource IDs for an organization
   * @param {string} organizationId - Organization ID
   * @param {string} resourceType - 'agent' or 'prompt'
   * @returns {Promise<string>} Comma-separated resource IDs
   */
  async getAccessibleResourceIds(organizationId, resourceType) {
    try {
      const { data, error } = await this.supabase
        .from('marketplace_access')
        .select('resource_id')
        .eq('organization_id', organizationId)
        .eq('resource_type', resourceType);

      if (error || !data || data.length === 0) {
        return '';
      }

      return data.map(d => d.resource_id).join(',');
    } catch (error) {
      return '';
    }
  }

  /**
   * Get marketplace settings for an organization
   * @param {string} organizationId - Organization ID
   * @returns {Promise<Object>} Marketplace settings
   */
  async getMarketplaceSettings(organizationId) {
    try {
      const { data, error } = await this.supabase
        .from('organizations')
        .select('marketplace_settings')
        .eq('id', organizationId)
        .single();

      if (error) {
        logger.error(`[MarketplaceService] Error fetching marketplace settings: ${error.message}`);
        return this.getDefaultMarketplaceSettings();
      }

      return data.marketplace_settings || this.getDefaultMarketplaceSettings();
    } catch (error) {
      logger.error('[MarketplaceService] Error in getMarketplaceSettings:', error);
      return this.getDefaultMarketplaceSettings();
    }
  }

  /**
   * Get default marketplace settings
   * @returns {Object} Default settings
   */
  getDefaultMarketplaceSettings() {
    return {
      enabled: true,
      allow_public_sharing: true,
      max_public_agents: 10,
      max_public_prompts: 20
    };
  }

  /**
   * Sync agent to organization's available agents
   * @param {Object} agent - LibreChat agent object
   * @param {string} organizationId - Organization ID
   * @returns {Promise<Object>} Synced agent data
   */
  async syncAgentToOrganization(agent, organizationId) {
    try {
      const { data: existingAgent } = await this.supabase
        .from('agent_library')
        .select('*')
        .eq('librechat_agent_id', agent.id)
        .eq('organization_id', organizationId)
        .single();

      const agentData = {
        organization_id: organizationId,
        librechat_agent_id: agent.id,
        name: agent.name || 'Untitled Agent',
        description: agent.description || '',
        category: agent.category || 'general',
        is_public: false,
        usage_count: 0
      };

      if (existingAgent) {
        const { data, error } = await this.supabase
          .from('agent_library')
          .update(agentData)
          .eq('id', existingAgent.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        const { data, error } = await this.supabase
          .from('agent_library')
          .insert([agentData])
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    } catch (error) {
      logger.error('[MarketplaceService] Error syncing agent to organization:', error);
      throw error;
    }
  }

  /**
   * Get agent IDs that an organization has access to
   * @param {string} organizationId - Organization ID
   * @returns {Promise<Array>} Array of accessible LibreChat agent IDs
   */
  async getOrganizationAgentIds(organizationId) {
    try {
      const { data, error } = await this.supabase
        .from('agent_library')
        .select('librechat_agent_id')
        .eq('organization_id', organizationId);

      if (error) {
        logger.error(`[MarketplaceService] Error getting organization agent IDs: ${error.message}`);
        throw error;
      }

      return data.map(item => item.librechat_agent_id);
    } catch (error) {
      logger.error('[MarketplaceService] Error in getOrganizationAgentIds:', error);
      throw error;
    }
  }
}

module.exports = MarketplaceService;
