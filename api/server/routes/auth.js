const express = require('express');
console.log('[DEBUG] auth.js router loaded');
const {
  refreshController,
  registrationController,
  resetPasswordController,
  resetPasswordRequestController,
  ssoLibreChatController,
} = require('~/server/controllers/AuthController');
const { loginController } = require('~/server/controllers/auth/LoginController');
const { logoutController } = require('~/server/controllers/auth/LogoutController');
const { verify2FAWithTempToken } = require('~/server/controllers/auth/TwoFactorAuthController');
const {
  enable2FA,
  verify2FA,
  disable2FA,
  regenerateBackupCodes,
  confirm2FA,
} = require('~/server/controllers/TwoFactorController');
const {
  checkBan,
  logHeaders,
  loginLimiter,
  requireJwtAuth,
  checkInviteUser,
  registerLimiter,
  requireLdapAuth,
  setBalanceConfig,
  requireLocalAuth,
  resetPasswordLimiter,
  validateRegistration,
  validatePasswordReset,
} = require('~/server/middleware');

const router = express.Router();

// Debug log for all requests to this router
router.use((req, res, next) => {
  console.log(`[DEBUG] /api/auth route hit: ${req.method} ${req.originalUrl}`);
  next();
});

const ldapAuth = !!process.env.LDAP_URL && !!process.env.LDAP_USER_SEARCH_BASE;
//Local
router.post('/logout', requireJwtAuth, logoutController);
router.post(
  '/login',
  logHeaders,
  loginLimiter,
  checkBan,
  ldapAuth ? requireLdapAuth : requireLocalAuth,
  setBalanceConfig,
  loginController,
);
router.post('/refresh', refreshController);
router.post(
  '/register',
  registerLimiter,
  checkBan,
  checkInviteUser,
  validateRegistration,
  registrationController,
);
router.post(
  '/requestPasswordReset',
  resetPasswordLimiter,
  checkBan,
  validatePasswordReset,
  resetPasswordRequestController,
);
router.post('/resetPassword', checkBan, validatePasswordReset, resetPasswordController);

router.get('/2fa/enable', requireJwtAuth, enable2FA);
router.post('/2fa/verify', requireJwtAuth, verify2FA);
router.post('/2fa/verify-temp', checkBan, verify2FAWithTempToken);
router.post('/2fa/confirm', requireJwtAuth, confirm2FA);
router.post('/2fa/disable', requireJwtAuth, disable2FA);
router.post('/2fa/backup/regenerate', requireJwtAuth, regenerateBackupCodes);

// Register SSO proxy endpoint for LibreChat
router.options('/sso/librechat', (req, res) => {
  console.log('[DEBUG] OPTIONS /api/auth/sso/librechat route hit');
  res.header('Access-Control-Allow-Origin', 'https://henly.ai');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.status(200).end();
});

router.post('/sso/librechat', (req, res, next) => {
  console.log('[DEBUG] POST /api/auth/sso/librechat route hit');
  // Add CORS headers for the POST response
  res.header('Access-Control-Allow-Origin', 'https://henly.ai');
  res.header('Access-Control-Allow-Credentials', 'true');
  next();
}, ssoLibreChatController);

module.exports = router;
