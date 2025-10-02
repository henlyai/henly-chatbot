# 🧪 SECURITY TESTING GUIDE

## Critical Security Tests for Multi-Tenant Platform

**MANDATORY TESTING** before production deployment to ensure data isolation and security.

## 🚨 Test 1: Data Isolation Between Organizations

### Test Script
```sql
-- Create test organizations and users
INSERT INTO organizations (name, slug) VALUES 
  ('Test Org A', 'test-org-a'),
  ('Test Org B', 'test-org-b');

INSERT INTO profiles (id, organization_id, email, role) VALUES 
  ('00000000-0000-0000-0000-000000000001', 
   (SELECT id FROM organizations WHERE slug = 'test-org-a'), 
   'user-a@test.com', 'user'),
  ('00000000-0000-0000-0000-000000000002', 
   (SELECT id FROM organizations WHERE slug = 'test-org-b'), 
   'user-b@test.com', 'user');

-- Test data isolation
SET ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub": "00000000-0000-0000-0000-000000000001"}';

-- This should ONLY return data for Test Org A
SELECT * FROM agent_library;
SELECT * FROM prompt_library;
SELECT * FROM mcp_servers;
SELECT * FROM knowledge_bases;

-- Switch to user B
SET LOCAL "request.jwt.claims" TO '{"sub": "00000000-0000-0000-0000-000000000002"}';

-- This should ONLY return data for Test Org B
SELECT * FROM agent_library;
SELECT * FROM prompt_library;
SELECT * FROM mcp_servers;
SELECT * FROM knowledge_bases;

RESET ROLE;
```

### Expected Results
- ✅ User A can only see Test Org A data
- ✅ User B can only see Test Org B data
- ✅ No cross-organization data access

## 🚨 Test 2: Authentication Requirements

### Test Script
```bash
#!/bin/bash

# Test 1: Unauthenticated access should fail
echo "Testing unauthenticated access..."
curl -X GET https://your-app.railway.app/api/config
# Expected: 401 Unauthorized

# Test 2: Invalid token should fail
echo "Testing invalid token..."
curl -X GET https://your-app.railway.app/api/config \
  -H "Authorization: Bearer invalid-token"
# Expected: 401 Unauthorized

# Test 3: Valid token without organization should fail
echo "Testing token without organization..."
curl -X GET https://your-app.railway.app/api/config \
  -H "Authorization: Bearer valid-token-without-org"
# Expected: 403 Forbidden

# Test 4: Valid token with organization should succeed
echo "Testing valid authentication..."
curl -X GET https://your-app.railway.app/api/config \
  -H "Authorization: Bearer valid-token-with-org"
# Expected: 200 OK with organization-specific config
```

### Expected Results
- ✅ Unauthenticated requests fail
- ✅ Invalid tokens fail
- ✅ Tokens without organization fail
- ✅ Valid tokens with organization succeed

## 🚨 Test 3: MCP Server Isolation

### Test Script
```javascript
// Test MCP server organization isolation
const testMCPIsolation = async () => {
  // Test with Organization A
  const orgAContext = {
    headers: { 'x-mcp-client': 'org-a-id' },
    organizationId: 'org-a-id'
  };
  
  // Test with Organization B
  const orgBContext = {
    headers: { 'x-mcp-client': 'org-b-id' },
    organizationId: 'org-b-id'
  };
  
  // Test without organization context
  const noOrgContext = {
    headers: {},
    organizationId: null
  };
  
  try {
    // This should work for Organization A
    const orgAMCPs = await getOrganizationMCPServers(orgAContext);
    console.log('Org A MCPs:', orgAMCPs);
    
    // This should work for Organization B
    const orgBMCPs = await getOrganizationMCPServers(orgBContext);
    console.log('Org B MCPs:', orgBMCPs);
    
    // This should fail
    const noOrgMCPs = await getOrganizationMCPServers(noOrgContext);
    console.log('No org MCPs:', noOrgMCPs);
  } catch (error) {
    console.log('Expected error for no organization:', error.message);
  }
};
```

### Expected Results
- ✅ Organization A gets only their MCPs
- ✅ Organization B gets only their MCPs
- ✅ No organization context fails with error

## 🚨 Test 4: RLS Policy Validation

### Test Script
```sql
-- Test RLS policies for all tables
DO $$
DECLARE
  org_a_id UUID;
  org_b_id UUID;
  user_a_id UUID := '00000000-0000-0000-0000-000000000001';
  user_b_id UUID := '00000000-0000-0000-0000-000000000002';
BEGIN
  -- Get organization IDs
  SELECT id INTO org_a_id FROM organizations WHERE slug = 'test-org-a';
  SELECT id INTO org_b_id FROM organizations WHERE slug = 'test-org-b';
  
  -- Test 1: User A should only see Org A data
  SET ROLE authenticated;
  SET LOCAL "request.jwt.claims" TO json_build_object('sub', user_a_id);
  
  -- These should only return Org A data
  PERFORM * FROM agent_library WHERE organization_id = org_a_id;
  PERFORM * FROM prompt_library WHERE organization_id = org_a_id;
  PERFORM * FROM mcp_servers WHERE organization_id = org_a_id;
  
  -- These should return no data (Org B data)
  PERFORM * FROM agent_library WHERE organization_id = org_b_id;
  PERFORM * FROM prompt_library WHERE organization_id = org_b_id;
  PERFORM * FROM mcp_servers WHERE organization_id = org_b_id;
  
  -- Test 2: User B should only see Org B data
  SET LOCAL "request.jwt.claims" TO json_build_object('sub', user_b_id);
  
  -- These should only return Org B data
  PERFORM * FROM agent_library WHERE organization_id = org_b_id;
  PERFORM * FROM prompt_library WHERE organization_id = org_b_id;
  PERFORM * FROM mcp_servers WHERE organization_id = org_b_id;
  
  -- These should return no data (Org A data)
  PERFORM * FROM agent_library WHERE organization_id = org_a_id;
  PERFORM * FROM prompt_library WHERE organization_id = org_a_id;
  PERFORM * FROM mcp_servers WHERE organization_id = org_a_id;
  
  RESET ROLE;
  
  RAISE NOTICE 'RLS policy tests completed successfully';
END;
$$;
```

### Expected Results
- ✅ Users can only access their organization's data
- ✅ No cross-organization data access
- ✅ RLS policies work correctly

## 🚨 Test 5: API Key Isolation

### Test Script
```sql
-- Test API key isolation
DO $$
DECLARE
  org_a_id UUID;
  org_b_id UUID;
  user_a_id UUID := '00000000-0000-0000-0000-000000000001';
  user_b_id UUID := '00000000-0000-0000-0000-000000000002';
BEGIN
  -- Get organization IDs
  SELECT id INTO org_a_id FROM organizations WHERE slug = 'test-org-a';
  SELECT id INTO org_b_id FROM organizations WHERE slug = 'test-org-b';
  
  -- Insert test API keys
  INSERT INTO api_keys (organization_id, key_name, key_value) VALUES
    (org_a_id, 'Org A Key', 'org-a-secret-key'),
    (org_b_id, 'Org B Key', 'org-b-secret-key');
  
  -- Test User A can only see Org A keys
  SET ROLE authenticated;
  SET LOCAL "request.jwt.claims" TO json_build_object('sub', user_a_id);
  
  -- Should only return Org A keys
  PERFORM * FROM api_keys WHERE organization_id = org_a_id;
  
  -- Should return no keys (Org B keys)
  PERFORM * FROM api_keys WHERE organization_id = org_b_id;
  
  -- Test User B can only see Org B keys
  SET LOCAL "request.jwt.claims" TO json_build_object('sub', user_b_id);
  
  -- Should only return Org B keys
  PERFORM * FROM api_keys WHERE organization_id = org_b_id;
  
  -- Should return no keys (Org A keys)
  PERFORM * FROM api_keys WHERE organization_id = org_a_id;
  
  RESET ROLE;
  
  RAISE NOTICE 'API key isolation tests completed successfully';
END;
$$;
```

### Expected Results
- ✅ Users can only see their organization's API keys
- ✅ No cross-organization API key access
- ✅ API key isolation works correctly

## 🚨 Test 6: Load Testing with Multiple Organizations

### Test Script
```javascript
// Load test with multiple organizations
const loadTestOrganizations = async () => {
  const organizations = [
    'org-1', 'org-2', 'org-3', 'org-4', 'org-5'
  ];
  
  const promises = organizations.map(async (orgId) => {
    // Simulate concurrent requests from different organizations
    const requests = Array(10).fill().map(async () => {
      const response = await fetch('/api/config', {
        headers: {
          'Authorization': `Bearer ${getTokenForOrg(orgId)}`,
          'x-mcp-client': orgId
        }
      });
      
      if (!response.ok) {
        throw new Error(`Request failed for org ${orgId}: ${response.status}`);
      }
      
      const config = await response.json();
      
      // Verify organization isolation
      if (config.organization_id !== orgId) {
        throw new Error(`Organization isolation failed for ${orgId}`);
      }
      
      return config;
    });
    
    return Promise.all(requests);
  });
  
  try {
    const results = await Promise.all(promises);
    console.log('Load test completed successfully');
    console.log(`Processed ${results.flat().length} requests across ${organizations.length} organizations`);
  } catch (error) {
    console.error('Load test failed:', error);
    throw error;
  }
};
```

### Expected Results
- ✅ All requests succeed
- ✅ No cross-organization data access
- ✅ Performance remains stable
- ✅ No data leakage between organizations

## 🚨 Test 7: Security Audit

### Test Script
```bash
#!/bin/bash

# Security audit script
echo "🔍 Running security audit..."

# Check for DEFAULT_ORGANIZATION_ID references
echo "Checking for DEFAULT_ORGANIZATION_ID references..."
if grep -r "DEFAULT_ORGANIZATION_ID" . --exclude-dir=node_modules; then
  echo "❌ CRITICAL: DEFAULT_ORGANIZATION_ID references found!"
  exit 1
else
  echo "✅ No DEFAULT_ORGANIZATION_ID references found"
fi

# Check for hardcoded organization IDs
echo "Checking for hardcoded organization IDs..."
if grep -r "ad82fce8-ba9a-438f-9fe2-956a86f479a5" . --exclude-dir=node_modules; then
  echo "❌ CRITICAL: Hardcoded organization IDs found!"
  exit 1
else
  echo "✅ No hardcoded organization IDs found"
fi

# Check for default-org fallbacks
echo "Checking for default-org fallbacks..."
if grep -r "default-org" . --exclude-dir=node_modules; then
  echo "❌ CRITICAL: default-org fallbacks found!"
  exit 1
else
  echo "✅ No default-org fallbacks found"
fi

# Check for authentication bypasses
echo "Checking for authentication bypasses..."
if grep -r "req.user ||" . --exclude-dir=node_modules; then
  echo "⚠️  WARNING: Potential authentication bypasses found"
else
  echo "✅ No authentication bypasses found"
fi

echo "🔒 Security audit completed successfully"
```

### Expected Results
- ✅ No DEFAULT_ORGANIZATION_ID references
- ✅ No hardcoded organization IDs
- ✅ No default-org fallbacks
- ✅ No authentication bypasses

## 📋 Security Testing Checklist

### Pre-Deployment Tests:
- [ ] Data isolation between organizations
- [ ] Authentication requirements
- [ ] MCP server isolation
- [ ] RLS policy validation
- [ ] API key isolation
- [ ] Load testing with multiple organizations
- [ ] Security audit

### Post-Deployment Tests:
- [ ] Monitor for security violations
- [ ] Audit log analysis
- [ ] Performance monitoring
- [ ] Error rate monitoring

## 🚨 Critical Success Criteria

**ALL TESTS MUST PASS** before production deployment:

1. ✅ **Data Isolation**: No cross-organization data access
2. ✅ **Authentication**: All routes require proper authentication
3. ✅ **MCP Isolation**: MCP servers are organization-specific
4. ✅ **RLS Policies**: Database-level isolation works
5. ✅ **API Keys**: Organization-specific API key access
6. ✅ **Load Testing**: Stable performance under load
7. ✅ **Security Audit**: No security vulnerabilities

---

**⚠️ WARNING**: Do not deploy to production until ALL security tests pass.
