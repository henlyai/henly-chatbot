const express = require('express');
const router = express.Router();
const OrganizationMCPService = require('../services/OrganizationMCP');

// Debug endpoint to test MCP loading
router.get('/test', async (req, res) => {
  try {
    console.log('🔍 [DEBUG MCP] Test endpoint called');
    
    const organizationId = process.env.DEFAULT_ORGANIZATION_ID || 'ad82fce8-ba9a-438f-9fe2-956a86f479a5';
    console.log('🔍 [DEBUG MCP] Using organization ID:', organizationId);
    
    const mcpService = new OrganizationMCPService();
    const mcpConfig = await mcpService.getOrganizationMCPServers(organizationId);
    
    console.log('🔍 [DEBUG MCP] MCP config result:', mcpConfig);
    console.log('�� [DEBUG MCP] MCP config keys:', mcpConfig ? Object.keys(mcpConfig) : 'null');
    
    res.json({
      success: true,
      organizationId,
      mcpConfig,
      mcpCount: mcpConfig ? Object.keys(mcpConfig).length : 0,
      mcpNames: mcpConfig ? Object.keys(mcpConfig) : []
    });
  } catch (error) {
    console.error('❌ [DEBUG MCP] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

module.exports = router;
