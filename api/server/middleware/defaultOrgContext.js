/**
 * Middleware to provide default organization context for public routes
 * This allows the config route to load MCPs even when not authenticated
 */

const { logger } = require('@librechat/data-schemas');

/**
 * Middleware that provides default organization context for public routes
 * If user is not authenticated, uses DEFAULT_ORGANIZATION_ID from environment
 */
const provideDefaultOrgContext = (req, res, next) => {
  try {
    // If user is already authenticated, use their organization
    if (req.user && req.user.organization_id) {
      logger.info(`[DefaultOrgContext] User authenticated with organization: ${req.user.organization_id}`);
      return next();
    }
    
    // If no user or no organization, provide default organization context
    const defaultOrgId = process.env.DEFAULT_ORGANIZATION_ID;
    
    if (defaultOrgId) {
      // Create a minimal user object with default organization
      req.user = req.user || {};
      req.user.organization_id = defaultOrgId;
      req.user.id = req.user.id || 'anonymous';
      req.user.role = req.user.role || 'user';
      
      logger.info(`[DefaultOrgContext] Using default organization: ${defaultOrgId}`);
    } else {
      logger.warn('[DefaultOrgContext] No DEFAULT_ORGANIZATION_ID set, MCPs may not load');
    }
    
    next();
  } catch (error) {
    logger.error('[DefaultOrgContext] Error providing default organization context:', error);
    next(); // Continue anyway
  }
};

module.exports = {
  provideDefaultOrgContext
};
