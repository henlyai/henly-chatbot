const express = require('express');
const { requireJwtAuth, checkBan } = require('~/server/middleware');
const { logger } = require('@librechat/data-schemas');
const SuperAdminService = require('~/server/services/SuperAdminService');

const router = express.Router();
const superAdminService = new SuperAdminService();

// Middleware to check super admin role
const requireSuperAdmin = (req, res, next) => {
  const userRole = req.user?.role || req.user?.organization?.role;
  
  if (userRole !== 'super_admin') {
    return res.status(403).json({ 
      error: 'Super admin access required',
      required_role: 'super_admin',
      current_role: userRole 
    });
  }
  
  next();
};

// Apply common middleware
router.use(requireJwtAuth);
router.use(checkBan);
router.use(requireSuperAdmin);

/**
 * Get dashboard statistics
 * @route GET /super-admin/stats
 */
router.get('/stats', async (req, res) => {
  try {
    logger.info('[SuperAdminRoutes] Getting dashboard stats');
    
    const stats = await superAdminService.getDashboardStats();
    
    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    logger.error('[SuperAdminRoutes] Error getting stats:', error);
    res.status(500).json({ 
      error: 'Failed to get dashboard stats',
      details: error.message 
    });
  }
});

/**
 * Get all agents across all organizations
 * @route GET /super-admin/agents
 */
router.get('/agents', async (req, res) => {
  try {
    logger.info('[SuperAdminRoutes] Getting all agents');
    
    const agents = await superAdminService.getAllAgents();
    
    res.json({
      success: true,
      data: agents,
      count: agents.length
    });

  } catch (error) {
    logger.error('[SuperAdminRoutes] Error getting agents:', error);
    res.status(500).json({ 
      error: 'Failed to get agents',
      details: error.message 
    });
  }
});

/**
 * Get all prompts across all organizations
 * @route GET /super-admin/prompts
 */
router.get('/prompts', async (req, res) => {
  try {
    logger.info('[SuperAdminRoutes] Getting all prompts');
    
    const prompts = await superAdminService.getAllPrompts();
    
    res.json({
      success: true,
      data: prompts,
      count: prompts.length
    });

  } catch (error) {
    logger.error('[SuperAdminRoutes] Error getting prompts:', error);
    res.status(500).json({ 
      error: 'Failed to get prompts',
      details: error.message 
    });
  }
});

/**
 * Get all organizations with stats
 * @route GET /super-admin/organizations
 */
router.get('/organizations', async (req, res) => {
  try {
    logger.info('[SuperAdminRoutes] Getting all organizations');
    
    const organizations = await superAdminService.getAllOrganizations();
    
    res.json({
      success: true,
      data: organizations,
      count: organizations.length
    });

  } catch (error) {
    logger.error('[SuperAdminRoutes] Error getting organizations:', error);
    res.status(500).json({ 
      error: 'Failed to get organizations',
      details: error.message 
    });
  }
});

/**
 * Share an agent to another organization
 * @route POST /super-admin/agents/:agentId/share
 */
router.post('/agents/:agentId/share', async (req, res) => {
  try {
    const { agentId } = req.params;
    const { sourceOrgId, targetOrgId } = req.body;
    const adminUserId = req.user.id;

    if (!sourceOrgId || !targetOrgId) {
      return res.status(400).json({ 
        error: 'Source and target organization IDs are required' 
      });
    }

    logger.info(`[SuperAdminRoutes] Sharing agent ${agentId} from ${sourceOrgId} to ${targetOrgId}`);
    
    const sharedAgent = await superAdminService.shareAgentToOrganization(
      agentId, 
      sourceOrgId, 
      targetOrgId, 
      adminUserId
    );
    
    res.json({
      success: true,
      message: 'Agent shared successfully',
      data: sharedAgent
    });

  } catch (error) {
    logger.error('[SuperAdminRoutes] Error sharing agent:', error);
    res.status(500).json({ 
      error: 'Failed to share agent',
      details: error.message 
    });
  }
});

/**
 * Duplicate an agent to another organization
 * @route POST /super-admin/agents/:agentId/duplicate
 */
router.post('/agents/:agentId/duplicate', async (req, res) => {
  try {
    const { agentId } = req.params;
    const { sourceOrgId, targetOrgId } = req.body;
    const adminUserId = req.user.id;

    if (!sourceOrgId || !targetOrgId) {
      return res.status(400).json({ 
        error: 'Source and target organization IDs are required' 
      });
    }

    logger.info(`[SuperAdminRoutes] Duplicating agent ${agentId} from ${sourceOrgId} to ${targetOrgId}`);
    
    const duplicatedAgent = await superAdminService.duplicateAgentToOrganization(
      agentId, 
      sourceOrgId, 
      targetOrgId, 
      adminUserId
    );
    
    res.json({
      success: true,
      message: 'Agent duplicated successfully',
      data: duplicatedAgent
    });

  } catch (error) {
    logger.error('[SuperAdminRoutes] Error duplicating agent:', error);
    res.status(500).json({ 
      error: 'Failed to duplicate agent',
      details: error.message 
    });
  }
});

/**
 * Share a prompt to another organization
 * @route POST /super-admin/prompts/:promptId/share
 */
router.post('/prompts/:promptId/share', async (req, res) => {
  try {
    const { promptId } = req.params;
    const { sourceOrgId, targetOrgId } = req.body;
    const adminUserId = req.user.id;

    if (!sourceOrgId || !targetOrgId) {
      return res.status(400).json({ 
        error: 'Source and target organization IDs are required' 
      });
    }

    logger.info(`[SuperAdminRoutes] Sharing prompt ${promptId} from ${sourceOrgId} to ${targetOrgId}`);
    
    const sharedPrompt = await superAdminService.sharePromptToOrganization(
      promptId, 
      sourceOrgId, 
      targetOrgId, 
      adminUserId
    );
    
    res.json({
      success: true,
      message: 'Prompt shared successfully',
      data: sharedPrompt
    });

  } catch (error) {
    logger.error('[SuperAdminRoutes] Error sharing prompt:', error);
    res.status(500).json({ 
      error: 'Failed to share prompt',
      details: error.message 
    });
  }
});

/**
 * Revoke access to a resource from an organization
 * @route DELETE /super-admin/:resourceType/:resourceId/revoke
 */
router.delete('/:resourceType/:resourceId/revoke', async (req, res) => {
  try {
    const { resourceType, resourceId } = req.params;
    const { organizationId } = req.body;

    if (!['agents', 'prompts'].includes(resourceType)) {
      return res.status(400).json({ 
        error: 'Invalid resource type. Must be "agents" or "prompts"' 
      });
    }

    if (!organizationId) {
      return res.status(400).json({ 
        error: 'Organization ID is required' 
      });
    }

    const normalizedResourceType = resourceType === 'agents' ? 'agent' : 'prompt';

    logger.info(`[SuperAdminRoutes] Revoking ${normalizedResourceType} access: ${resourceId} from org ${organizationId}`);
    
    await superAdminService.revokeResourceAccess(
      normalizedResourceType, 
      resourceId, 
      organizationId
    );
    
    res.json({
      success: true,
      message: `${normalizedResourceType} access revoked successfully`
    });

  } catch (error) {
    logger.error('[SuperAdminRoutes] Error revoking access:', error);
    res.status(500).json({ 
      error: 'Failed to revoke access',
      details: error.message 
    });
  }
});

/**
 * Bulk share resources to multiple organizations
 * @route POST /super-admin/bulk-share
 */
router.post('/bulk-share', async (req, res) => {
  try {
    const { resourceType, resourceIds, sourceOrgId, targetOrgIds } = req.body;
    const adminUserId = req.user.id;

    if (!['agent', 'prompt'].includes(resourceType)) {
      return res.status(400).json({ 
        error: 'Invalid resource type. Must be "agent" or "prompt"' 
      });
    }

    if (!resourceIds || !Array.isArray(resourceIds) || resourceIds.length === 0) {
      return res.status(400).json({ 
        error: 'Resource IDs array is required' 
      });
    }

    if (!targetOrgIds || !Array.isArray(targetOrgIds) || targetOrgIds.length === 0) {
      return res.status(400).json({ 
        error: 'Target organization IDs array is required' 
      });
    }

    logger.info(`[SuperAdminRoutes] Bulk sharing ${resourceIds.length} ${resourceType}s to ${targetOrgIds.length} organizations`);
    
    const results = [];
    const errors = [];

    for (const resourceId of resourceIds) {
      for (const targetOrgId of targetOrgIds) {
        try {
          let result;
          if (resourceType === 'agent') {
            result = await superAdminService.shareAgentToOrganization(
              resourceId, 
              sourceOrgId, 
              targetOrgId, 
              adminUserId
            );
          } else {
            result = await superAdminService.sharePromptToOrganization(
              resourceId, 
              sourceOrgId, 
              targetOrgId, 
              adminUserId
            );
          }
          results.push(result);
        } catch (error) {
          errors.push({
            resourceId,
            targetOrgId,
            error: error.message
          });
        }
      }
    }
    
    res.json({
      success: true,
      message: `Bulk sharing completed`,
      data: {
        successful: results.length,
        failed: errors.length,
        results,
        errors
      }
    });

  } catch (error) {
    logger.error('[SuperAdminRoutes] Error in bulk sharing:', error);
    res.status(500).json({ 
      error: 'Failed to perform bulk sharing',
      details: error.message 
    });
  }
});

module.exports = router;
