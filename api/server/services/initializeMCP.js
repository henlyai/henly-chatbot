const { logger } = require('@librechat/data-schemas');
const { CacheKeys } = require('librechat-data-provider');
const { findToken, updateToken, createToken, deleteTokens } = require('~/models');
const { getMCPManager, getFlowStateManager } = require('~/config');
const { getCachedTools, setCachedTools } = require('./Config');
const { getLogStores } = require('~/cache');

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
    delete app.locals.mcpConfig;
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
