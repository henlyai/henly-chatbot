-- Fix Google Drive MCP endpoint URL - CORRECTED VERSION
-- The Google Drive MCP is actually running on the old mcp-servers service
-- We need to revert it back to the working URL

UPDATE mcp_servers 
SET endpoint = 'https://mcp-servers-production-c189.up.railway.app/mcp'
WHERE name = 'Google Drive' 
  AND organization_id = 'ad82fce8-ba9a-438f-9fe2-956a86f479a5'
  AND is_active = true;

-- Verify all MCP endpoints
SELECT 
  name,
  endpoint,
  is_active,
  organization_id
FROM mcp_servers 
WHERE organization_id = 'ad82fce8-ba9a-438f-9fe2-956a86f479a5'
  AND is_active = true
ORDER BY name; 