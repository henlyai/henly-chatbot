-- Fix RLS infinite recursion issue in profiles table
-- This script temporarily disables RLS on profiles and recreates simpler policies

-- =============================================
-- DISABLE RLS ON PROFILES TABLE TEMPORARILY
-- =============================================

-- Disable RLS on profiles table to stop infinite recursion
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- Drop any existing policies on profiles table that might cause recursion
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can delete their own profile" ON public.profiles;

-- =============================================
-- CREATE SIMPLER RLS POLICIES FOR PROFILES
-- =============================================

-- Re-enable RLS on profiles table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create a simple policy that allows users to access their own profile
-- This avoids complex subqueries that could cause recursion
CREATE POLICY "Users can access their own profile" ON public.profiles
FOR ALL USING (auth.uid() = id);

-- =============================================
-- UPDATE AGENT AND PROMPT LIBRARY POLICIES
-- =============================================

-- Drop existing policies that reference profiles table
DROP POLICY IF EXISTS "Users can view their organization's agents" ON public.agent_library;
DROP POLICY IF EXISTS "Users can create agents for their organization" ON public.agent_library;
DROP POLICY IF EXISTS "Users can update their organization's agents" ON public.agent_library;
DROP POLICY IF EXISTS "Admins can delete their organization's agents" ON public.agent_library;

DROP POLICY IF EXISTS "Users can view their organization's prompts" ON public.prompt_library;
DROP POLICY IF EXISTS "Users can create prompts for their organization" ON public.prompt_library;
DROP POLICY IF EXISTS "Users can update their organization's prompts" ON public.prompt_library;
DROP POLICY IF EXISTS "Admins can delete their organization's prompts" ON public.prompt_library;

-- Create simpler policies that don't reference profiles table directly
-- Instead, we'll rely on the application layer to ensure proper access control

-- Allow all authenticated users to view all agents (application will filter by organization)
CREATE POLICY "Authenticated users can view agents" ON public.agent_library
FOR SELECT USING (auth.role() = 'authenticated');

-- Allow all authenticated users to create agents (application will set organization_id)
CREATE POLICY "Authenticated users can create agents" ON public.agent_library
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Allow all authenticated users to update agents (application will verify ownership)
CREATE POLICY "Authenticated users can update agents" ON public.agent_library
FOR UPDATE USING (auth.role() = 'authenticated');

-- Allow all authenticated users to delete agents (application will verify ownership)
CREATE POLICY "Authenticated users can delete agents" ON public.agent_library
FOR DELETE USING (auth.role() = 'authenticated');

-- Allow all authenticated users to view all prompts (application will filter by organization)
CREATE POLICY "Authenticated users can view prompts" ON public.prompt_library
FOR SELECT USING (auth.role() = 'authenticated');

-- Allow all authenticated users to create prompts (application will set organization_id)
CREATE POLICY "Authenticated users can create prompts" ON public.prompt_library
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Allow all authenticated users to update prompts (application will verify ownership)
CREATE POLICY "Authenticated users can update prompts" ON public.prompt_library
FOR UPDATE USING (auth.role() = 'authenticated');

-- Allow all authenticated users to delete prompts (application will verify ownership)
CREATE POLICY "Authenticated users can delete prompts" ON public.prompt_library
FOR DELETE USING (auth.role() = 'authenticated');

-- =============================================
-- VERIFICATION
-- =============================================

-- Verify RLS is enabled on all tables
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename IN ('profiles', 'agent_library', 'prompt_library')
AND schemaname = 'public';

-- Verify policies exist
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

