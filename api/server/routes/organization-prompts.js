const express = require('express');
const { requireJwtAuth, checkBan } = require('~/server/middleware');
const { logger } = require('@librechat/data-schemas');
const OrganizationPromptsService = require('~/server/services/OrganizationPrompts');

const router = express.Router();
const promptsService = new OrganizationPromptsService();

// Apply common middleware
router.use(requireJwtAuth);
router.use(checkBan);

/**
 * Get prompts available to the user's organization
 * @route GET /organization-prompts
 */
router.get('/', async (req, res) => {
  try {
    const { organization_id } = req.user;

    if (!organization_id) {
      logger.warn('[OrganizationPrompts] User has no organization_id, returning empty prompts list');
      return res.json([]);
    }

    const prompts = await promptsService.getOrganizationPrompts(organization_id);
    
    res.json({
      success: true,
      data: prompts,
      count: prompts.length
    });

  } catch (error) {
    logger.error('[OrganizationPrompts] Error getting organization prompts:', error);
    res.status(500).json({ 
      error: 'Failed to get organization prompts',
      details: error.message 
    });
  }
});

/**
 * Get accessible prompt IDs for filtering LibreChat prompts
 * @route GET /organization-prompts/accessible-ids
 */
router.get('/accessible-ids', async (req, res) => {
  try {
    const { organization_id } = req.user;

    if (!organization_id) {
      return res.json([]);
    }

    const promptIds = await promptsService.getAccessiblePromptIds(organization_id);
    
    res.json({
      success: true,
      prompt_ids: promptIds
    });

  } catch (error) {
    logger.error('[OrganizationPrompts] Error getting accessible prompt IDs:', error);
    res.status(500).json({ 
      error: 'Failed to get accessible prompt IDs',
      details: error.message 
    });
  }
});

/**
 * Check if user has access to specific prompt
 * @route GET /organization-prompts/:promptId/access
 */
router.get('/:promptId/access', async (req, res) => {
  try {
    const { organization_id } = req.user;
    const { promptId } = req.params;

    if (!organization_id) {
      return res.json({ hasAccess: false });
    }

    const hasAccess = await promptsService.hasPromptAccess(organization_id, promptId);
    
    res.json({
      success: true,
      hasAccess
    });

  } catch (error) {
    logger.error('[OrganizationPrompts] Error checking prompt access:', error);
    res.status(500).json({ 
      error: 'Failed to check prompt access',
      details: error.message 
    });
  }
});

/**
 * Setup default prompts for organization (typically called during onboarding)
 * @route POST /organization-prompts/setup-defaults
 */
router.post('/setup-defaults', async (req, res) => {
  try {
    const { organization_id } = req.user;
    const userId = req.user.id;

    if (!organization_id) {
      return res.status(400).json({ error: 'Organization not found' });
    }

    const defaultPrompts = await promptsService.setupDefaultPrompts(organization_id, userId);
    
    res.json({
      success: true,
      message: 'Default prompts created successfully',
      data: defaultPrompts,
      count: defaultPrompts.length
    });

  } catch (error) {
    logger.error('[OrganizationPrompts] Error setting up default prompts:', error);
    res.status(500).json({ 
      error: 'Failed to setup default prompts',
      details: error.message 
    });
  }
});

/**
 * Get prompts formatted for LibreChat
 * @route GET /organization-prompts/librechat-format
 */
router.get('/librechat-format', async (req, res) => {
  try {
    const { organization_id } = req.user;

    if (!organization_id) {
      return res.json([]);
    }

    const prompts = await promptsService.getOrganizationPrompts(organization_id);
    const formattedPrompts = prompts.map(prompt => promptsService.formatForLibreChat(prompt));
    
    res.json({
      success: true,
      data: formattedPrompts
    });

  } catch (error) {
    logger.error('[OrganizationPrompts] Error getting formatted prompts:', error);
    res.status(500).json({ 
      error: 'Failed to get formatted prompts',
      details: error.message 
    });
  }
});

module.exports = router;
