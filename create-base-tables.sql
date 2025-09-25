-- Create base agent_library and prompt_library tables for Henly AI
-- This script creates the foundational tables that the other scripts depend on

-- =============================================
-- CREATE AGENT_LIBRARY TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS public.agent_library (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    librechat_agent_id TEXT UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    avatar_url TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_default BOOLEAN DEFAULT false,
    sync_status TEXT DEFAULT 'pending', -- 'pending', 'synced', 'error'
    usage_count INTEGER DEFAULT 0,
    
    -- LibreChat-specific fields
    provider TEXT DEFAULT 'openai',
    model TEXT DEFAULT 'gpt-4-turbo-preview',
    instructions TEXT,
    tools TEXT[] DEFAULT ARRAY[]::TEXT[],
    model_parameters JSONB DEFAULT '{"temperature": 0.5, "max_tokens": 2000}',
    conversation_starters TEXT[] DEFAULT ARRAY[]::TEXT[],
    access_level INTEGER DEFAULT 1,
    recursion_limit INTEGER DEFAULT 25,
    artifacts TEXT DEFAULT 'auto',
    hide_sequential_outputs BOOLEAN DEFAULT false,
    end_after_tools BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    
    UNIQUE(organization_id, librechat_agent_id)
);

-- =============================================
-- CREATE PROMPT_LIBRARY TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS public.prompt_library (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    librechat_group_id TEXT UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    prompt_text TEXT NOT NULL,
    category TEXT NOT NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_default BOOLEAN DEFAULT false,
    sync_status TEXT DEFAULT 'pending', -- 'pending', 'synced', 'error'
    usage_count INTEGER DEFAULT 0,
    
    -- LibreChat-specific fields
    type TEXT DEFAULT 'text',
    variables TEXT[] DEFAULT ARRAY[]::TEXT[],
    is_active BOOLEAN DEFAULT true,
    
    UNIQUE(organization_id, librechat_group_id)
);

-- =============================================
-- CREATE INDEXES FOR PERFORMANCE
-- =============================================

-- Agent library indexes
CREATE INDEX IF NOT EXISTS idx_agent_library_organization_id ON public.agent_library(organization_id);
CREATE INDEX IF NOT EXISTS idx_agent_library_category ON public.agent_library(category);
CREATE INDEX IF NOT EXISTS idx_agent_library_is_default ON public.agent_library(is_default);
CREATE INDEX IF NOT EXISTS idx_agent_library_is_active ON public.agent_library(is_active);
CREATE INDEX IF NOT EXISTS idx_agent_library_provider ON public.agent_library(provider);
CREATE INDEX IF NOT EXISTS idx_agent_library_model ON public.agent_library(model);
CREATE INDEX IF NOT EXISTS idx_agent_library_created_by ON public.agent_library(created_by);

-- Prompt library indexes
CREATE INDEX IF NOT EXISTS idx_prompt_library_organization_id ON public.prompt_library(organization_id);
CREATE INDEX IF NOT EXISTS idx_prompt_library_category ON public.prompt_library(category);
CREATE INDEX IF NOT EXISTS idx_prompt_library_is_default ON public.prompt_library(is_default);
CREATE INDEX IF NOT EXISTS idx_prompt_library_is_active ON public.prompt_library(is_active);
CREATE INDEX IF NOT EXISTS idx_prompt_library_type ON public.prompt_library(type);
CREATE INDEX IF NOT EXISTS idx_prompt_library_created_by ON public.prompt_library(created_by);

-- =============================================
-- ENABLE ROW LEVEL SECURITY
-- =============================================

-- Enable RLS on agent_library
ALTER TABLE public.agent_library ENABLE ROW LEVEL SECURITY;

-- Enable RLS on prompt_library
ALTER TABLE public.prompt_library ENABLE ROW LEVEL SECURITY;

-- =============================================
-- CREATE RLS POLICIES FOR AGENT_LIBRARY
-- =============================================

-- Users can view agents from their organization
CREATE POLICY "Users can view their organization's agents" ON public.agent_library
FOR SELECT USING (
    organization_id = (
        SELECT organization_id 
        FROM public.profiles 
        WHERE id = auth.uid()
    )
);

-- Users can insert agents for their organization
CREATE POLICY "Users can create agents for their organization" ON public.agent_library
FOR INSERT WITH CHECK (
    organization_id = (
        SELECT organization_id 
        FROM public.profiles 
        WHERE id = auth.uid()
    )
);

-- Users can update agents from their organization
CREATE POLICY "Users can update their organization's agents" ON public.agent_library
FOR UPDATE USING (
    organization_id = (
        SELECT organization_id 
        FROM public.profiles 
        WHERE id = auth.uid()
    )
);

-- Admins can delete agents from their organization
CREATE POLICY "Admins can delete their organization's agents" ON public.agent_library
FOR DELETE USING (
    organization_id = (
        SELECT organization_id 
        FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'super_admin')
    )
);

-- =============================================
-- CREATE RLS POLICIES FOR PROMPT_LIBRARY
-- =============================================

-- Users can view prompts from their organization
CREATE POLICY "Users can view their organization's prompts" ON public.prompt_library
FOR SELECT USING (
    organization_id = (
        SELECT organization_id 
        FROM public.profiles 
        WHERE id = auth.uid()
    )
);

-- Users can insert prompts for their organization
CREATE POLICY "Users can create prompts for their organization" ON public.prompt_library
FOR INSERT WITH CHECK (
    organization_id = (
        SELECT organization_id 
        FROM public.profiles 
        WHERE id = auth.uid()
    )
);

-- Users can update prompts from their organization
CREATE POLICY "Users can update their organization's prompts" ON public.prompt_library
FOR UPDATE USING (
    organization_id = (
        SELECT organization_id 
        FROM public.profiles 
        WHERE id = auth.uid()
    )
);

-- Admins can delete prompts from their organization
CREATE POLICY "Admins can delete their organization's prompts" ON public.prompt_library
FOR DELETE USING (
    organization_id = (
        SELECT organization_id 
        FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'super_admin')
    )
);

-- =============================================
-- CREATE TRIGGERS FOR UPDATED_AT
-- =============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for agent_library updated_at
DROP TRIGGER IF EXISTS trigger_agent_library_updated_at ON public.agent_library;
CREATE TRIGGER trigger_agent_library_updated_at
    BEFORE UPDATE ON public.agent_library
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for prompt_library updated_at
DROP TRIGGER IF EXISTS trigger_prompt_library_updated_at ON public.prompt_library;
CREATE TRIGGER trigger_prompt_library_updated_at
    BEFORE UPDATE ON public.prompt_library
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- VERIFICATION QUERIES
-- =============================================

-- Verify tables were created
SELECT 
    'agent_library' as table_name,
    COUNT(*) as column_count
FROM information_schema.columns 
WHERE table_name = 'agent_library' 
AND table_schema = 'public'

UNION ALL

SELECT 
    'prompt_library' as table_name,
    COUNT(*) as column_count
FROM information_schema.columns 
WHERE table_name = 'prompt_library' 
AND table_schema = 'public';

-- Verify RLS is enabled
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename IN ('agent_library', 'prompt_library')
AND schemaname = 'public';

-- Verify policies exist
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE tablename IN ('agent_library', 'prompt_library')
AND schemaname = 'public'
ORDER BY tablename, policyname;
