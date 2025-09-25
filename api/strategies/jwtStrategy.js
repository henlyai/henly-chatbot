const { logger } = require('@librechat/data-schemas');
const { SystemRoles } = require('librechat-data-provider');
const { Strategy: JwtStrategy, ExtractJwt } = require('passport-jwt');
const { getUserById, updateUser } = require('~/models');

// Custom JWT extraction function that checks both cookies and headers
const extractJwtFromRequest = (req) => {
  // DEBUG: Log all cookies and headers for debugging
  logger.warn(`[JWT Strategy] DEBUG - All cookies:`, req.cookies);
  logger.warn(`[JWT Strategy] DEBUG - Authorization header:`, req.headers.authorization);
  logger.warn(`[JWT Strategy] DEBUG - All headers:`, Object.keys(req.headers));
  
  // First try to get from LibreChat accessToken cookie (set by SSO controller)
  if (req.cookies && req.cookies.accessToken) {
    logger.warn(`[JWT Strategy] Found JWT in accessToken cookie: ${req.cookies.accessToken.slice(0, 20)}...`);
    return req.cookies.accessToken;
  }
  
  // Check for Supabase cookie that might be passed from iframe
  const supabaseCookieName = 'sb-mtybaactacapokejmtxy-auth-token';
  if (req.cookies && req.cookies[supabaseCookieName]) {
    logger.warn(`[JWT Strategy] Found Supabase cookie: ${supabaseCookieName}`);
    // This is a Supabase session cookie, not a LibreChat JWT, so we can't use it directly
    // The iframe should call the SSO endpoint first to convert this to a LibreChat session
    logger.warn(`[JWT Strategy] Supabase cookie found but cannot be used directly - iframe should call SSO endpoint first`);
  }
  
  // Fallback to Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    logger.warn(`[JWT Strategy] Found JWT in Authorization header: ${token.slice(0, 20)}...`);
    return token;
  }
  
  logger.warn(`[JWT Strategy] No JWT found in cookies or headers`);
  return null;
};

// JWT strategy
const jwtLogin = () =>
  new JwtStrategy(
    {
      jwtFromRequest: extractJwtFromRequest,
      secretOrKey: process.env.JWT_SECRET,
    },
    async (payload, done) => {
      try {
        // DEBUG: Log the entire JWT payload to see what we're getting
        logger.warn(`[jwtLogin] JWT strategy callback called!`);
        logger.warn(`[jwtLogin] JWT payload received: ${JSON.stringify(payload, null, 2)}`);
        
        const user = await getUserById(payload?.id, '-password -__v -totpSecret');
        if (user) {
          user.id = user._id.toString();
          if (!user.role) {
            user.role = SystemRoles.USER;
            await updateUser(user.id, { role: user.role });
          }
          
          // Extract organization_id from JWT payload if available
          if (payload?.organization?.id) {
            user.organization_id = payload.organization.id;
            logger.info(`[jwtLogin] Added organization_id to user: ${user.organization_id}`);
          } else {
            logger.warn(`[jwtLogin] No organization_id found in JWT payload. Available keys: ${Object.keys(payload || {}).join(', ')}`);
          }
          
          logger.warn(`[jwtLogin] Successfully authenticated user: ${user.id}, role: ${user.role}, organization_id: ${user.organization_id}`);
          done(null, user);
        } else {
          logger.warn('[jwtLogin] JwtStrategy => no user found: ' + payload?.id);
          done(null, false);
        }
      } catch (err) {
        logger.error(`[jwtLogin] JWT strategy error:`, err);
        done(err, false);
      }
    },
  );

module.exports = jwtLogin;
