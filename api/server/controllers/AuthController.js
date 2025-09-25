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
const { findUser, createUser, getUserById, deleteAllUserSessions, findSession, updateUser } = require('~/models');
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

    // 3. Initialize Supabase client for user profile operations
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    
    // Get user's Supabase profile for role and organization
    let supabaseUserRole = 'user'; // default fallback
    let organizationData = null;
    
    try {
      console.log('[SSO DEBUG] Fetching user profile for email:', userEmail);
      
      // First try to get profile with marketplace_settings
      let { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select(`
          role,
          organization_id,
          organizations!profiles_organization_id_fkey(
            id,
            name,
            domain,
            marketplace_settings
          )
        `)
        .eq('email', userEmail)
        .single();

      // If marketplace_settings column doesn't exist, try without it
      if (profileError && profileError.code === '42703' && profileError.message.includes('marketplace_settings')) {
        console.log('[SSO DEBUG] marketplace_settings column not found, retrying without it');
        const { data: profileWithoutMarketplace, error: profileErrorWithoutMarketplace } = await supabase
          .from('profiles')
          .select(`
            role,
            organization_id,
            organizations!profiles_organization_id_fkey(
              id,
              name,
              domain
            )
          `)
          .eq('email', userEmail)
          .single();
        
        profile = profileWithoutMarketplace;
        profileError = profileErrorWithoutMarketplace;
      }

      // If RLS infinite recursion error, try a simpler query or use fallback
      if (profileError && profileError.code === '42P17' && profileError.message.includes('infinite recursion')) {
        console.log('[SSO DEBUG] RLS infinite recursion detected, trying fallback approach');
        
        // Try to get just the profile without the organization join
        const { data: simpleProfile, error: simpleError } = await supabase
          .from('profiles')
          .select('role, organization_id')
          .eq('email', userEmail)
          .single();
        
        if (!simpleError && simpleProfile) {
          console.log('[SSO DEBUG] Simple profile query succeeded:', simpleProfile);
          
          // If we have organization_id, try to get organization data separately
          if (simpleProfile.organization_id) {
            const { data: orgData, error: orgError } = await supabase
              .from('organizations')
              .select('id, name, domain, marketplace_settings')
              .eq('id', simpleProfile.organization_id)
              .single();
            
            if (!orgError && orgData) {
              console.log('[SSO DEBUG] Organization data fetched separately:', orgData);
              profile = {
                role: simpleProfile.role,
                organization_id: simpleProfile.organization_id,
                organizations: orgData
              };
              profileError = null;
            } else {
              console.log('[SSO DEBUG] Could not fetch organization data separately:', orgError);
              // Use simple profile without organization data
              profile = simpleProfile;
              profileError = null;
            }
          } else {
            // Use simple profile without organization data
            profile = simpleProfile;
            profileError = null;
          }
        } else {
          console.log('[SSO DEBUG] Simple profile query also failed:', simpleError);
          
          // Last resort: try with service role to bypass RLS entirely
          if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
            console.log('[SSO DEBUG] Attempting service role fallback to bypass RLS');
            try {
              const serviceSupabase = createClient(
                process.env.SUPABASE_URL, 
                process.env.SUPABASE_SERVICE_ROLE_KEY,
                { auth: { autoRefreshToken: false, persistSession: false } }
              );
              
              const { data: serviceProfile, error: serviceError } = await serviceSupabase
                .from('profiles')
                .select(`
                  role,
                  organization_id,
                  organizations!profiles_organization_id_fkey(
                    id,
                    name,
                    domain,
                    marketplace_settings
                  )
                `)
                .eq('email', userEmail)
                .single();
              
              if (!serviceError && serviceProfile) {
                console.log('[SSO DEBUG] Service role query succeeded:', serviceProfile);
                profile = serviceProfile;
                profileError = null;
              } else {
                console.log('[SSO DEBUG] Service role query also failed:', serviceError);
              }
            } catch (serviceErr) {
              console.log('[SSO DEBUG] Service role fallback error:', serviceErr);
            }
          }
          
          // Keep the original error for fallback handling if all attempts failed
        }
      }

      console.log('[SSO DEBUG] Supabase profile query result:', {
        profile,
        error: profileError,
        hasProfile: !!profile,
        hasError: !!profileError
      });

      if (!profileError && profile) {
        console.log('[SSO DEBUG] Profile found:', {
          role: profile.role,
          organization_id: profile.organization_id,
          hasOrganizations: !!profile.organizations
        });
        
        // Extract role and map to LibreChat roles
        if (profile.role) {
          // Map Supabase roles to LibreChat roles
          if (profile.role === 'super_admin' || profile.role === 'admin') {
            supabaseUserRole = 'admin'; // Map to LibreChat admin role
          } else {
            supabaseUserRole = 'user'; // Map all other roles to LibreChat user role
          }
          console.log('[SSO DEBUG] Mapped Supabase role', profile.role, 'to LibreChat role:', supabaseUserRole);
        }
        
        // Extract organization data
        if (profile.organization_id && profile.organizations) {
          organizationData = {
            id: profile.organization_id,
            name: profile.organizations.name,
            domain: profile.organizations.domain,
            marketplace: profile.organizations.marketplace_settings || {
              enabled: true,
              allow_public_sharing: true,
              max_public_agents: 10,
              max_public_prompts: 20
            }
          };
          console.log('[SSO DEBUG] Found organization for user:', organizationData.name);
        } else {
          console.log('[SSO DEBUG] No organization data found:', {
            hasOrganizationId: !!profile.organization_id,
            hasOrganizations: !!profile.organizations,
            organizationId: profile.organization_id,
            organizations: profile.organizations
          });
        }
      } else {
        console.log('[SSO DEBUG] No Supabase profile found, using defaults. Error:', profileError?.message);
      }
    } catch (profileFetchError) {
      console.error('[SSO DEBUG] Error fetching user profile from Supabase:', profileFetchError);
    }

    // 4. Find or create LibreChat user by email with Supabase role
    let libreUser;
    try {
      libreUser = await findUser({ email: userEmail });
      console.log('[SSO DEBUG] LibreChat user lookup result:', libreUser);
      if (!libreUser) {
        // Create new user in LibreChat DB with Supabase role
        const balanceConfig = {};
        libreUser = await createUser({
          provider: 'sso',
          email: userEmail,
          name: decodedToken.user_metadata?.full_name || userEmail.split('@')[0],
          emailVerified: decodedToken.email_verified || false,
          role: supabaseUserRole, // Use Supabase role instead of hardcoded 'user'
        }, balanceConfig, true, true);
        console.log('[SSO DEBUG] Created new LibreChat user with role:', supabaseUserRole);
      } else {
        // Update existing user's name if it's different
        const userName = decodedToken.user_metadata?.full_name || userEmail.split('@')[0];
        if (libreUser.name !== userName) {
          libreUser = await updateUser(libreUser._id, { name: userName });
          console.log('[SSO DEBUG] Updated LibreChat user name:', libreUser);
        }
      }
    } catch (err) {
      console.error('[SSO DEBUG] Error finding/creating LibreChat user:', err);
      return res.status(500).json({ error: 'Failed to find or create LibreChat user', details: err.message });
    }

    // 5. Sync role if different from current LibreChat user role
    if (supabaseUserRole && supabaseUserRole !== libreUser.role) {
      logger.info(`[SSO DEBUG] Role sync: updating LibreChat user role from '${libreUser.role}' to '${supabaseUserRole}'`);
      try {
        libreUser = await updateUser(libreUser._id, { role: supabaseUserRole });
        logger.info(`[SSO DEBUG] Successfully updated user role to: ${supabaseUserRole}`);
      } catch (roleUpdateError) {
        logger.error(`[SSO DEBUG] Failed to update user role: ${roleUpdateError.message}`);
      }
    } else if (supabaseUserRole) {
      logger.info(`[SSO DEBUG] User role already synced: ${supabaseUserRole}`);
    }

    // 6. Issue LibreChat session token (JWT) with organization context
    const tokenPayload = {
      id: libreUser._id
    };

    console.log('[SSO DEBUG] Creating JWT token payload:', {
      userId: libreUser._id,
      hasOrganizationData: !!organizationData,
      organizationData: organizationData
    });

    // Add organization to JWT if available
    if (organizationData) {
      tokenPayload.organization = organizationData;
      console.log('[SSO DEBUG] Added organization to JWT payload:', organizationData);
    } else {
      // Fallback: use default organization if available
      const defaultOrgId = process.env.DEFAULT_ORGANIZATION_ID;
      if (defaultOrgId) {
        tokenPayload.organization = {
          id: defaultOrgId,
          name: 'Default Organization',
          domain: null,
          marketplace: {
            enabled: true,
            allow_public_sharing: true,
            max_public_agents: 10,
            max_public_prompts: 20
          }
        };
        console.log('[SSO DEBUG] Using default organization for JWT payload:', defaultOrgId);
      } else {
        console.log('[SSO DEBUG] No organization data to add to JWT payload and no default organization set');
      }
    }

    // Generate custom JWT with organization context for marketplace  
    const libreSession = jwt.sign(tokenPayload, process.env.JWT_SECRET, {
      expiresIn: '1h',
      algorithm: 'HS256',
    });
    console.log('[SSO DEBUG] Issued LibreChat session token:', libreSession ? libreSession.slice(0, 20) + '...' : 'none');
    console.log('[SSO DEBUG] Final JWT payload:', tokenPayload);
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
