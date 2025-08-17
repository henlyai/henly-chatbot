-- Setup MCP Servers for ScaleWize AI
-- This script sets up the mcp_servers table with sample data

-- Insert sample organization (if not exists)
INSERT INTO public.organizations (id, name, domain, subscription_status, plan_type)
VALUES (
  '550e8400-e29b-41d4-a716-446655440000', -- Sample organization ID
  'ScaleWize AI Demo',
  'scalewize.ai',
  'active',
  'premium'
) ON CONFLICT (domain) DO NOTHING;

-- Insert sample MCP servers
INSERT INTO public.mcp_servers (
  name,
  description,
  endpoint,
  organization_id,
  capabilities,
  is_active
) VALUES 
(
  'Google Drive',
  'Access Google Drive files and folders with full content reading capabilities',
  'https://mcp-servers-production-c189.up.railway.app/sse',
  '550e8400-e29b-41d4-a716-446655440000',
  ARRAY['list_files', 'search_files', 'get_file_content', 'get_file_metadata'],
  true
),
(
  'Slack',
  'Send messages and read channels in Slack',
  'https://mcp.pipedream.net/28971e50-c231-428a-97d9-803c981ade82/slack',
  '550e8400-e29b-41d4-a716-446655440000',
  ARRAY['send_message', 'read_channels', 'list_channels'],
  true
)
ON CONFLICT (name, organization_id) DO UPDATE SET
  endpoint = EXCLUDED.endpoint,
  capabilities = EXCLUDED.capabilities,
  is_active = EXCLUDED.is_active,
  updated_at = now();

-- Insert additional MCP servers for different organizations
-- You can add more organizations and their specific MCP servers here

-- Example: Custom MCP server for a specific organization
-- INSERT INTO public.mcp_servers (
--   name,
--   description,
--   endpoint,
--   organization_id,
--   capabilities,
--   is_active
-- ) VALUES (
--   'Custom CRM',
--   'Access custom CRM data for the organization',
--   'https://custom-crm-mcp.railway.app/sse',
--   'your-organization-id-here',
--   ARRAY['get_contacts', 'update_contacts', 'get_deals'],
--   true
-- );

-- Query to verify the setup
SELECT 
  o.name as organization_name,
  m.name as mcp_server_name,
  m.endpoint,
  m.capabilities,
  m.is_active
FROM public.mcp_servers m
JOIN public.organizations o ON m.organization_id = o.id
WHERE m.is_active = true
ORDER BY o.name, m.name; 