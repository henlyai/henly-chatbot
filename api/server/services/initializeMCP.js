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
    const healthUrl = url.replace('/sse', '/health');
    const healthResponse = await fetch(healthUrl, { 
      method: 'GET',
      timeout: 5000 
    });
    
    if (!healthResponse.ok) {
      logger.error(`[MCP] Health check failed: ${healthResponse.status} ${healthResponse.statusText}`);
      return false;
    }
    
    logger.info(`[MCP] Health check passed: ${healthResponse.status}`);
    
    // Test SSE endpoint with a timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    try {
      const sseResponse = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache'
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!sseResponse.ok) {
        logger.error(`[MCP] SSE connection failed: ${sseResponse.status} ${sseResponse.statusText}`);
        return false;
      }
      
      logger.info(`[MCP] SSE connection successful: ${sseResponse.status}`);
      return true;
      
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        logger.error(`[MCP] SSE connection timeout after 10 seconds`);
      } else {
        logger.error(`[MCP] SSE connection error: ${error.message}`);
      }
      return false;
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
  for (const [serverName, config] of Object.entries(mcpServers)) {
    const isReachable = await testMCPConnection(config.url);
    if (!isReachable) {
      logger.error(`[MCP] Cannot reach ${serverName} at ${config.url} - skipping initialization`);
      return;
    }
  }
  
  const mcpManager = getMCPManager();
  const flowsCache = getLogStores(CacheKeys.FLOWS);
  const flowManager = flowsCache ? getFlowStateManager(flowsCache) : null;

  try {
    logger.info('[MCP] Starting MCP manager initialization...');
    await mcpManager.initializeMCP({
      mcpServers,
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

