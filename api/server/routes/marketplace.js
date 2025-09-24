const express = require('express');
const { requireJwtAuth, checkBan } = require('~/server/middleware');
const { logger } = require('@librechat/data-schemas');
const MarketplaceService = require('~/server/services/MarketplaceService');
const DefaultContentService = require('~/server/services/DefaultContentService');

const router = express.Router();
const marketplaceService = new MarketplaceService();
const defaultContentService = new DefaultContentService();

// Apply common middleware
router.use(requireJwtAuth);
router.use(checkBan);

/**
 * Get marketplace agents available to user's organization
 * @route GET /marketplace/agents
 * @param {Object} req.query - Optional filters (category, search)
 */
router.get('/agents', async (req, res) => {
  try {
    const { organization_id } = req.user;
    if (!organization_id) {
      return res.status(400).json({ error: 'Organization not found' });
    }

    const filters = {
      category: req.query.category,
      search: req.query.search
    };

    const agents = await marketplaceService.getMarketplaceAgents(organization_id, filters);
    res.json({ agents });

  } catch (error) {
    logger.error('[MarketplaceRoute] Error getting marketplace agents:', error);
    res.status(500).json({ error: 'Failed to fetch marketplace agents' });
  }
});

/**
 * Get marketplace prompts available to user's organization
 * @route GET /marketplace/prompts
 * @param {Object} req.query - Optional filters (category, search)
 */
router.get('/prompts', async (req, res) => {
  try {
    const { organization_id } = req.user;
    if (!organization_id) {
      return res.status(400).json({ error: 'Organization not found' });
    }

    const filters = {
      category: req.query.category,
      search: req.query.search
    };

    const prompts = await marketplaceService.getMarketplacePrompts(organization_id, filters);
    res.json({ prompts });

  } catch (error) {
    logger.error('[MarketplaceRoute] Error getting marketplace prompts:', error);
    res.status(500).json({ error: 'Failed to fetch marketplace prompts' });
  }
});

/**
 * Publish an agent to the marketplace
 * @route POST /marketplace/agents/:id/publish
 * @param {string} req.params.id - LibreChat agent ID
 * @param {Object} req.body - Publishing options (category, isPublic)
 */
router.post('/agents/:id/publish', async (req, res) => {
  try {
    const { id: agentId } = req.params;
    const { category, isPublic } = req.body;
    const { organization_id, id: userId } = req.user;

    if (!organization_id) {
      return res.status(400).json({ error: 'Organization not found' });
    }

    // Check marketplace settings
    const settings = await marketplaceService.getMarketplaceSettings(organization_id);
    if (!settings.enabled) {
      return res.status(403).json({ error: 'Marketplace not enabled for this organization' });
    }

    if (isPublic && !settings.allow_public_sharing) {
      return res.status(403).json({ error: 'Public sharing not allowed for this organization' });
    }

    const result = await marketplaceService.publishAgent(
      agentId, 
      organization_id, 
      userId,
      { category, isPublic }
    );

    res.json({ 
      success: true, 
      message: 'Agent published successfully',
      data: result 
    });

  } catch (error) {
    logger.error('[MarketplaceRoute] Error publishing agent:', error);
    res.status(500).json({ error: error.message || 'Failed to publish agent' });
  }
});

/**
 * Publish a prompt to the marketplace
 * @route POST /marketplace/prompts/:id/publish
 * @param {string} req.params.id - LibreChat prompt group ID
 * @param {Object} req.body - Publishing options (category, isPublic)
 */
router.post('/prompts/:id/publish', async (req, res) => {
  try {
    const { id: promptId } = req.params;
    const { category, isPublic } = req.body;
    const { organization_id, id: userId } = req.user;

    if (!organization_id) {
      return res.status(400).json({ error: 'Organization not found' });
    }

    const settings = await marketplaceService.getMarketplaceSettings(organization_id);
    if (!settings.enabled) {
      return res.status(403).json({ error: 'Marketplace not enabled for this organization' });
    }

    if (isPublic && !settings.allow_public_sharing) {
      return res.status(403).json({ error: 'Public sharing not allowed for this organization' });
    }

    const result = await marketplaceService.publishPrompt(
      promptId, 
      organization_id, 
      userId,
      { category, isPublic }
    );

    res.json({ 
      success: true, 
      message: 'Prompt published successfully',
      data: result 
    });

  } catch (error) {
    logger.error('[MarketplaceRoute] Error publishing prompt:', error);
    res.status(500).json({ error: error.message || 'Failed to publish prompt' });
  }
});

/**
 * Install an agent from marketplace
 * @route POST /marketplace/agents/:id/install
 * @param {string} req.params.id - Marketplace agent library ID
 */
router.post('/agents/:id/install', async (req, res) => {
  try {
    const { id: agentLibraryId } = req.params;
    const { organization_id, id: userId } = req.user;

    if (!organization_id) {
      return res.status(400).json({ error: 'Organization not found' });
    }

    const result = await marketplaceService.installAgent(
      agentLibraryId, 
      organization_id, 
      userId
    );

    res.json(result);

  } catch (error) {
    logger.error('[MarketplaceRoute] Error installing agent:', error);
    res.status(500).json({ error: error.message || 'Failed to install agent' });
  }
});

/**
 * Install a prompt from marketplace
 * @route POST /marketplace/prompts/:id/install
 * @param {string} req.params.id - Marketplace prompt library ID
 */
router.post('/prompts/:id/install', async (req, res) => {
  try {
    const { id: promptLibraryId } = req.params;
    const { organization_id, id: userId } = req.user;

    if (!organization_id) {
      return res.status(400).json({ error: 'Organization not found' });
    }

    const result = await marketplaceService.installPrompt(
      promptLibraryId, 
      organization_id, 
      userId
    );

    res.json(result);

  } catch (error) {
    logger.error('[MarketplaceRoute] Error installing prompt:', error);
    res.status(500).json({ error: error.message || 'Failed to install prompt' });
  }
});

/**
 * Get marketplace settings for organization
 * @route GET /marketplace/settings
 */
router.get('/settings', async (req, res) => {
  try {
    const { organization_id } = req.user;
    if (!organization_id) {
      return res.status(400).json({ error: 'Organization not found' });
    }

    const settings = await marketplaceService.getMarketplaceSettings(organization_id);
    res.json({ settings });

  } catch (error) {
    logger.error('[MarketplaceRoute] Error getting marketplace settings:', error);
    res.status(500).json({ error: 'Failed to fetch marketplace settings' });
  }
});

/**
 * Setup default content for an organization
 * @route POST /marketplace/setup
 */
router.post('/setup', async (req, res) => {
  try {
    const { organization_id } = req.user;
    const userId = req.user.id;

    if (!organization_id) {
      return res.status(400).json({ error: 'Organization not found' });
    }

    logger.info(`[MarketplaceRoutes] Setting up default content for organization: ${organization_id}`);
    
    const result = await defaultContentService.setupDefaultContent(organization_id, userId);
    
    res.json({
      success: true,
      message: 'Default content setup completed',
      data: result
    });

  } catch (error) {
    logger.error('[MarketplaceRoutes] Error in setup:', error);
    res.status(500).json({ 
      error: 'Failed to setup default content',
      details: error.message 
    });
  }
});

/**
 * Get organization's accessible agent IDs
 * @route GET /marketplace/organization-agents
 */
router.get('/organization-agents', async (req, res) => {
  try {
    const { organization_id } = req.user;

    if (!organization_id) {
      return res.status(400).json({ error: 'Organization not found' });
    }

    const agentIds = await marketplaceService.getOrganizationAgentIds(organization_id);
    
    res.json({
      success: true,
      agent_ids: agentIds
    });

  } catch (error) {
    logger.error('[MarketplaceRoutes] Error getting organization agents:', error);
    res.status(500).json({ 
      error: 'Failed to get organization agents',
      details: error.message 
    });
  }
});

/**
 * Get marketplace categories
 * @route GET /marketplace/categories
 */
router.get('/categories', async (req, res) => {
  try {
    const categories = [
      { label: 'All Categories', value: 'all' },
      { label: 'General', value: 'general' },
      { label: 'Sales & Marketing', value: 'sales_marketing' },
      { label: 'Customer Support', value: 'customer_support' },
      { label: 'Finance & Accounting', value: 'finance_accounting' },
      { label: 'HR & Recruiting', value: 'hr_recruiting' },
      { label: 'Operations', value: 'operations' },
      { label: 'Analytics & Reporting', value: 'analytics_reporting' },
      { label: 'Content Creation', value: 'content_creation' },
      { label: 'Project Management', value: 'project_management' },
      { label: 'Other', value: 'other' }
    ];

    res.json({ categories });

  } catch (error) {
    logger.error('[MarketplaceRoute] Error getting categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

/**
 * Track marketplace usage (for analytics)
 * @route POST /marketplace/track-usage
 * @param {Object} req.body - Usage tracking data
 */
router.post('/track-usage', async (req, res) => {
  try {
    const { resourceType, resourceId, actionType, sessionId } = req.body;
    const { organization_id, id: userId } = req.user;

    if (!organization_id) {
      return res.status(400).json({ error: 'Organization not found' });
    }

    await marketplaceService.trackUsage(
      resourceType, 
      resourceId, 
      organization_id, 
      userId, 
      actionType, 
      sessionId
    );

    res.json({ success: true });

  } catch (error) {
    logger.error('[MarketplaceRoute] Error tracking usage:', error);
    // Don't fail the request for tracking errors
    res.json({ success: false, error: 'Tracking failed but action completed' });
  }
});

module.exports = router;
