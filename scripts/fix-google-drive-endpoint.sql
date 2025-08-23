-- Fix Google Drive MCP endpoint URL
-- The current endpoint points to the old mcp-servers service
-- It should point to the dedicated google-drive-mcp-server service

UPDATE mcp_servers 
SET endpoint = 'https://google-drive-mcp-server-production.up.railway.app/mcp'
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