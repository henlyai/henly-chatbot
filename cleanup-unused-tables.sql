-- Cleanup unused tables from Henly AI schema
-- These tables were created but never used in the application

-- =============================================
-- DROP UNUSED TABLES
-- =============================================

-- Drop organization_models table (not used anywhere in code)
DROP TABLE IF EXISTS public.organization_models CASCADE;

-- Drop organization_tools table (not used anywhere in code)  
DROP TABLE IF EXISTS public.organization_tools CASCADE;

-- =============================================
-- DROP ASSOCIATED FUNCTIONS
-- =============================================

-- Drop the functions that were created for these tables
DROP FUNCTION IF EXISTS insert_default_models(UUID);
DROP FUNCTION IF EXISTS insert_default_tools(UUID);

-- =============================================
-- VERIFICATION
-- =============================================

-- Verify the tables are gone
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('organization_models', 'organization_tools');

-- Should return no rows if cleanup was successful
