const { logger } = require('@librechat/data-schemas');
const { CacheKeys, AuthType } = require('librechat-data-provider');
const { getCustomConfig, getCachedTools } = require('~/server/services/Config');
const { getToolkitKey } = require('~/server/services/ToolService');
const { getMCPManager, getFlowStateManager } = require('~/config');
const { availableTools } = require('~/app/clients/tools');
const { getLogStores } = require('~/cache');
const { Constants } = require('librechat-data-provider');

/**
 * Filters out duplicate plugins from the list of plugins.
 *
 * @param {TPlugin[]} plugins The list of plugins to filter.
 * @returns {TPlugin[]} The list of plugins with duplicates removed.
 */
const filterUniquePlugins = (plugins) => {
  const seen = new Set();
  return plugins.filter((plugin) => {
    const duplicate = seen.has(plugin.pluginKey);
    seen.add(plugin.pluginKey);
    return !duplicate;
  });
};

/**
 * Determines if a plugin is authenticated by checking if all required authentication fields have non-empty values.
 * Supports alternate authentication fields, allowing validation against multiple possible environment variables.
 *
 * @param {TPlugin} plugin The plugin object containing the authentication configuration.
 * @returns {boolean} True if the plugin is authenticated for all required fields, false otherwise.
 */
const checkPluginAuth = (plugin) => {
  if (!plugin.authConfig || plugin.authConfig.length === 0) {
    return false;
  }

  return plugin.authConfig.every((authFieldObj) => {
    const authFieldOptions = authFieldObj.authField.split('||');
    let isFieldAuthenticated = false;

    for (const fieldOption of authFieldOptions) {
      const envValue = process.env[fieldOption];
      if (envValue && envValue.trim() !== '' && envValue !== AuthType.USER_PROVIDED) {
        isFieldAuthenticated = true;
        break;
      }
    }

    return isFieldAuthenticated;
  });
};

const getAvailablePluginsController = async (req, res) => {
  try {
    const cache = getLogStores(CacheKeys.CONFIG_STORE);
    const cachedPlugins = await cache.get(CacheKeys.PLUGINS);
    
    // Check if we have MCP configuration that needs to be loaded
    const customConfig = await getCustomConfig();
    const mcpConfig = customConfig?.mcpServers ?? req.app.locals?.mcpConfig;
    
    // If we have MCP config, always reload plugins to ensure MCPs are included
    if (mcpConfig && cachedPlugins) {
      console.log('🔍 [PluginController] MCP config detected, bypassing cache to reload plugins');
      const mcpPlugins = cachedPlugins.filter(p => p.pluginKey && p.pluginKey.includes(Constants.mcp_delimiter));
      console.log('🔍 [PluginController] Current cached MCP plugins:', mcpPlugins.length);
      
      // If no MCP plugins in cache, force reload
      if (mcpPlugins.length === 0) {
        console.log('🔍 [PluginController] No MCP plugins in cache, forcing reload');
      } else {
        console.log('🔍 [PluginController] MCP plugins found in cache, but reloading to ensure freshness');
      }
    } else if (cachedPlugins) {
      console.log('🔍 [PluginController] Returning cached plugins:', cachedPlugins.length);
      const mcpPlugins = cachedPlugins.filter(p => p.pluginKey && p.pluginKey.includes(Constants.mcp_delimiter));
      console.log('🔍 [PluginController] Cached MCP plugins:', mcpPlugins.length);
      res.status(200).json(cachedPlugins);
      return;
    }

    /** @type {{ filteredTools: string[], includedTools: string[] }} */
    const { filteredTools = [], includedTools = [] } = req.app.locals;
    let pluginManifest = availableTools;

    console.log('🔍 [PluginController] Starting with static tools:', pluginManifest.length);
    console.log('🔍 [PluginController] Static tool keys:', pluginManifest.map(p => p.pluginKey).slice(0, 5));

    // MCP config already loaded above, use it here
    console.log('🔍 [PluginController] MCP config found:', !!mcpConfig);
    if (mcpConfig) {
      console.log('🔍 [PluginController] MCP config keys:', Object.keys(mcpConfig));
    }
    
    if (mcpConfig != null) {
      const mcpManager = getMCPManager();
      const flowsCache = getLogStores(CacheKeys.FLOWS);
      const flowManager = flowsCache ? getFlowStateManager(flowsCache) : null;
      const serverToolsCallback = createServerToolsCallback();
      const getServerTools = createGetServerTools();
      
      console.log('🔍 [PluginController] Loading MCP tools from manager...');
      const mcpTools = await mcpManager.loadManifestTools({
        flowManager,
        serverToolsCallback,
        getServerTools,
      });
      
      console.log('🔍 [PluginController] MCP tools loaded:', mcpTools.length);
      console.log('🔍 [PluginController] MCP tool keys:', mcpTools.map(t => t.pluginKey));
      
      pluginManifest = [...mcpTools, ...pluginManifest];
      console.log('🔍 [PluginController] Combined manifest size:', pluginManifest.length);
    }

    console.log('🔍 [PluginController] Available tools from manifest:', pluginManifest.length);
    const mcpManifestTools = pluginManifest.filter(p => p.pluginKey && p.pluginKey.includes(Constants.mcp_delimiter));
    console.log('🔍 [PluginController] MCP tools in manifest:', mcpManifestTools.length);
    console.log('🔍 [PluginController] MCP tool keys found:', mcpManifestTools.map(p => p.pluginKey));

    const uniquePlugins = filterUniquePlugins(pluginManifest);
    console.log('🔍 [PluginController] After deduplication:', uniquePlugins.length);
    
    let authenticatedPlugins = [];
    for (const plugin of uniquePlugins) {
      authenticatedPlugins.push(
        checkPluginAuth(plugin) ? { ...plugin, authenticated: true } : plugin,
      );
    }

    let plugins = authenticatedPlugins;

    if (includedTools.length > 0) {
      plugins = plugins.filter((plugin) => includedTools.includes(plugin.pluginKey));
      console.log('🔍 [PluginController] After includedTools filter:', plugins.length);
    } else {
      plugins = plugins.filter((plugin) => !filteredTools.includes(plugin.pluginKey));
      console.log('🔍 [PluginController] After filteredTools filter:', plugins.length);
    }

    console.log('🔍 [PluginController] Final plugins count:', plugins.length);
    const mcpPlugins = plugins.filter(p => p.pluginKey && p.pluginKey.includes(Constants.mcp_delimiter));
    console.log('🔍 [PluginController] Final MCP plugins:', mcpPlugins.length);
    if (mcpPlugins.length > 0) {
      console.log('🔍 [PluginController] Final MCP plugin keys:', mcpPlugins.map(p => p.pluginKey));
    } else {
      console.log('🔍 [PluginController] ⚠️  No MCP plugins found in final result!');
      console.log('🔍 [PluginController] All plugin keys:', plugins.map(p => p.pluginKey));
    }

    await cache.set(CacheKeys.PLUGINS, plugins);
    res.status(200).json(plugins);
  } catch (error) {
    console.error('🔍 [PluginController] Error:', error);
    res.status(500).json({ message: error.message });
  }
};

function createServerToolsCallback() {
  /**
   * @param {string} serverName
   * @param {TPlugin[] | null} serverTools
   */
  return async function (serverName, serverTools) {
    try {
      const mcpToolsCache = getLogStores(CacheKeys.MCP_TOOLS);
      if (!serverName || !mcpToolsCache) {
        return;
      }
      await mcpToolsCache.set(serverName, serverTools);
      logger.debug(`MCP tools for ${serverName} added to cache.`);
    } catch (error) {
      logger.error('Error retrieving MCP tools from cache:', error);
    }
  };
}

function createGetServerTools() {
  /**
   * Retrieves cached server tools
   * @param {string} serverName
   * @returns {Promise<TPlugin[] | null>}
   */
  return async function (serverName) {
    try {
      const mcpToolsCache = getLogStores(CacheKeys.MCP_TOOLS);
      if (!mcpToolsCache) {
        return null;
      }
      return await mcpToolsCache.get(serverName);
    } catch (error) {
      logger.error('Error retrieving MCP tools from cache:', error);
      return null;
    }
  };
}

/**
 * Retrieves and returns a list of available tools, either from a cache or by reading a plugin manifest file.
 *
 * This function first attempts to retrieve the list of tools from a cache. If the tools are not found in the cache,
 * it reads a plugin manifest file, filters for unique plugins, and determines if each plugin is authenticated.
 * Only plugins that are marked as available in the application's local state are included in the final list.
 * The resulting list of tools is then cached and sent to the client.
 *
 * @param {object} req - The request object, containing information about the HTTP request.
 * @param {object} res - The response object, used to send back the desired HTTP response.
 * @returns {Promise<void>} A promise that resolves when the function has completed.
 */
const getAvailableTools = async (req, res) => {
  try {
    const cache = getLogStores(CacheKeys.CONFIG_STORE);
    const cachedTools = await cache.get(CacheKeys.TOOLS);
    if (cachedTools) {
      console.log('🔍 [getAvailableTools] Returning cached tools:', cachedTools.length);
      const mcpCachedTools = cachedTools.filter(p => p.pluginKey && p.pluginKey.includes(Constants.mcp_delimiter));
      console.log('🔍 [getAvailableTools] Cached MCP tools:', mcpCachedTools.length);
      res.status(200).json(cachedTools);
      return;
    }

    let pluginManifest = availableTools;
    console.log('🔍 [getAvailableTools] Starting with static tools:', pluginManifest.length);
    
    const customConfig = await getCustomConfig();
    const mcpConfig = customConfig?.mcpServers ?? req.app.locals?.mcpConfig;
    console.log('🔍 [getAvailableTools] MCP config found:', !!mcpConfig);
    if (mcpConfig) {
      console.log('🔍 [getAvailableTools] MCP config keys:', Object.keys(mcpConfig));
    }
    
    if (mcpConfig != null) {
      const mcpManager = getMCPManager();
      const flowsCache = getLogStores(CacheKeys.FLOWS);
      const flowManager = flowsCache ? getFlowStateManager(flowsCache) : null;
      const serverToolsCallback = createServerToolsCallback();
      const getServerTools = createGetServerTools();
      console.log('🔍 [getAvailableTools] Loading MCP tools...');
      const mcpTools = await mcpManager.loadManifestTools({
        flowManager,
        serverToolsCallback,
        getServerTools,
      });
      console.log('🔍 [getAvailableTools] MCP tools loaded:', mcpTools.length);
      if (mcpTools.length > 0) {
        console.log('🔍 [getAvailableTools] MCP tool keys:', mcpTools.map(t => t.pluginKey));
      }
      pluginManifest = [...mcpTools, ...pluginManifest];
      console.log('🔍 [getAvailableTools] Combined manifest size:', pluginManifest.length);
    } else {
      console.log('🔍 [getAvailableTools] No MCP config found');
    }

    /** @type {TPlugin[]} */
    const uniquePlugins = filterUniquePlugins(pluginManifest);

    const authenticatedPlugins = uniquePlugins.map((plugin) => {
      if (checkPluginAuth(plugin)) {
        return { ...plugin, authenticated: true };
      } else {
        return plugin;
      }
    });

    const toolDefinitions = await getCachedTools({ includeGlobal: true });

    const toolsOutput = [];
    for (const plugin of authenticatedPlugins) {
      const isToolDefined = toolDefinitions[plugin.pluginKey] !== undefined;
      const isToolkit =
        plugin.toolkit === true &&
        Object.keys(toolDefinitions).some((key) => getToolkitKey(key) === plugin.pluginKey);

      if (!isToolDefined && !isToolkit) {
        continue;
      }

      const toolToAdd = { ...plugin };

      if (!plugin.pluginKey.includes(Constants.mcp_delimiter)) {
        toolsOutput.push(toolToAdd);
        continue;
      }

      const parts = plugin.pluginKey.split(Constants.mcp_delimiter);
      const serverName = parts[parts.length - 1];
      const serverConfig = customConfig?.mcpServers?.[serverName];

      if (!serverConfig?.customUserVars) {
        toolsOutput.push(toolToAdd);
        continue;
      }

      const customVarKeys = Object.keys(serverConfig.customUserVars);

      if (customVarKeys.length === 0) {
        toolToAdd.authConfig = [];
        toolToAdd.authenticated = true;
      } else {
        toolToAdd.authConfig = Object.entries(serverConfig.customUserVars).map(([key, value]) => ({
          authField: key,
          label: value.title || key,
          description: value.description || '',
        }));
        toolToAdd.authenticated = false;
      }

      toolsOutput.push(toolToAdd);
    }

    const finalTools = filterUniquePlugins(toolsOutput);
    console.log('🔍 [getAvailableTools] Final tools count:', finalTools.length);
    const mcpFinalTools = finalTools.filter(p => p.pluginKey && p.pluginKey.includes(Constants.mcp_delimiter));
    console.log('🔍 [getAvailableTools] Final MCP tools:', mcpFinalTools.length);
    if (mcpFinalTools.length > 0) {
      console.log('🔍 [getAvailableTools] Final MCP tool keys:', mcpFinalTools.map(p => p.pluginKey));
    } else {
      console.log('🔍 [getAvailableTools] ⚠️  No MCP tools in final result!');
    }
    await cache.set(CacheKeys.TOOLS, finalTools);
    res.status(200).json(finalTools);
  } catch (error) {
    logger.error('[getAvailableTools]', error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getAvailableTools,
  getAvailablePluginsController,
};
