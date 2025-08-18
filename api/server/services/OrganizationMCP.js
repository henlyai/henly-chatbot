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
      const { data: mcpServers, error } = await this.supabase
        .from('mcp_servers')
        .select('id, name, description, endpoint, capabilities, is_active, organization_id')
        .eq('organization_id', organizationId)
        .eq('is_active', true);

      if (error) {
        logger.error('[OrganizationMCP] Error fetching MCP servers:', error);
        return {};
      }

      // Convert to LibreChat format
      const librechatConfig = {};
      
      for (const server of mcpServers) {
        librechatConfig[server.name] = {
          type: 'sse',
          url: server.endpoint,
          timeout: 60000,
          description: server.description,
          capabilities: server.capabilities || []
        };

        // Add OAuth configuration if needed
        if (server.name === 'Google Drive') {
          librechatConfig[server.name].oauth = {
            authorization_url: 'https://accounts.google.com/o/oauth2/auth',
            token_url: 'https://oauth2.googleapis.com/token',
            scope: 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.file',
            client_id: process.env.GOOGLE_CLIENT_ID,
            client_secret: process.env.GOOGLE_CLIENT_SECRET,
            redirect_uri: `${server.endpoint}/oauth/callback`
          };
        }
      }

      logger.info(`[OrganizationMCP] Loaded ${Object.keys(librechatConfig).length} MCP servers for organization ${organizationId}`);
      return librechatConfig;

    } catch (error) {
      logger.error('[OrganizationMCP] Error in getOrganizationMCPServers:', error);
      return {};
    }
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