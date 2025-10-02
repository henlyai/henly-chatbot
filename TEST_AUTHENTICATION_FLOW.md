# 🧪 Authentication Flow Testing Guide

## Test Your Authentication After Security Updates

### **Step 1: Test Supabase Connection**

```bash
# Test Supabase connection
curl -X GET https://your-supabase-url.supabase.co/rest/v1/organizations \
  -H "apikey: YOUR_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer YOUR_SUPABASE_JWT_TOKEN"
```

**Expected**: Should return organizations (filtered by RLS)

### **Step 2: Test LibreChat Authentication**

```bash
# Test LibreChat SSO endpoint
curl -X POST https://your-librechat-url.railway.app/api/auth/sso/librechat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SUPABASE_JWT_TOKEN" \
  -d '{}'
```

**Expected**: Should return LibreChat JWT token

### **Step 3: Test Config Route**

```bash
# Test config route with LibreChat JWT
curl -X GET https://your-librechat-url.railway.app/api/config \
  -H "Authorization: Bearer YOUR_LIBRECHAT_JWT_TOKEN"
```

**Expected**: Should return organization-specific config

### **Step 4: Test MCP Servers**

```bash
# Test MCP server with organization context
curl -X POST https://your-mcp-server.railway.app/sse \
  -H "Content-Type: application/json" \
  -H "x-mcp-client: YOUR_ORGANIZATION_ID" \
  -d '{"method": "tools/list"}'
```

**Expected**: Should return organization-specific MCP tools

## 🔍 **Debugging Common Issues**

### **Issue: 401 Unauthorized on Config Route**
**Cause**: Authentication not working
**Debug**:
```bash
# Check if JWT token is valid
echo "YOUR_JWT_TOKEN" | base64 -d
# Should show organization_id in payload
```

### **Issue: MCP Servers Return Error**
**Cause**: Missing organization context
**Debug**:
```bash
# Check MCP server logs
railway logs
# Look for "Organization ID is required" errors
```

### **Issue: Database RLS Errors**
**Cause**: RLS policies not applied
**Debug**:
```sql
-- Check if RLS is enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('organizations', 'profiles', 'mcp_servers');
```

## ✅ **Success Criteria**

After running the security updates, you should see:

1. **✅ Unauthenticated requests fail** (401/403)
2. **✅ Authenticated requests work** (200 OK)
3. **✅ Organization-specific data only**
4. **✅ MCP servers work with organization context**
5. **✅ No cross-organization data access**

## 🚨 **If Something Breaks**

### **Rollback Plan**:
1. **Temporarily disable** the security middleware
2. **Test** with a known working organization
3. **Debug** the specific issue
4. **Re-enable** security once fixed

### **Emergency Fix**:
```javascript
// TEMPORARY: Add this to config route for debugging
if (!req.user || !req.user.organization_id) {
  console.log('DEBUG: No user or organization_id');
  console.log('DEBUG: req.user:', req.user);
  console.log('DEBUG: Headers:', req.headers);
  // Return 401 for security
  return res.status(401).json({ error: 'Authentication required' });
}
```

## 📋 **Pre-Deployment Checklist**

- [ ] Supabase SQL script executed successfully
- [ ] Environment variables cleaned up
- [ ] Authentication flow tested
- [ ] MCP servers working with organization context
- [ ] No cross-organization data access
- [ ] All tests passing

---

**⚠️ Important**: The security updates are **intentionally strict**. This is normal and expected behavior for a secure multi-tenant system.
