-- Fix Supabase MCP endpoint URL to include https:// protocol and /mcp path
-- This fixes the issue where the endpoint was missing the protocol and path

UPDATE mcp_servers 
SET endpoint = 'https://supabase-mcp-server-production-a417.up.railway.app/mcp'
WHERE name = 'Supabase' 
  AND organization_id = 'ad82fce8-ba9a-438f-9fe2-956a86f479a5'
  AND is_active = true;

-- Verify the update
SELECT 
  name,
  endpoint,
  is_active,
  organization_id
FROM mcp_servers 
WHERE name = 'Supabase' 
  AND organization_id = 'ad82fce8-ba9a-438f-9fe2-956a86f479a5'; 