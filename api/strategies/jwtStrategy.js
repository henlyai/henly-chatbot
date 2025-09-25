const { logger } = require('@librechat/data-schemas');
const { SystemRoles } = require('librechat-data-provider');
const { Strategy: JwtStrategy, ExtractJwt } = require('passport-jwt');
const { getUserById, updateUser } = require('~/models');

// JWT strategy
const jwtLogin = () =>
  new JwtStrategy(
    {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET,
    },
    async (payload, done) => {
      try {
        // DEBUG: Log the entire JWT payload to see what we're getting
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
          
          done(null, user);
        } else {
          logger.warn('[jwtLogin] JwtStrategy => no user found: ' + payload?.id);
          done(null, false);
        }
      } catch (err) {
        done(err, false);
      }
    },
  );

module.exports = jwtLogin;
