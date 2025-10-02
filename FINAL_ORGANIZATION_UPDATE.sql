-- =============================================
-- FINAL ORGANIZATION UPDATE SCRIPT
-- =============================================
-- This script updates your existing organizations with the new plan structure
-- and removes unused tables

-- 1. UPDATE EXISTING ORGANIZATIONS
-- =============================================

-- Update Tofino organization (starter plan)
UPDATE organizations 
SET librechat_config = '{
  "enabled_models": [
    "gpt-3.5-turbo", "gpt-4", "gpt-4-turbo", "gpt-4o", "gpt-4o-mini",
    "claude-3-sonnet", "claude-3-opus", "claude-3-haiku", "claude-3.5-sonnet",
    "gemini-pro", "gemini-pro-vision", "o1-preview", "o1-mini"
  ],
  "max_tokens": 100000,
  "knowledge_bases": [],
  "mcp_servers": [],
  "custom_instructions": "You are a helpful AI assistant for this organization.",
  "allowed_endpoints": ["/api/chat"],
  "features": {
    "file_upload": true,
    "image_generation": true,
    "voice_chat": true,
    "code_interpreter": true,
    "web_search": true,
    "agents": true,
    "prompts": true,
    "mcp_servers": true,
    "knowledge_bases": true
  }
}'::jsonb,
monthly_token_limit = 100000
WHERE id = '681dec0c-eb2a-4457-bc59-818ef658d282';

-- Update Henly AI organization (professional plan)
UPDATE organizations 
SET librechat_config = '{
  "enabled_models": [
    "gpt-3.5-turbo", "gpt-4", "gpt-4-turbo", "gpt-4o", "gpt-4o-mini",
    "claude-3-sonnet", "claude-3-opus", "claude-3-haiku", "claude-3.5-sonnet",
    "gemini-pro", "gemini-pro-vision", "o1-preview", "o1-mini"
  ],
  "max_tokens": 1000000,
  "knowledge_bases": [],
  "mcp_servers": [],
  "custom_instructions": "You are a helpful AI assistant for this organization.",
  "allowed_endpoints": ["/api/chat"],
  "features": {
    "file_upload": true,
    "image_generation": true,
    "voice_chat": true,
    "code_interpreter": true,
    "web_search": true,
    "agents": true,
    "prompts": true,
    "mcp_servers": true,
    "knowledge_bases": true
  }
}'::jsonb,
monthly_token_limit = 1000000
WHERE id = 'ad82fce8-ba9a-438f-9fe2-956a86f479a5';

-- 2. REMOVE UNUSED TABLES
-- =============================================

-- Drop organization_audit_log table (not used in codebase)
DROP TABLE IF EXISTS organization_audit_log CASCADE;

-- Drop organization_api_keys table (not used in codebase)
DROP TABLE IF EXISTS organization_api_keys CASCADE;

-- 3. VERIFY UPDATES
-- =============================================

-- Show updated organizations
SELECT 
  name,
  plan_type,
  monthly_token_limit,
  librechat_config->'max_tokens' as config_max_tokens,
  jsonb_array_length(librechat_config->'enabled_models') as model_count,
  librechat_config->'features' as features
FROM organizations
ORDER BY name;

-- Show remaining tables (should not include organization_audit_log or organization_api_keys)
SELECT 
  schemaname,
  tablename
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename NOT LIKE 'pg_%'
  AND tablename NOT LIKE 'sql_%'
ORDER BY tablename;

-- 4. SUCCESS MESSAGE
-- =============================================
SELECT 
  'Organization updates completed successfully!' as status,
  'All organizations now have access to all models and features' as description,
  'Only token limits differentiate the plans' as note;
