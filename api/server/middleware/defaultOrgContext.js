/**
 * SECURITY FIX: This middleware has been DISABLED due to critical security vulnerabilities
 * It allowed unauthenticated access to organization data using DEFAULT_ORGANIZATION_ID
 * 
 * REMOVED: Default organization context middleware
 * REASON: Major security risk - allows cross-organization data access
 * 
 * All routes must now require proper authentication and organization context
 */

const { logger } = require('@librechat/data-schemas');

/**
 * SECURITY FIX: Disabled default organization context
 * This middleware was a critical security vulnerability
 */
const provideDefaultOrgContext = (req, res, next) => {
  logger.error('[SECURITY] DefaultOrgContext middleware is DISABLED - this was a security vulnerability');
  logger.error('[SECURITY] All routes must require proper authentication');
  
  // Return 401 for any attempt to use this middleware
  return res.status(401).json({ 
    error: 'Authentication required',
    message: 'This endpoint requires proper authentication and organization context'
  });
};

module.exports = {
  provideDefaultOrgContext
};
