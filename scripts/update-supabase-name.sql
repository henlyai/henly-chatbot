-- Update Supabase MCP name from "Supabase" to "SupaBase"
UPDATE mcp_servers 
SET name = 'SupaBase'
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
WHERE organization_id = 'ad82fce8-ba9a-438f-9fe2-956a86f479a5'
  AND is_active = true
ORDER BY name; 