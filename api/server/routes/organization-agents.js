const express = require('express');
const { requireJwtAuth, checkBan } = require('~/server/middleware');
const { logger } = require('@librechat/data-schemas');
const OrganizationAgentsService = require('~/server/services/OrganizationAgents');

const router = express.Router();
const agentsService = new OrganizationAgentsService();

// Apply common middleware
router.use(requireJwtAuth);
router.use(checkBan);

/**
 * Get agents available to the user's organization
 * @route GET /organization-agents
 */
router.get('/', async (req, res) => {
  try {
    const { organization_id } = req.user;

    if (!organization_id) {
      logger.warn('[OrganizationAgents] User has no organization_id, returning empty agents list');
      return res.json([]);
    }

    const agents = await agentsService.getOrganizationAgents(organization_id);
    
    res.json({
      success: true,
      data: agents,
      count: agents.length
    });

  } catch (error) {
    logger.error('[OrganizationAgents] Error getting organization agents:', error);
    res.status(500).json({ 
      error: 'Failed to get organization agents',
      details: error.message 
    });
  }
});

/**
 * Get accessible agent IDs for filtering LibreChat agents
 * @route GET /organization-agents/accessible-ids
 */
router.get('/accessible-ids', async (req, res) => {
  try {
    const { organization_id } = req.user;

    if (!organization_id) {
      return res.json([]);
    }

    const agentIds = await agentsService.getAccessibleAgentIds(organization_id);
    
    res.json({
      success: true,
      agent_ids: agentIds
    });

  } catch (error) {
    logger.error('[OrganizationAgents] Error getting accessible agent IDs:', error);
    res.status(500).json({ 
      error: 'Failed to get accessible agent IDs',
      details: error.message 
    });
  }
});

/**
 * Check if user has access to specific agent
 * @route GET /organization-agents/:agentId/access
 */
router.get('/:agentId/access', async (req, res) => {
  try {
    const { organization_id } = req.user;
    const { agentId } = req.params;

    if (!organization_id) {
      return res.json({ hasAccess: false });
    }

    const hasAccess = await agentsService.hasAgentAccess(organization_id, agentId);
    
    res.json({
      success: true,
      hasAccess
    });

  } catch (error) {
    logger.error('[OrganizationAgents] Error checking agent access:', error);
    res.status(500).json({ 
      error: 'Failed to check agent access',
      details: error.message 
    });
  }
});

/**
 * Setup default agents for organization (typically called during onboarding)
 * @route POST /organization-agents/setup-defaults
 */
router.post('/setup-defaults', async (req, res) => {
  try {
    const { organization_id } = req.user;
    const userId = req.user.id;

    if (!organization_id) {
      return res.status(400).json({ error: 'Organization not found' });
    }

    const defaultAgents = await agentsService.setupDefaultAgents(organization_id, userId);
    
    res.json({
      success: true,
      message: 'Default agents created successfully',
      data: defaultAgents,
      count: defaultAgents.length
    });

  } catch (error) {
    logger.error('[OrganizationAgents] Error setting up default agents:', error);
    res.status(500).json({ 
      error: 'Failed to setup default agents',
      details: error.message 
    });
  }
});

module.exports = router;
