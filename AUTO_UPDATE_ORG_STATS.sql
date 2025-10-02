-- =============================================
-- AUTOMATIC ORGANIZATION STATISTICS UPDATES
-- =============================================
-- This script creates triggers to automatically update organization statistics
-- whenever profiles or invitations change

-- 1. CREATE FUNCTION TO UPDATE ORGANIZATION STATS
-- =============================================
CREATE OR REPLACE FUNCTION update_organization_stats()
RETURNS TRIGGER AS $$
DECLARE
    org_id UUID;
BEGIN
    -- Get organization ID from the changed record
    IF TG_TABLE_NAME = 'profiles' THEN
        org_id := COALESCE(NEW.organization_id, OLD.organization_id);
    ELSIF TG_TABLE_NAME = 'invitations' THEN
        org_id := COALESCE(NEW.organization_id, OLD.organization_id);
    END IF;
    
    -- Update organization statistics
    UPDATE organizations 
    SET 
        total_members = (
            SELECT COUNT(*) 
            FROM profiles 
            WHERE organization_id = org_id
        ),
        active_members = (
            SELECT COUNT(*) 
            FROM profiles 
            WHERE organization_id = org_id 
            AND is_active = true
        ),
        pending_members = (
            SELECT COUNT(*) 
            FROM profiles 
            WHERE organization_id = org_id 
            AND status = 'pending'
        ),
        invited_members = (
            SELECT COUNT(*) 
            FROM profiles 
            WHERE organization_id = org_id 
            AND invitation_status = 'accepted'
        ),
        admin_count = (
            SELECT COUNT(*) 
            FROM profiles 
            WHERE organization_id = org_id 
            AND role = 'admin'
        ),
        super_admin_count = (
            SELECT COUNT(*) 
            FROM profiles 
            WHERE organization_id = org_id 
            AND role = 'super_admin'
        ),
        pending_invitations = (
            SELECT COUNT(*) 
            FROM invitations 
            WHERE organization_id = org_id 
            AND status = 'pending'
        ),
        accepted_invitations = (
            SELECT COUNT(*) 
            FROM invitations 
            WHERE organization_id = org_id 
            AND status = 'accepted'
        ),
        last_member_activity = (
            SELECT MAX(last_activity_at) 
            FROM profiles 
            WHERE organization_id = org_id
        ),
        organization_health = CASE 
            WHEN (
                SELECT COUNT(*) 
                FROM profiles 
                WHERE organization_id = org_id 
                AND is_active = true
            ) > 0 THEN 'healthy'
            ELSE 'inactive'
        END,
        updated_at = NOW()
    WHERE id = org_id;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 2. CREATE TRIGGERS FOR PROFILES TABLE
-- =============================================

-- Trigger for INSERT on profiles
CREATE OR REPLACE TRIGGER trigger_profiles_insert
    AFTER INSERT ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_organization_stats();

-- Trigger for UPDATE on profiles
CREATE OR REPLACE TRIGGER trigger_profiles_update
    AFTER UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_organization_stats();

-- Trigger for DELETE on profiles
CREATE OR REPLACE TRIGGER trigger_profiles_delete
    AFTER DELETE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_organization_stats();

-- 3. CREATE TRIGGERS FOR INVITATIONS TABLE
-- =============================================

-- Trigger for INSERT on invitations
CREATE OR REPLACE TRIGGER trigger_invitations_insert
    AFTER INSERT ON invitations
    FOR EACH ROW
    EXECUTE FUNCTION update_organization_stats();

-- Trigger for UPDATE on invitations
CREATE OR REPLACE TRIGGER trigger_invitations_update
    AFTER UPDATE ON invitations
    FOR EACH ROW
    EXECUTE FUNCTION update_organization_stats();

-- Trigger for DELETE on invitations
CREATE OR REPLACE TRIGGER trigger_invitations_delete
    AFTER DELETE ON invitations
    FOR EACH ROW
    EXECUTE FUNCTION update_organization_stats();

-- 4. INITIAL STATISTICS UPDATE
-- =============================================
-- Update all existing organizations with current statistics

UPDATE organizations 
SET 
    total_members = (
        SELECT COUNT(*) 
        FROM profiles 
        WHERE organization_id = organizations.id
    ),
    active_members = (
        SELECT COUNT(*) 
        FROM profiles 
        WHERE organization_id = organizations.id 
        AND is_active = true
    ),
    pending_members = (
        SELECT COUNT(*) 
        FROM profiles 
        WHERE organization_id = organizations.id 
        AND status = 'pending'
    ),
    invited_members = (
        SELECT COUNT(*) 
        FROM profiles 
        WHERE organization_id = organizations.id 
        AND invitation_status = 'accepted'
    ),
    admin_count = (
        SELECT COUNT(*) 
        FROM profiles 
        WHERE organization_id = organizations.id 
        AND role = 'admin'
    ),
    super_admin_count = (
        SELECT COUNT(*) 
        FROM profiles 
        WHERE organization_id = organizations.id 
        AND role = 'super_admin'
    ),
    pending_invitations = (
        SELECT COUNT(*) 
        FROM invitations 
        WHERE organization_id = organizations.id 
        AND status = 'pending'
    ),
    accepted_invitations = (
        SELECT COUNT(*) 
        FROM invitations 
        WHERE organization_id = organizations.id 
        AND status = 'accepted'
    ),
    last_member_activity = (
        SELECT MAX(last_activity_at) 
        FROM profiles 
        WHERE organization_id = organizations.id
    ),
    organization_health = CASE 
        WHEN (
            SELECT COUNT(*) 
            FROM profiles 
            WHERE organization_id = organizations.id 
            AND is_active = true
        ) > 0 THEN 'healthy'
        ELSE 'inactive'
    END,
    updated_at = NOW();

-- 5. VERIFY TRIGGERS ARE WORKING
-- =============================================

-- Test by checking current statistics
SELECT 
    name,
    total_members,
    active_members,
    admin_count,
    super_admin_count,
    pending_invitations,
    organization_health
FROM organizations
ORDER BY name;

-- 6. SUCCESS MESSAGE
-- =============================================
SELECT 
    'Automatic organization statistics updates enabled!' as status,
    'Statistics will now update automatically when users join/leave or invitations change' as description,
    'No more manual updates needed!' as note;
