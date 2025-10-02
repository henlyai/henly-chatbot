-- =============================================
-- UPDATE PLAN STRUCTURE - ALL MODELS & FEATURES
-- =============================================
-- This script updates all organizations to have access to all models and features
-- Only token limits differentiate the plans

-- Update LibreChat configuration for all plans
-- All plans now have access to all models and features
-- Only token limits differentiate the plans
UPDATE organizations 
SET librechat_config = CASE 
  WHEN plan_type = 'starter' THEN '{
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
  }'::jsonb
  WHEN plan_type = 'professional' THEN '{
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
  }'::jsonb
  WHEN plan_type = 'enterprise' THEN '{
    "enabled_models": [
      "gpt-3.5-turbo", "gpt-4", "gpt-4-turbo", "gpt-4o", "gpt-4o-mini",
      "claude-3-sonnet", "claude-3-opus", "claude-3-haiku", "claude-3.5-sonnet",
      "gemini-pro", "gemini-pro-vision", "o1-preview", "o1-mini"
    ],
    "max_tokens": 10000000,
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
  }'::jsonb
  ELSE '{
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
  }'::jsonb
END;

-- Update organization limits to reflect new plan structure
UPDATE organizations 
SET monthly_token_limit = CASE 
  WHEN plan_type = 'starter' THEN 100000      -- 100K tokens per month
  WHEN plan_type = 'professional' THEN 1000000  -- 1M tokens per month
  WHEN plan_type = 'enterprise' THEN 10000000   -- 10M tokens per month
  ELSE 100000  -- Default to starter plan
END;

-- Verify the updates
SELECT 
  name,
  plan_type,
  monthly_token_limit,
  librechat_config->'max_tokens' as config_max_tokens,
  librechat_config->'enabled_models' as enabled_models,
  librechat_config->'features' as features
FROM organizations
ORDER BY plan_type, name;

-- Show plan comparison
SELECT 
  'Plan Structure Updated Successfully' as status,
  'All plans now have access to all models and features' as description,
  'Only token limits differentiate the plans' as note;
