-- =============================================
-- FIX ORGANIZATION STATISTICS
-- =============================================
-- This script recalculates and updates all organization statistics

-- 1. UPDATE HENLY AI ORGANIZATION STATISTICS
-- =============================================
UPDATE organizations 
SET 
  total_members = (
    SELECT COUNT(*) 
    FROM profiles 
    WHERE organization_id = 'ad82fce8-ba9a-438f-9fe2-956a86f479a5'
  ),
  active_members = (
    SELECT COUNT(*) 
    FROM profiles 
    WHERE organization_id = 'ad82fce8-ba9a-438f-9fe2-956a86f479a5' 
    AND is_active = true
  ),
  pending_members = (
    SELECT COUNT(*) 
    FROM profiles 
    WHERE organization_id = 'ad82fce8-ba9a-438f-9fe2-956a86f479a5' 
    AND status = 'pending'
  ),
  invited_members = (
    SELECT COUNT(*) 
    FROM profiles 
    WHERE organization_id = 'ad82fce8-ba9a-438f-9fe2-956a86f479a5' 
    AND invitation_status = 'accepted'
  ),
  admin_count = (
    SELECT COUNT(*) 
    FROM profiles 
    WHERE organization_id = 'ad82fce8-ba9a-438f-9fe2-956a86f479a5' 
    AND role = 'admin'
  ),
  super_admin_count = (
    SELECT COUNT(*) 
    FROM profiles 
    WHERE organization_id = 'ad82fce8-ba9a-438f-9fe2-956a86f479a5' 
    AND role = 'super_admin'
  ),
  pending_invitations = (
    SELECT COUNT(*) 
    FROM invitations 
    WHERE organization_id = 'ad82fce8-ba9a-438f-9fe2-956a86f479a5' 
    AND status = 'pending'
  ),
  accepted_invitations = (
    SELECT COUNT(*) 
    FROM invitations 
    WHERE organization_id = 'ad82fce8-ba9a-438f-9fe2-956a86f479a5' 
    AND status = 'accepted'
  ),
  last_member_activity = (
    SELECT MAX(last_activity_at) 
    FROM profiles 
    WHERE organization_id = 'ad82fce8-ba9a-438f-9fe2-956a86f479a5'
  ),
  organization_health = CASE 
    WHEN (
      SELECT COUNT(*) 
      FROM profiles 
      WHERE organization_id = 'ad82fce8-ba9a-438f-9fe2-956a86f479a5' 
      AND is_active = true
    ) > 0 THEN 'healthy'
    ELSE 'inactive'
  END
WHERE id = 'ad82fce8-ba9a-438f-9fe2-956a86f479a5';

-- 2. UPDATE TOFINO ORGANIZATION STATISTICS
-- =============================================
UPDATE organizations 
SET 
  total_members = (
    SELECT COUNT(*) 
    FROM profiles 
    WHERE organization_id = '681dec0c-eb2a-4457-bc59-818ef658d282'
  ),
  active_members = (
    SELECT COUNT(*) 
    FROM profiles 
    WHERE organization_id = '681dec0c-eb2a-4457-bc59-818ef658d282' 
    AND is_active = true
  ),
  pending_members = (
    SELECT COUNT(*) 
    FROM profiles 
    WHERE organization_id = '681dec0c-eb2a-4457-bc59-818ef658d282' 
    AND status = 'pending'
  ),
  invited_members = (
    SELECT COUNT(*) 
    FROM profiles 
    WHERE organization_id = '681dec0c-eb2a-4457-bc59-818ef658d282' 
    AND invitation_status = 'accepted'
  ),
  admin_count = (
    SELECT COUNT(*) 
    FROM profiles 
    WHERE organization_id = '681dec0c-eb2a-4457-bc59-818ef658d282' 
    AND role = 'admin'
  ),
  super_admin_count = (
    SELECT COUNT(*) 
    FROM profiles 
    WHERE organization_id = '681dec0c-eb2a-4457-bc59-818ef658d282' 
    AND role = 'super_admin'
  ),
  pending_invitations = (
    SELECT COUNT(*) 
    FROM invitations 
    WHERE organization_id = '681dec0c-eb2a-4457-bc59-818ef658d282' 
    AND status = 'pending'
  ),
  accepted_invitations = (
    SELECT COUNT(*) 
    FROM invitations 
    WHERE organization_id = '681dec0c-eb2a-4457-bc59-818ef658d282' 
    AND status = 'accepted'
  ),
  last_member_activity = (
    SELECT MAX(last_activity_at) 
    FROM profiles 
    WHERE organization_id = '681dec0c-eb2a-4457-bc59-818ef658d282'
  ),
  organization_health = CASE 
    WHEN (
      SELECT COUNT(*) 
      FROM profiles 
      WHERE organization_id = '681dec0c-eb2a-4457-bc59-818ef658d282' 
      AND is_active = true
    ) > 0 THEN 'healthy'
    ELSE 'inactive'
  END
WHERE id = '681dec0c-eb2a-4457-bc59-818ef658d282';

-- 3. VERIFY THE UPDATES
-- =============================================

-- Show updated organization statistics
SELECT 
  name,
  total_members,
  active_members,
  pending_members,
  invited_members,
  admin_count,
  super_admin_count,
  pending_invitations,
  accepted_invitations,
  organization_health,
  last_member_activity
FROM organizations
ORDER BY name;

-- Show detailed breakdown for verification
SELECT 
  'Henly AI Organization' as org_name,
  (SELECT COUNT(*) FROM profiles WHERE organization_id = 'ad82fce8-ba9a-438f-9fe2-956a86f479a5') as total_profiles,
  (SELECT COUNT(*) FROM profiles WHERE organization_id = 'ad82fce8-ba9a-438f-9fe2-956a86f479a5' AND is_active = true) as active_profiles,
  (SELECT COUNT(*) FROM profiles WHERE organization_id = 'ad82fce8-ba9a-438f-9fe2-956a86f479a5' AND role = 'admin') as admin_profiles,
  (SELECT COUNT(*) FROM profiles WHERE organization_id = 'ad82fce8-ba9a-438f-9fe2-956a86f479a5' AND role = 'super_admin') as super_admin_profiles,
  (SELECT COUNT(*) FROM invitations WHERE organization_id = 'ad82fce8-ba9a-438f-9fe2-956a86f479a5' AND status = 'pending') as pending_invites,
  (SELECT COUNT(*) FROM invitations WHERE organization_id = 'ad82fce8-ba9a-438f-9fe2-956a86f479a5' AND status = 'accepted') as accepted_invites

UNION ALL

SELECT 
  'Tofino Organization' as org_name,
  (SELECT COUNT(*) FROM profiles WHERE organization_id = '681dec0c-eb2a-4457-bc59-818ef658d282') as total_profiles,
  (SELECT COUNT(*) FROM profiles WHERE organization_id = '681dec0c-eb2a-4457-bc59-818ef658d282' AND is_active = true) as active_profiles,
  (SELECT COUNT(*) FROM profiles WHERE organization_id = '681dec0c-eb2a-4457-bc59-818ef658d282' AND role = 'admin') as admin_profiles,
  (SELECT COUNT(*) FROM profiles WHERE organization_id = '681dec0c-eb2a-4457-bc59-818ef658d282' AND role = 'super_admin') as super_admin_profiles,
  (SELECT COUNT(*) FROM invitations WHERE organization_id = '681dec0c-eb2a-4457-bc59-818ef658d282' AND status = 'pending') as pending_invites,
  (SELECT COUNT(*) FROM invitations WHERE organization_id = '681dec0c-eb2a-4457-bc59-818ef658d282' AND status = 'accepted') as accepted_invites;

-- 4. SUCCESS MESSAGE
-- =============================================
SELECT 
  'Organization statistics updated successfully!' as status,
  'All member counts, admin counts, and invitation counts are now accurate' as description;
