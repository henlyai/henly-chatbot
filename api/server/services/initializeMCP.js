const { logger } = require('@librechat/data-schemas');
const { CacheKeys } = require('librechat-data-provider');
const { findToken, updateToken, createToken, deleteTokens } = require('~/models');
const { getMCPManager, getFlowStateManager } = require('~/config');
const { getCachedTools, setCachedTools } = require('./Config');
const { getLogStores } = require('~/cache');

/**
 * Test connection to MCP server
 * @param {string} url - MCP server URL
 * @returns {Promise<boolean>} - Whether connection is successful
 */
async function testMCPConnection(url) {
  try {
    logger.info(`[MCP] Testing connection to: ${url}`);
    
    // Test health endpoint first  
    const healthUrl = url.endsWith('/mcp') ? url.slice(0, -4) + '/health' : url.replace(/\/mcp$/, '/health');
    logger.info(`[MCP] Health check URL: ${healthUrl}`);
    
    try {
      const healthResponse = await fetch(healthUrl, { 
        method: 'GET',
        timeout: 5000 
      });
      
      logger.info(`[MCP] Health response status: ${healthResponse.status}`);
      logger.info(`[MCP] Health response headers: ${JSON.stringify(Object.fromEntries(healthResponse.headers.entries()))}`);
      
      if (!healthResponse.ok) {
        const responseText = await healthResponse.text();
        logger.error(`[MCP] Health check failed: ${healthResponse.status} ${healthResponse.statusText}`);
        logger.error(`[MCP] Health response body: ${responseText}`);
        return false;
      }
      
      logger.info(`[MCP] Health check passed: ${healthResponse.status}`);
    } catch (healthError) {
      logger.error(`[MCP] Health check error: ${healthError.message}`);
      logger.error(`[MCP] Health check stack: ${healthError.stack}`);
      return false;
    }
    
    // Test MCP endpoint with a shorter timeout for SSE connections
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout for SSE handshake
    
    try {
      const mcpResponse = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache'
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!mcpResponse.ok) {
        logger.error(`[MCP] MCP connection failed: ${mcpResponse.status} ${mcpResponse.statusText}`);
        return false;
      }
      
      // For SSE connections, getting a 200 response with the right headers is success
      const contentType = mcpResponse.headers.get('content-type');
      if (contentType && contentType.includes('text/event-stream')) {
        logger.info(`[MCP] MCP connection successful: ${mcpResponse.status} (SSE stream established)`);
        // Close the stream immediately since we just wanted to test the connection
        mcpResponse.body?.cancel();
        return true;
      } else {
        logger.error(`[MCP] MCP connection failed: Invalid content-type '${contentType}', expected 'text/event-stream'`);
        return false;
      }
      
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        logger.warn(`[MCP] MCP connection test completed (SSE timeout is normal behavior)`);
        // For SSE connections, timeout after getting the stream is actually success
        return true;
      } else {
        logger.error(`[MCP] MCP connection error: ${error.message}`);
        return false;
      }
    }
    
  } catch (error) {
    logger.error(`[MCP] Connection test failed: ${error.message}`);
    return false;
  }
}

/**
 * Initialize MCP servers
 * @param {import('express').Application} app - Express app instance
 */
async function initializeMCP(app) {
  const mcpServers = app.locals.mcpConfig;
  if (!mcpServers) {
    logger.info('[MCP] No MCP configuration found in app.locals.mcpConfig');
    return;
  }

  logger.info(`[MCP] Initializing MCP servers... Found ${Object.keys(mcpServers).length} server(s)`);
  logger.info(`[MCP] Server names: ${Object.keys(mcpServers).join(', ')}`);
  
  // Test connections before initialization
  const reachableServers = {};
  for (const [serverName, config] of Object.entries(mcpServers)) {
    const isReachable = await testMCPConnection(config.url);
    if (!isReachable) {
      logger.error(`[MCP] Cannot reach ${serverName} at ${config.url} - skipping this server`);
      continue;
    }
    reachableServers[serverName] = config;
    logger.info(`[MCP] ${serverName} connection test passed`);
  }
  
  if (Object.keys(reachableServers).length === 0) {
    logger.error('[MCP] No MCP servers are reachable - skipping initialization');
    return;
  }
  
  logger.info(`[MCP] Proceeding with ${Object.keys(reachableServers).length} reachable MCP servers`);
  
  const mcpManager = getMCPManager();
  const flowsCache = getLogStores(CacheKeys.FLOWS);
  const flowManager = flowsCache ? getFlowStateManager(flowsCache) : null;

  try {
    logger.info('[MCP] Starting MCP manager initialization...');
    await mcpManager.initializeMCP({
      mcpServers: reachableServers,
      flowManager,
      tokenMethods: {
        findToken,
        updateToken,
        createToken,
        deleteTokens,
      },
    });

    logger.info('[MCP] MCP manager initialization completed');
    // Don't delete app.locals.mcpConfig - PluginController needs it to load MCP tools
    const availableTools = await getCachedTools();

    if (!availableTools) {
      logger.warn('[MCP] No available tools found in cache during MCP initialization');
      return;
    }

    logger.info(`[MCP] Found ${Object.keys(availableTools).length} available tools in cache`);
    const toolsCopy = { ...availableTools };
    await mcpManager.mapAvailableTools(toolsCopy, flowManager);
    await setCachedTools(toolsCopy, { isGlobal: true });

    logger.info('[MCP] MCP servers initialized successfully');
  } catch (error) {
    logger.error('[MCP] Failed to initialize MCP servers:', error);
    logger.error('[MCP] Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
  }
}

module.exports = initializeMCP;

