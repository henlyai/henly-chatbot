const express = require('express');
const { logger } = require('@librechat/data-schemas');
const { CacheKeys, defaultSocialLogins, Constants } = require('librechat-data-provider');
const { getCustomConfig } = require('~/server/services/Config/getCustomConfig');
const { getLdapConfig } = require('~/server/services/Config/ldap');
const OrganizationMCPService = require('~/server/services/OrganizationMCP');
const { debugLibreChatAPI, debugMCPLoading, debugUserContext } = require('~/server/middleware/debugLibreChat');
const { provideDefaultOrgContext } = require('~/server/middleware/defaultOrgContext');
const { getProjectByName } = require('~/models/Project');
const { isEnabled } = require('~/server/utils');
const { getLogStores } = require('~/cache');

const router = express.Router();
const emailLoginEnabled =
  process.env.ALLOW_EMAIL_LOGIN === undefined || isEnabled(process.env.ALLOW_EMAIL_LOGIN);
const passwordResetEnabled = isEnabled(process.env.ALLOW_PASSWORD_RESET);

const sharedLinksEnabled =
  process.env.ALLOW_SHARED_LINKS === undefined || isEnabled(process.env.ALLOW_SHARED_LINKS);

const publicSharedLinksEnabled =
  sharedLinksEnabled &&
  (process.env.ALLOW_SHARED_LINKS_PUBLIC === undefined ||
    isEnabled(process.env.ALLOW_SHARED_LINKS_PUBLIC));

// Add debugging middleware to config route
router.use(provideDefaultOrgContext);
router.use(debugUserContext);
router.use(debugMCPLoading);
router.use(debugLibreChatAPI);

router.get('/', async function (req, res) {
  const cache = getLogStores(CacheKeys.CONFIG_STORE);

  const cachedStartupConfig = await cache.get(CacheKeys.STARTUP_CONFIG);
  if (cachedStartupConfig) {
    res.send(cachedStartupConfig);
    return;
  }

  const isBirthday = () => {
    const today = new Date();
    return today.getMonth() === 1 && today.getDate() === 11;
  };

  const instanceProject = await getProjectByName(Constants.GLOBAL_PROJECT_NAME, '_id');

  const ldap = getLdapConfig();

  try {
    const isOpenIdEnabled =
      !!process.env.OPENID_CLIENT_ID &&
      !!process.env.OPENID_CLIENT_SECRET &&
      !!process.env.OPENID_ISSUER &&
      !!process.env.OPENID_SESSION_SECRET;

    const isSamlEnabled =
      !!process.env.SAML_ENTRY_POINT &&
      !!process.env.SAML_ISSUER &&
      !!process.env.SAML_CERT &&
      !!process.env.SAML_SESSION_SECRET;

    /** @type {TStartupConfig} */
    const payload = {
      appTitle: process.env.APP_TITLE || 'LibreChat',
      socialLogins: req.app.locals.socialLogins ?? defaultSocialLogins,
      discordLoginEnabled: !!process.env.DISCORD_CLIENT_ID && !!process.env.DISCORD_CLIENT_SECRET,
      facebookLoginEnabled:
        !!process.env.FACEBOOK_CLIENT_ID && !!process.env.FACEBOOK_CLIENT_SECRET,
      githubLoginEnabled: !!process.env.GITHUB_CLIENT_ID && !!process.env.GITHUB_CLIENT_SECRET,
      googleLoginEnabled: !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET,
      appleLoginEnabled:
        !!process.env.APPLE_CLIENT_ID &&
        !!process.env.APPLE_TEAM_ID &&
        !!process.env.APPLE_KEY_ID &&
        !!process.env.APPLE_PRIVATE_KEY_PATH,
      openidLoginEnabled: isOpenIdEnabled,
      openidLabel: process.env.OPENID_BUTTON_LABEL || 'Continue with OpenID',
      openidImageUrl: process.env.OPENID_IMAGE_URL,
      openidAutoRedirect: isEnabled(process.env.OPENID_AUTO_REDIRECT),
      samlLoginEnabled: !isOpenIdEnabled && isSamlEnabled,
      samlLabel: process.env.SAML_BUTTON_LABEL,
      samlImageUrl: process.env.SAML_IMAGE_URL,
      serverDomain: process.env.DOMAIN_SERVER || 'http://localhost:3080',
      emailLoginEnabled,
      registrationEnabled: !ldap?.enabled && isEnabled(process.env.ALLOW_REGISTRATION),
      socialLoginEnabled: isEnabled(process.env.ALLOW_SOCIAL_LOGIN),
      emailEnabled:
        (!!process.env.EMAIL_SERVICE || !!process.env.EMAIL_HOST) &&
        !!process.env.EMAIL_USERNAME &&
        !!process.env.EMAIL_PASSWORD &&
        !!process.env.EMAIL_FROM,
      passwordResetEnabled,
      showBirthdayIcon:
        isBirthday() ||
        isEnabled(process.env.SHOW_BIRTHDAY_ICON) ||
        process.env.SHOW_BIRTHDAY_ICON === '',
      helpAndFaqURL: process.env.HELP_AND_FAQ_URL || 'https://librechat.ai',
      interface: req.app.locals.interfaceConfig,
      turnstile: req.app.locals.turnstileConfig,
      modelSpecs: req.app.locals.modelSpecs,
      balance: req.app.locals.balance,
      sharedLinksEnabled,
      publicSharedLinksEnabled,
      analyticsGtmId: process.env.ANALYTICS_GTM_ID,
      instanceProjectId: instanceProject._id.toString(),
      bundlerURL: process.env.SANDPACK_BUNDLER_URL,
      staticBundlerURL: process.env.SANDPACK_STATIC_BUNDLER_URL,
    };

    // Initialize MCP service
    const mcpService = new OrganizationMCPService();
    
    // DEBUG: Interface configuration
    logger.warn(`[CONFIG DEBUG] ===== CONFIG ROUTE CALLED =====`);
    logger.warn(`[CONFIG DEBUG] Interface config: ${JSON.stringify(req.app.locals.interfaceConfig, null, 2)}`);
    logger.warn(`[CONFIG DEBUG] Agents enabled: ${req.app.locals.interfaceConfig?.agents}`);
    logger.warn(`[CONFIG DEBUG] Prompts enabled: ${req.app.locals.interfaceConfig?.prompts}`);
    logger.warn(`[CONFIG DEBUG] MCP servers config: ${JSON.stringify(req.app.locals.interfaceConfig?.mcpServers, null, 2)}`);
    logger.warn(`[CONFIG DEBUG] Model specs: ${JSON.stringify(req.app.locals.modelSpecs ? Object.keys(req.app.locals.modelSpecs) : "null", null, 2)}`);
    
    // SECURITY FIX: Remove DEFAULT_ORGANIZATION_ID fallback
    // This was a critical security vulnerability
    if (!req.user || !req.user.organization_id) {
      logger.error("[SECURITY] Config route accessed without proper authentication");
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'This endpoint requires proper authentication and organization context'
      });
    }
    
    const user = req.user;
    
    logger.warn("[CONFIG DEBUG] Final user object:", JSON.stringify(user, null, 2));
    
    // Get MCP configuration from Supabase
    const mcpConfig = await mcpService.getUserMCPConfig(user);
    logger.warn("[CONFIG DEBUG] MCP config returned:", JSON.stringify(mcpConfig, null, 2));
    logger.warn("[CONFIG DEBUG] MCP config keys:", mcpConfig ? Object.keys(mcpConfig) : "null");
    
    payload.mcpServers = {};
    if (mcpConfig && Object.keys(mcpConfig).length > 0) {
      for (const serverName in mcpConfig) {
        const serverConfig = mcpConfig[serverName];
        // Do not expose secrets in startup config
        const safeOauth = serverConfig.oauth
          ? {
              authorization_url: serverConfig.oauth.authorization_url,
              token_url: serverConfig.oauth.token_url,
              scope: serverConfig.oauth.scope,
              redirect_uri: serverConfig.oauth.redirect_uri,
            }
          : undefined;
        payload.mcpServers[serverName] = {
          type: serverConfig.type || 'sse',
          url: serverConfig.url,
          timeout: serverConfig.timeout || 60000,
          oauth: safeOauth,
          customUserVars: serverConfig.customUserVars || {},
        };
      }
    }

    /** @type {TCustomConfig['webSearch']} */
    const webSearchConfig = req.app.locals.webSearch;
    if (
      webSearchConfig != null &&
      (webSearchConfig.searchProvider ||
        webSearchConfig.scraperType ||
        webSearchConfig.rerankerType)
    ) {
      payload.webSearch = {};
    }

    if (webSearchConfig?.searchProvider) {
      payload.webSearch.searchProvider = webSearchConfig.searchProvider;
    }
    if (webSearchConfig?.scraperType) {
      payload.webSearch.scraperType = webSearchConfig.scraperType;
    }
    if (webSearchConfig?.rerankerType) {
      payload.webSearch.rerankerType = webSearchConfig.rerankerType;
    }

    if (ldap) {
      payload.ldap = ldap;
    }

    if (typeof process.env.CUSTOM_FOOTER === 'string') {
      payload.customFooter = process.env.CUSTOM_FOOTER;
    }

    // DEBUG: Final payload before sending
    logger.warn("[CONFIG DEBUG] ===== FINAL CONFIG PAYLOAD =====");
    logger.warn("[CONFIG DEBUG] Interface agents:", payload.interface?.agents);
    logger.warn("[CONFIG DEBUG] Interface prompts:", payload.interface?.prompts);
    logger.warn("[CONFIG DEBUG] Interface mcpServers:", payload.interface?.mcpServers);
    logger.warn("[CONFIG DEBUG] MCP servers count:", Object.keys(payload.mcpServers || {}).length);
    logger.warn("[CONFIG DEBUG] MCP server names:", Object.keys(payload.mcpServers || {}).join(', '));
    logger.warn("[CONFIG DEBUG] Endpoints available:", Object.keys(payload.endpoints || {}).join(', '));
    logger.warn("[CONFIG DEBUG] Has agents endpoint:", !!payload.endpoints?.agents);
    logger.warn("[CONFIG DEBUG] =====================================");

    await cache.set(CacheKeys.STARTUP_CONFIG, payload);
    return res.status(200).send(payload);
  } catch (err) {
    logger.error('Error in startup config', err);
    return res.status(500).send({ error: err.message });
  }
});

module.exports = router;
