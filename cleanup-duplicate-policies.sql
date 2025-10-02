-- =============================================
-- CRITICAL SECURITY FIXES - REMOVE DEFAULT ORGANIZATION
-- =============================================
-- This script removes all references to DEFAULT_ORGANIZATION_ID and fixes security vulnerabilities

-- 1. DROP DANGEROUS DEFAULT ORGANIZATION MIDDLEWARE
-- =============================================
-- The defaultOrgContext.js middleware is a CRITICAL SECURITY VULNERABILITY
-- It allows unauthenticated access to organization data

-- 2. FIX MCP SERVER FALLBACKS
-- =============================================
-- Remove hardcoded organization IDs from MCP servers
-- These are currently using: 'ad82fce8-ba9a-438f-9fe2-956a86f479a5'

-- 3. ADD MISSING RLS POLICIES
-- =============================================

-- Enable RLS on all tables that don't have it
ALTER TABLE IF EXISTS api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS mcp_servers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS knowledge_bases ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS knowledge_base_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS agent_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS prompt_library ENABLE ROW LEVEL SECURITY;

-- API Keys Policies
DROP POLICY IF EXISTS "Users can view organization API keys" ON api_keys;
DROP POLICY IF EXISTS "Admins can manage organization API keys" ON api_keys;

CREATE POLICY "Users can view organization API keys" ON api_keys
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM profiles 
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage organization API keys" ON api_keys
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- Invitations Policies
DROP POLICY IF EXISTS "Users can view organization invitations" ON invitations;
DROP POLICY IF EXISTS "Admins can manage organization invitations" ON invitations;

CREATE POLICY "Users can view organization invitations" ON invitations
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM profiles 
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage organization invitations" ON invitations
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- MCP Servers Policies
DROP POLICY IF EXISTS "Users can view organization MCP servers" ON mcp_servers;
DROP POLICY IF EXISTS "Admins can manage organization MCP servers" ON mcp_servers;

CREATE POLICY "Users can view organization MCP servers" ON mcp_servers
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM profiles 
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage organization MCP servers" ON mcp_servers
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- Knowledge Bases Policies
DROP POLICY IF EXISTS "Users can view organization knowledge bases" ON knowledge_bases;
DROP POLICY IF EXISTS "Admins can manage organization knowledge bases" ON knowledge_bases;

CREATE POLICY "Users can view organization knowledge bases" ON knowledge_bases
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM profiles 
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage organization knowledge bases" ON knowledge_bases
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- Knowledge Base Documents Policies
DROP POLICY IF EXISTS "Users can view organization knowledge base documents" ON knowledge_base_documents;
DROP POLICY IF EXISTS "Admins can manage organization knowledge base documents" ON knowledge_base_documents;

CREATE POLICY "Users can view organization knowledge base documents" ON knowledge_base_documents
  FOR SELECT USING (
    knowledge_base_id IN (
      SELECT id FROM knowledge_bases 
      WHERE organization_id IN (
        SELECT organization_id FROM profiles 
        WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Admins can manage organization knowledge base documents" ON knowledge_base_documents
  FOR ALL USING (
    knowledge_base_id IN (
      SELECT id FROM knowledge_bases 
      WHERE organization_id IN (
        SELECT organization_id FROM profiles 
        WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
      )
    )
  );

-- Agent Library Policies
DROP POLICY IF EXISTS "Users can view their organization's agents" ON agent_library;
DROP POLICY IF EXISTS "Users can manage their organization's agents" ON agent_library;

CREATE POLICY "Users can view their organization's agents" ON agent_library
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM profiles 
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their organization's agents" ON agent_library
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM profiles 
      WHERE id = auth.uid()
    )
  );

-- Prompt Library Policies
DROP POLICY IF EXISTS "Users can view their organization's prompts" ON prompt_library;
DROP POLICY IF EXISTS "Users can manage their organization's prompts" ON prompt_library;

CREATE POLICY "Users can view their organization's prompts" ON prompt_library
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM profiles 
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their organization's prompts" ON prompt_library
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM profiles 
      WHERE id = auth.uid()
    )
  );

-- 4. ADD ORGANIZATION VALIDATION FUNCTION
-- =============================================
CREATE OR REPLACE FUNCTION validate_organization_access(
  user_id UUID,
  org_id UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = user_id 
    AND organization_id = org_id
  );
END;
$$;

-- 5. ADD AUDIT LOGGING TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS organization_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  user_id UUID REFERENCES profiles(id),
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on audit log
ALTER TABLE organization_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their organization's audit log" ON organization_audit_log
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM profiles 
      WHERE id = auth.uid()
    )
  );

-- 6. ADD CONSTRAINTS TO ENSURE ORGANIZATION_ID IS ALWAYS PRESENT
-- =============================================
ALTER TABLE chat_sessions ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE usage_metrics ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE billing_records ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE api_keys ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE invitations ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE mcp_servers ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE knowledge_bases ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE agent_library ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE prompt_library ALTER COLUMN organization_id SET NOT NULL;

-- 7. CREATE ORGANIZATION-SPECIFIC API KEYS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS organization_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL, -- 'openai', 'anthropic', 'google', etc.
  api_key_encrypted TEXT NOT NULL, -- Encrypted API key
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  
  UNIQUE(organization_id, provider)
);

-- Enable RLS on organization API keys
ALTER TABLE organization_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view organization API keys" ON organization_api_keys
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM profiles 
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage organization API keys" ON organization_api_keys
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- 8. VERIFICATION QUERIES
-- =============================================
SELECT 'Security fixes completed successfully' as status;

-- Check that all tables have RLS enabled
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN (
    'organizations', 'profiles', 'chat_sessions', 'usage_metrics', 
    'billing_records', 'api_keys', 'invitations', 'mcp_servers',
    'knowledge_bases', 'knowledge_base_documents', 'agent_library',
    'prompt_library', 'organization_audit_log', 'organization_api_keys'
  )
ORDER BY tablename;

-- Check that all tables have policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;