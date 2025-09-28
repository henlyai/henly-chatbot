-- Add marketplace_settings column to organizations table
-- This column is required by the AuthController.js SSO endpoint

ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS marketplace_settings JSONB DEFAULT '{
  "enabled": true,
  "allow_public_sharing": true,
  "max_public_agents": 10,
  "max_public_prompts": 20
}'::jsonb;

-- Add a comment to document the column
COMMENT ON COLUMN organizations.marketplace_settings IS 'Marketplace configuration settings for the organization';

-- Verify the column was added
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'organizations' 
AND column_name = 'marketplace_settings';

