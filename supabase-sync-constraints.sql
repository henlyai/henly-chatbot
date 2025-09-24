-- Add unique constraints for LibreChat sync functionality
-- This ensures proper upsert behavior when syncing from LibreChat to Supabase

-- =============================================
-- AGENT LIBRARY CONSTRAINTS
-- =============================================

-- Add unique constraint for organization + librechat_agent_id
-- This prevents duplicate agents from the same LibreChat instance
ALTER TABLE public.agent_library 
DROP CONSTRAINT IF EXISTS unique_org_librechat_agent;

ALTER TABLE public.agent_library 
ADD CONSTRAINT unique_org_librechat_agent 
UNIQUE (organization_id, librechat_agent_id);

-- Add index for better performance on sync operations
CREATE INDEX IF NOT EXISTS idx_agent_library_librechat_agent_id 
ON public.agent_library(librechat_agent_id);

CREATE INDEX IF NOT EXISTS idx_agent_library_sync_status 
ON public.agent_library(sync_status);

-- =============================================
-- PROMPT LIBRARY CONSTRAINTS
-- =============================================

-- Add unique constraint for organization + librechat_group_id
-- This prevents duplicate prompts from the same LibreChat instance
ALTER TABLE public.prompt_library 
DROP CONSTRAINT IF EXISTS unique_org_librechat_prompt;

ALTER TABLE public.prompt_library 
ADD CONSTRAINT unique_org_librechat_prompt 
UNIQUE (organization_id, librechat_group_id);

-- Add index for better performance on sync operations
CREATE INDEX IF NOT EXISTS idx_prompt_library_librechat_group_id 
ON public.prompt_library(librechat_group_id);

CREATE INDEX IF NOT EXISTS idx_prompt_library_sync_status 
ON public.prompt_library(sync_status);

-- =============================================
-- SYNC TRACKING FUNCTIONS
-- =============================================

-- Function to track when agents are synced from LibreChat
CREATE OR REPLACE FUNCTION track_agent_sync()
RETURNS TRIGGER AS $$
BEGIN
    -- Update sync timestamp when agent is modified
    NEW.updated_at = NOW();
    
    -- Log sync activity
    RAISE LOG 'Agent sync: % for organization %', NEW.name, NEW.organization_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to track when prompts are synced from LibreChat
CREATE OR REPLACE FUNCTION track_prompt_sync()
RETURNS TRIGGER AS $$
BEGIN
    -- Update sync timestamp when prompt is modified
    NEW.updated_at = NOW();
    
    -- Log sync activity
    RAISE LOG 'Prompt sync: % for organization %', NEW.name, NEW.organization_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for sync tracking
DROP TRIGGER IF EXISTS trigger_track_agent_sync ON public.agent_library;
CREATE TRIGGER trigger_track_agent_sync
    BEFORE INSERT OR UPDATE ON public.agent_library
    FOR EACH ROW
    EXECUTE FUNCTION track_agent_sync();

DROP TRIGGER IF EXISTS trigger_track_prompt_sync ON public.prompt_library;
CREATE TRIGGER trigger_track_prompt_sync
    BEFORE INSERT OR UPDATE ON public.prompt_library
    FOR EACH ROW
    EXECUTE FUNCTION track_prompt_sync();

-- =============================================
-- USAGE TRACKING ENHANCEMENTS
-- =============================================

-- Enhanced function to increment agent usage with better error handling
CREATE OR REPLACE FUNCTION increment_agent_usage(agent_id UUID, org_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE public.agent_library 
    SET usage_count = COALESCE(usage_count, 0) + 1,
        updated_at = NOW()
    WHERE id = agent_id AND organization_id = org_id;
    
    -- Log if no rows were updated (agent not found)
    IF NOT FOUND THEN
        RAISE LOG 'Agent usage increment failed: agent % not found for organization %', agent_id, org_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Enhanced function to increment prompt usage with better error handling
CREATE OR REPLACE FUNCTION increment_prompt_usage(prompt_id UUID, org_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE public.prompt_library 
    SET usage_count = COALESCE(usage_count, 0) + 1,
        updated_at = NOW()
    WHERE id = prompt_id AND organization_id = org_id;
    
    -- Log if no rows were updated (prompt not found)
    IF NOT FOUND THEN
        RAISE LOG 'Prompt usage increment failed: prompt % not found for organization %', prompt_id, org_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- CLEANUP FUNCTIONS
-- =============================================

-- Function to clean up orphaned agents (LibreChat agents that no longer exist)
CREATE OR REPLACE FUNCTION cleanup_orphaned_agents()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- This function can be enhanced to check against actual LibreChat database
    -- For now, it just cleans up agents marked for deletion
    DELETE FROM public.agent_library 
    WHERE sync_status = 'deleted' AND updated_at < NOW() - INTERVAL '7 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RAISE LOG 'Cleaned up % orphaned agents', deleted_count;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up orphaned prompts
CREATE OR REPLACE FUNCTION cleanup_orphaned_prompts()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Similar cleanup for prompts
    DELETE FROM public.prompt_library 
    WHERE sync_status = 'deleted' AND updated_at < NOW() - INTERVAL '7 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RAISE LOG 'Cleaned up % orphaned prompts', deleted_count;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- VERIFICATION QUERIES
-- =============================================

-- View to see sync status across all organizations
CREATE OR REPLACE VIEW organization_sync_status AS
SELECT 
    o.name as organization_name,
    o.id as organization_id,
    COUNT(al.id) as total_agents,
    COUNT(CASE WHEN al.sync_status = 'synced' THEN 1 END) as synced_agents,
    COUNT(CASE WHEN al.sync_status = 'pending' THEN 1 END) as pending_agents,
    COUNT(pl.id) as total_prompts,
    COUNT(CASE WHEN pl.sync_status = 'synced' THEN 1 END) as synced_prompts,
    COUNT(CASE WHEN pl.sync_status = 'pending' THEN 1 END) as pending_prompts,
    MAX(al.updated_at) as last_agent_sync,
    MAX(pl.updated_at) as last_prompt_sync
FROM public.organizations o
LEFT JOIN public.agent_library al ON o.id = al.organization_id
LEFT JOIN public.prompt_library pl ON o.id = pl.organization_id
GROUP BY o.id, o.name
ORDER BY o.name;

-- Grant access to the view
GRANT SELECT ON organization_sync_status TO authenticated;
