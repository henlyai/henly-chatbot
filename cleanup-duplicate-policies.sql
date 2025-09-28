-- Clean up duplicate RLS policies to avoid conflicts
-- This script removes duplicate policies and keeps only the simplified ones

-- =============================================
-- REMOVE DUPLICATE POLICIES ON AGENT_LIBRARY
-- =============================================

-- Remove the older, more complex policies that might conflict
DROP POLICY IF EXISTS "Create agents for own org" ON public.agent_library;
DROP POLICY IF EXISTS "Update own org agents" ON public.agent_library;
DROP POLICY IF EXISTS "Users can manage their organization's agents" ON public.agent_library;

-- Keep only the simplified policies:
-- - "Authenticated users can view agents"
-- - "Authenticated users can create agents" 
-- - "Authenticated users can update agents"
-- - "Authenticated users can delete agents"

-- =============================================
-- REMOVE DUPLICATE POLICIES ON PROMPT_LIBRARY
-- =============================================

-- Remove the older, more complex policies that might conflict
DROP POLICY IF EXISTS "Create prompts for own org" ON public.prompt_library;
DROP POLICY IF EXISTS "Update own org prompts" ON public.prompt_library;
DROP POLICY IF EXISTS "Users can manage their organization's prompts" ON public.prompt_library;

-- Keep only the simplified policies:
-- - "Authenticated users can view prompts"
-- - "Authenticated users can create prompts"
-- - "Authenticated users can update prompts"
-- - "Authenticated users can delete prompts"

-- =============================================
-- VERIFY CLEAN POLICY SETUP
-- =============================================

-- Check that we have the correct number of policies (4 per table + 1 for profiles)
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies 
WHERE tablename IN ('profiles', 'agent_library', 'prompt_library')
AND schemaname = 'public'
ORDER BY tablename, policyname;

-- Expected result: 9 policies total
-- - profiles: 1 policy ("Users can access their own profile")
-- - agent_library: 4 policies (SELECT, INSERT, UPDATE, DELETE)
-- - prompt_library: 4 policies (SELECT, INSERT, UPDATE, DELETE)

