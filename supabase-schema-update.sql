-- Update Supabase schema to include LibreChat-specific fields
-- This ensures agents and prompts have all the configuration LibreChat needs

-- =============================================
-- UPDATE AGENT_LIBRARY TABLE
-- =============================================

-- Add LibreChat-specific columns to agent_library
ALTER TABLE public.agent_library 
ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'openai',
ADD COLUMN IF NOT EXISTS model TEXT DEFAULT 'gpt-4-turbo-preview',
ADD COLUMN IF NOT EXISTS instructions TEXT,
ADD COLUMN IF NOT EXISTS tools TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS model_parameters JSONB DEFAULT '{"temperature": 0.5, "max_tokens": 2000}',
ADD COLUMN IF NOT EXISTS conversation_starters TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS access_level INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS recursion_limit INTEGER DEFAULT 25,
ADD COLUMN IF NOT EXISTS artifacts TEXT DEFAULT 'auto',
ADD COLUMN IF NOT EXISTS hide_sequential_outputs BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS end_after_tools BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_agent_library_provider ON public.agent_library(provider);
CREATE INDEX IF NOT EXISTS idx_agent_library_model ON public.agent_library(model);
CREATE INDEX IF NOT EXISTS idx_agent_library_is_active ON public.agent_library(is_active);

-- =============================================
-- UPDATE PROMPT_LIBRARY TABLE  
-- =============================================

-- Add LibreChat-specific columns to prompt_library
ALTER TABLE public.prompt_library
ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'text',
ADD COLUMN IF NOT EXISTS variables TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Add indexes for better performance  
CREATE INDEX IF NOT EXISTS idx_prompt_library_type ON public.prompt_library(type);
CREATE INDEX IF NOT EXISTS idx_prompt_library_is_active ON public.prompt_library(is_active);

-- =============================================
-- CREATE MODEL CONFIGURATIONS TABLE
-- =============================================

-- Table to manage available models per organization
CREATE TABLE IF NOT EXISTS public.organization_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    provider TEXT NOT NULL, -- 'openai', 'anthropic', 'google', etc.
    model_name TEXT NOT NULL, -- 'gpt-4-turbo-preview', 'claude-3-sonnet-20240229', etc.
    display_name TEXT NOT NULL, -- Human-readable name
    is_enabled BOOLEAN DEFAULT true,
    default_parameters JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(organization_id, provider, model_name)
);

-- RLS for organization_models
ALTER TABLE public.organization_models ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their organization's models" ON public.organization_models
FOR SELECT USING (
    organization_id = (
        SELECT organization_id 
        FROM public.profiles 
        WHERE id = auth.uid()
    )
);

CREATE POLICY "Admins can manage their organization's models" ON public.organization_models
FOR ALL USING (
    organization_id = (
        SELECT organization_id 
        FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'super_admin')
    )
);

-- =============================================
-- CREATE TOOL CONFIGURATIONS TABLE
-- =============================================

-- Table to manage available tools/MCPs per organization
CREATE TABLE IF NOT EXISTS public.organization_tools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    tool_name TEXT NOT NULL, -- 'Google Drive', 'HubSpot', 'Slack', etc.
    tool_type TEXT NOT NULL, -- 'mcp', 'builtin', 'custom'
    display_name TEXT NOT NULL,
    description TEXT,
    endpoint_url TEXT, -- For MCP tools
    capabilities TEXT[] DEFAULT ARRAY[]::TEXT[],
    is_enabled BOOLEAN DEFAULT true,
    configuration JSONB DEFAULT '{}', -- Tool-specific config
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(organization_id, tool_name)
);

-- RLS for organization_tools
ALTER TABLE public.organization_tools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their organization's tools" ON public.organization_tools
FOR SELECT USING (
    organization_id = (
        SELECT organization_id 
        FROM public.profiles 
        WHERE id = auth.uid()
    )
);

CREATE POLICY "Admins can manage their organization's tools" ON public.organization_tools
FOR ALL USING (
    organization_id = (
        SELECT organization_id 
        FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('admin', 'super_admin')
    )
);

-- =============================================
-- INSERT DEFAULT MODELS FOR ORGANIZATIONS
-- =============================================

-- Function to insert default models for an organization
CREATE OR REPLACE FUNCTION insert_default_models(org_id UUID)
RETURNS void AS $$
BEGIN
    INSERT INTO public.organization_models (organization_id, provider, model_name, display_name, default_parameters)
    VALUES 
    -- OpenAI Models
    (org_id, 'openai', 'gpt-4-turbo-preview', 'GPT-4 Turbo', '{"temperature": 0.5, "max_tokens": 2000}'),
    (org_id, 'openai', 'gpt-4', 'GPT-4', '{"temperature": 0.5, "max_tokens": 2000}'),
    (org_id, 'openai', 'gpt-3.5-turbo', 'GPT-3.5 Turbo', '{"temperature": 0.5, "max_tokens": 2000}'),
    
    -- Anthropic Models
    (org_id, 'anthropic', 'claude-3-sonnet-20240229', 'Claude 3 Sonnet', '{"temperature": 0.5, "max_tokens": 2000}'),
    (org_id, 'anthropic', 'claude-3-haiku-20240307', 'Claude 3 Haiku', '{"temperature": 0.5, "max_tokens": 2000}'),
    (org_id, 'anthropic', 'claude-3-opus-20240229', 'Claude 3 Opus', '{"temperature": 0.5, "max_tokens": 2000}')
    
    ON CONFLICT (organization_id, provider, model_name) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- INSERT DEFAULT TOOLS FOR ORGANIZATIONS  
-- =============================================

-- Function to insert default tools for an organization
CREATE OR REPLACE FUNCTION insert_default_tools(org_id UUID)
RETURNS void AS $$
BEGIN
    INSERT INTO public.organization_tools (organization_id, tool_name, tool_type, display_name, description, capabilities)
    VALUES 
    -- Core MCP Tools
    (org_id, 'Google Drive', 'mcp', 'Google Drive', 'Access and manage Google Drive files', ARRAY['file_read', 'file_write', 'file_search']),
    (org_id, 'Slack', 'mcp', 'Slack Integration', 'Send messages and interact with Slack', ARRAY['message_send', 'channel_list', 'user_list']),
    (org_id, 'Microsoft 365', 'mcp', 'Microsoft 365', 'Access Office documents and services', ARRAY['file_read', 'file_write', 'calendar']),
    
    -- Sales & Marketing Tools
    (org_id, 'HubSpot', 'mcp', 'HubSpot CRM', 'Manage contacts, deals, and sales pipeline', ARRAY['contact_read', 'contact_write', 'deal_read']),
    (org_id, 'SalesForce', 'mcp', 'Salesforce CRM', 'Access Salesforce data and automation', ARRAY['contact_read', 'opportunity_read', 'lead_read']),
    
    -- Support Tools
    (org_id, 'Zendesk', 'mcp', 'Zendesk Support', 'Manage support tickets and customer interactions', ARRAY['ticket_read', 'ticket_write', 'customer_read']),
    (org_id, 'Intercom', 'mcp', 'Intercom', 'Customer messaging and support', ARRAY['message_send', 'conversation_read', 'user_read']),
    
    -- Data & Analytics
    (org_id, 'BigQuery', 'mcp', 'Google BigQuery', 'Query and analyze large datasets', ARRAY['query_execute', 'dataset_read', 'table_read']),
    
    -- Operations
    (org_id, 'FlowForma', 'mcp', 'FlowForma BPM', 'Business process management and workflows', ARRAY['workflow_read', 'task_read', 'process_start'])
    
    ON CONFLICT (organization_id, tool_name) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- UPDATE EXISTING ORGANIZATIONS
-- =============================================

-- Add default models and tools to existing organizations
DO $$
DECLARE
    org RECORD;
BEGIN
    FOR org IN SELECT id FROM public.organizations LOOP
        PERFORM insert_default_models(org.id);
        PERFORM insert_default_tools(org.id);
    END LOOP;
END $$;

-- =============================================
-- CREATE TRIGGERS FOR NEW ORGANIZATIONS
-- =============================================

-- Trigger function to add default models/tools when new organization is created
CREATE OR REPLACE FUNCTION setup_new_organization()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM insert_default_models(NEW.id);
    PERFORM insert_default_tools(NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_setup_new_organization ON public.organizations;
CREATE TRIGGER trigger_setup_new_organization
    AFTER INSERT ON public.organizations
    FOR EACH ROW
    EXECUTE FUNCTION setup_new_organization();

-- =============================================
-- UPDATE FUNCTIONS FOR USAGE TRACKING
-- =============================================

-- Function to increment agent usage
CREATE OR REPLACE FUNCTION increment_agent_usage(agent_id UUID, org_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE public.agent_library 
    SET usage_count = COALESCE(usage_count, 0) + 1,
        updated_at = NOW()
    WHERE id = agent_id AND organization_id = org_id;
END;
$$ LANGUAGE plpgsql;

-- Function to increment prompt usage (already exists, but ensuring it's here)
CREATE OR REPLACE FUNCTION increment_prompt_usage(prompt_id UUID, org_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE public.prompt_library 
    SET usage_count = COALESCE(usage_count, 0) + 1,
        updated_at = NOW()
    WHERE id = prompt_id AND organization_id = org_id;
END;
$$ LANGUAGE plpgsql;
