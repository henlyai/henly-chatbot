const { createClient } = require('@supabase/supabase-js');
const { logger } = require('@librechat/data-schemas');

class OrganizationMCPService {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );
  }

  /**
   * Get MCP servers for a specific organization
   * @param {string} organizationId - The organization ID
   * @returns {Promise<Object>} MCP configuration for LibreChat
   */
  async getOrganizationMCPServers(organizationId) {
    try {
      logger.info(`[OrganizationMCP] Fetching MCP servers for organization: ${organizationId}`);
      
      // Log the environment variables to verify they're set
      logger.info(`[OrganizationMCP] SUPABASE_URL: ${process.env.SUPABASE_URL ? 'SET' : 'NOT SET'}`);
      logger.info(`[OrganizationMCP] SUPABASE_ANON_KEY: ${process.env.SUPABASE_ANON_KEY ? 'SET' : 'NOT SET'}`);
      
      let { data: mcpServers, error } = await this.supabase
        .from('mcp_servers')
        .select('id, name, description, endpoint, capabilities, is_active')
        .eq('organization_id', organizationId)
        .eq('is_active', true);

      if (error) {
        logger.error(`[OrganizationMCP] Error fetching MCP servers from Supabase: ${error.message}`);
        return null;
      }

      logger.info(`[OrganizationMCP] Raw Supabase result for ${organizationId}: ${JSON.stringify(mcpServers)}`);
      logger.info(`[OrganizationMCP] Found ${mcpServers ? mcpServers.length : 0} MCP servers in database`);

      // Convert to LibreChat format
      const librechatConfig = {};
      
      for (const server of mcpServers || []) {
        librechatConfig[server.name] = {
          type: 'sse',
          url: server.endpoint,
          timeout: 60000,
          description: server.description,
          capabilities: server.capabilities || [],
          headers: {
            'X-MCP-Client': organizationId // Use organization ID as session identifier
          }
        };

        // Note: OAuth configuration removed for app-level connections
        // OAuth will be handled dynamically when tools are used
        logger.info(`[OrganizationMCP] Added MCP config for ${server.name} (without OAuth for app-level)`);
      }

      logger.info(`[OrganizationMCP] Loaded ${Object.keys(librechatConfig).length} MCP servers for organization ${organizationId}`);
      logger.info(`[OrganizationMCP] Final config keys: ${Object.keys(librechatConfig).join(', ')}`);

      return librechatConfig;
    } catch (error) {
      logger.error('[OrganizationMCP] Error in getOrganizationMCPServers:', error);
      return {};
    }
  }

  /**
   * Get OAuth configuration for a specific server (used for user-specific connections)
   * @param {string} serverName - The name of the MCP server
   * @returns {Object|null} OAuth configuration or null if not needed
   */
  getOAuthConfig(serverName) {
    if (serverName === 'Google Drive') {
      return {
        authorization_url: 'https://accounts.google.com/o/oauth2/auth',
        token_url: 'https://oauth2.googleapis.com/token',
        scope: 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.file',
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: 'https://mcp-servers-production-c189.up.railway.app/oauth/callback'
      };
    }
    return null;
  }

  /**
   * Get default MCP configuration (fallback)
   * @returns {Object} Default MCP configuration
   */
  getDefaultMCPConfig() {
    return {
      "Google Drive": {
        type: "sse",
        url: "https://mcp-servers-production-c189.up.railway.app/sse",
        timeout: 60000,
        oauth: {
          authorization_url: "https://accounts.google.com/o/oauth2/auth",
          token_url: "https://oauth2.googleapis.com/token",
          scope: "https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.file",
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          redirect_uri: "https://mcp-servers-production-c189.up.railway.app/oauth/callback"
        }
      }
    };
  }

  /**
   * Get MCP configuration for a user
   * @param {Object} user - User object with organization_id
   * @returns {Promise<Object>} MCP configuration
   */
  async getUserMCPConfig(user) {
    if (!user?.organization_id) {
      logger.warn('[OrganizationMCP] No organization_id found for user, using default config');
      return this.getDefaultMCPConfig();
    }

    const orgConfig = await this.getOrganizationMCPServers(user.organization_id);
    
    // Fallback to default if no organization-specific config
    if (Object.keys(orgConfig).length === 0) {
      logger.warn(`[OrganizationMCP] No MCP servers found for organization ${user.organization_id}, using default`);
      return this.getDefaultMCPConfig();
    }

    return orgConfig;
  }
}

module.exports = OrganizationMCPService; 