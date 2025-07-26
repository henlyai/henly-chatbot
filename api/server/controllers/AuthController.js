const cookies = require('cookie');
const jwt = require('jsonwebtoken');
// const openIdClient = require('openid-client');
const { isEnabled } = require('@librechat/api');
const { logger } = require('@librechat/data-schemas');
const {
  requestPasswordReset,
  setOpenIDAuthTokens,
  resetPassword,
  setAuthTokens,
  registerUser,
} = require('~/server/services/AuthService');
const AuthService = require('../../server/services/AuthService');
const { findUser, createUser, getUserById, deleteAllUserSessions, findSession } = require('~/models');
const { getOpenIdConfig } = require('~/strategies');

const registrationController = async (req, res) => {
  try {
    const response = await registerUser(req.body);
    const { status, message } = response;
    res.status(status).send({ message });
  } catch (err) {
    logger.error('[registrationController]', err);
    return res.status(500).json({ message: err.message });
  }
};

const resetPasswordRequestController = async (req, res) => {
  try {
    const resetService = await requestPasswordReset(req);
    if (resetService instanceof Error) {
      return res.status(400).json(resetService);
    } else {
      return res.status(200).json(resetService);
    }
  } catch (e) {
    logger.error('[resetPasswordRequestController]', e);
    return res.status(400).json({ message: e.message });
  }
};

const resetPasswordController = async (req, res) => {
  try {
    const resetPasswordService = await resetPassword(
      req.body.userId,
      req.body.token,
      req.body.password,
    );
    if (resetPasswordService instanceof Error) {
      return res.status(400).json(resetPasswordService);
    } else {
      await deleteAllUserSessions({ userId: req.body.userId });
      return res.status(200).json(resetPasswordService);
    }
  } catch (e) {
    logger.error('[resetPasswordController]', e);
    return res.status(400).json({ message: e.message });
  }
};

const refreshController = async (req, res) => {
  // Debug: log all cookies
  console.log('[DEBUG] refreshController cookies:', req.cookies);
  let refreshToken = null;
  // Try to get refreshToken from req.cookies first
  if (req.cookies && req.cookies.refreshToken) {
    refreshToken = req.cookies.refreshToken;
  } else if (req.headers.cookie) {
    // Fallback: parse from raw header (legacy)
    const cookies = require('cookie').parse(req.headers.cookie);
    refreshToken = cookies.refreshToken;
  }
  const token_provider = req.cookies?.token_provider || (req.headers.cookie ? require('cookie').parse(req.headers.cookie).token_provider : null);
  if (!refreshToken) {
    return res.status(200).send('Refresh token not provided');
  }
  if (token_provider === 'openid' && isEnabled(process.env.OPENID_REUSE_TOKENS) === true) {
    try {
      const openIdConfig = getOpenIdConfig();
      const tokenset = await openIdClient.refreshTokenGrant(openIdConfig, refreshToken);
      const claims = tokenset.claims();
      const user = await findUser({ email: claims.email });
      if (!user) {
        return res.status(401).redirect('/login');
      }
      const token = setOpenIDAuthTokens(tokenset, res);
      return res.status(200).send({ token, user });
    } catch (error) {
      logger.error('[refreshController] OpenID token refresh error', error);
      return res.status(403).send('Invalid OpenID refresh token');
    }
  }
  try {
    const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await getUserById(payload.id, '-password -__v -totpSecret');
    if (!user) {
      return res.status(401).redirect('/login');
    }

    const userId = payload.id;

    if (process.env.NODE_ENV === 'CI') {
      const token = await setAuthTokens(userId, res);
      return res.status(200).send({ token, user });
    }

    // Find the session with the hashed refresh token
    const session = await findSession({
      userId: userId,
      refreshToken: refreshToken,
    });

    if (session && session.expiration > new Date()) {
      const token = await setAuthTokens(userId, res, session._id);
      res.status(200).send({ token, user });
    } else if (req?.query?.retry) {
      // Retrying from a refresh token request that failed (401)
      res.status(403).send('No session found');
    } else if (payload.exp < Date.now() / 1000) {
      res.status(403).redirect('/login');
    } else {
      res.status(401).send('Refresh token expired or not found for this user');
    }
  } catch (err) {
    logger.error(`[refreshController] Refresh token: ${refreshToken}`, err);
    res.status(403).send('Invalid refresh token');
  }
};

// SSO Proxy Endpoint for LibreChat
const ssoLibreChatController = async (req, res) => {
  try {
    let supabaseToken = null;
    const cookieValue = req.cookies['sb-mtybaactacapokejmtxy-auth-token'];
    console.log('[SSO DEBUG] Cookie value:', cookieValue ? cookieValue.slice(0, 40) + '...' : 'none');
    console.log('[SSO DEBUG] Authorization header:', req.headers['authorization'] ? req.headers['authorization'].slice(0, 40) + '...' : 'none');
    if (cookieValue) {
      try {
        const base64 = cookieValue.startsWith('base64-') ? cookieValue.slice(7) : cookieValue;
        const json = Buffer.from(base64, 'base64').toString('utf8');
        const parsed = JSON.parse(json);
        supabaseToken = parsed.access_token;
        console.log('[SSO DEBUG] Extracted access_token from cookie:', supabaseToken ? supabaseToken.slice(0, 40) + '...' : 'none');
      } catch (err) {
        console.error('[SSO DEBUG] Failed to parse Supabase cookie:', err);
      }
    }
    if (!supabaseToken && req.headers['authorization']) {
      supabaseToken = req.headers['authorization'].split(' ')[1];
      console.log('[SSO DEBUG] Extracted access_token from header:', supabaseToken ? supabaseToken.slice(0, 40) + '...' : 'none');
    }
    if (!supabaseToken) {
      console.log('[SSO DEBUG] No Supabase token found');
      return res.status(401).json({ error: 'No Supabase token' });
    }
    const decodedToken = jwt.decode(supabaseToken);
    console.log('[SSO DEBUG] Decoded token:', decodedToken);
    if (!decodedToken || !decodedToken.email) {
      console.log('[SSO DEBUG] Invalid token or missing email:', decodedToken);
      return res.status(401).json({ error: 'Invalid Supabase token' });
    }
    const userEmail = decodedToken.email;

    // 3. Find or create LibreChat user by email
    let libreUser;
    try {
      libreUser = await findUser({ email: userEmail });
      console.log('[SSO DEBUG] LibreChat user lookup result:', libreUser);
      if (!libreUser) {
        // Create new user in LibreChat DB
        const balanceConfig = {};
        libreUser = await createUser({
          provider: 'sso',
          email: userEmail,
          name: decodedToken.user_metadata?.full_name || userEmail,
          emailVerified: decodedToken.email_verified || false,
          role: 'user',
        }, balanceConfig, true, true);
        console.log('[SSO DEBUG] Created new LibreChat user:', libreUser);
      }
    } catch (err) {
      console.error('[SSO DEBUG] Error finding/creating LibreChat user:', err);
      return res.status(500).json({ error: 'Failed to find or create LibreChat user', details: err.message });
    }
    // Issue LibreChat session token (JWT)
    // Use generateShortLivedToken for a 1 hour session
    const libreSession = AuthService.generateShortLivedToken(libreUser._id, '1h');
    console.log('[SSO DEBUG] Issued LibreChat session token:', libreSession ? libreSession.slice(0, 20) + '...' : 'none');
    // Create a session and refresh token for SSO, just like normal login
    let session, refreshToken, refreshTokenExpires;
    try {
      const result = await require('~/models').createSession(libreUser._id);
      session = result.session;
      refreshToken = result.refreshToken;
      refreshTokenExpires = session.expiration.getTime();
      res.cookie('refreshToken', refreshToken, {
        expires: new Date(refreshTokenExpires),
        httpOnly: true,
        secure: true, // must be true for SameSite: 'none'
        sameSite: 'none', // allow cross-origin cookies for iframe SSO
        path: '/',
      });
      res.cookie('token_provider', 'librechat', {
        expires: new Date(refreshTokenExpires),
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        path: '/',
      });
    } catch (err) {
      console.error('[SSO DEBUG] Failed to create session/refresh token:', err);
    }
    // After generating the LibreChat session token:
    res.cookie('accessToken', libreSession, {
      httpOnly: true,
      secure: true, // must be true for SameSite: 'none'
      sameSite: 'none', // allow cross-origin cookies for iframe SSO
      path: '/',
      maxAge: 60 * 60 * 1000, // 1 hour
    });
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
};

module.exports = {
  refreshController,
  registrationController,
  resetPasswordController,
  resetPasswordRequestController,
  ssoLibreChatController, // <-- export new controller
};
