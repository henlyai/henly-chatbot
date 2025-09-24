# 🚀 Supabase-Native LibreChat Integration Guide

This guide explains how to make LibreChat read agents and prompts directly from Supabase instead of MongoDB, creating a unified, organization-aware system.

## 🎯 Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   LibreChat     │    │   Supabase       │    │   Organization  │
│   Frontend      │───▶│   Database       │◀───│   Management    │
│                 │    │                  │    │                 │
│ • Agent Builder │    │ • agent_library  │    │ • Multi-tenant  │
│ • Prompt Library│    │ • prompt_library │    │ • RLS Security  │
│ • Chat Interface│    │ • organizations  │    │ • Role-based    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## ✅ What's Been Created

### 1. **Supabase Providers**
- `SupabaseAgentProvider.js` - Reads/writes agents directly from Supabase
- `SupabasePromptProvider.js` - Reads/writes prompts directly from Supabase
- Organization-aware data access with RLS support

### 2. **LibreChat Integration**
- `SupabaseAgent.js` - Drop-in replacement for MongoDB Agent model
- `organizationContext.js` - Middleware to inject organization context
- Seamless integration with existing LibreChat APIs

### 3. **API Endpoints**
- Organization-specific agent and prompt management
- Sync status monitoring
- Legacy LibreChat API compatibility

## 🔧 Integration Steps

### Step 1: Update Supabase Schema

First, ensure your Supabase tables have the necessary fields for LibreChat compatibility:

```sql
-- Add LibreChat configuration storage to agent_library
ALTER TABLE public.agent_library 
ADD COLUMN IF NOT EXISTS librechat_config JSONB DEFAULT '{}';

-- Add LibreChat configuration storage to prompt_library  
ALTER TABLE public.prompt_library
ADD COLUMN IF NOT EXISTS librechat_config JSONB DEFAULT '{}';

-- Create function to increment prompt usage
CREATE OR REPLACE FUNCTION increment_prompt_usage(prompt_id UUID, org_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE prompt_library 
  SET usage_count = COALESCE(usage_count, 0) + 1,
      updated_at = NOW()
  WHERE id = prompt_id AND organization_id = org_id;
END;
$$ LANGUAGE plpgsql;
```

### Step 2: Replace LibreChat Models

Replace the default LibreChat models with Supabase-backed versions:

```javascript
// In api/models/Agent.js - replace the entire file content with:
module.exports = require('./SupabaseAgent');

// In api/models/Prompt.js - add Supabase provider integration:
const SupabasePromptProvider = require('~/server/services/SupabasePromptProvider');
// ... integration code
```

### Step 3: Update Route Middleware

Add organization context to LibreChat routes:

```javascript
// In api/server/routes/agents.js
const { injectOrganizationContext } = require('~/server/middleware/organizationContext');

// Apply to all agent routes
router.use(injectOrganizationContext);
```

### Step 4: Update JWT Strategy

Ensure the JWT strategy includes organization context:

```javascript
// In api/strategies/jwtStrategy.js
// This is already implemented in your system
if (payload?.organization?.id) {
  user.organization_id = payload.organization.id;
}
```

## 🎮 How It Works

### Agent Creation Flow

1. **User creates agent** in LibreChat UI
2. **SupabaseAgentProvider** saves to `agent_library` table
3. **Organization RLS** ensures proper access control
4. **Agent appears** immediately for organization members

### Agent Loading Flow

1. **User opens chat** with agent
2. **loadAgent()** queries Supabase with organization filter
3. **Agent configuration** loaded from `librechat_config` JSON
4. **Tools and MCPs** assigned based on category

### Multi-Tenant Security

- **Organization ID** from JWT token
- **RLS policies** in Supabase enforce organization boundaries
- **No cross-organization** data leakage
- **Admin roles** can access multiple organizations

## 📊 Data Flow Example

```javascript
// When user creates an agent:
POST /api/agents
{
  "name": "Sales Assistant",
  "description": "Helps with sales tasks",
  "instructions": "You are a sales expert...",
  "model": "gpt-4",
  "tools": ["Google Drive", "HubSpot"]
}

// Supabase stores:
{
  "id": "uuid",
  "organization_id": "user-org-uuid",
  "name": "Sales Assistant", 
  "description": "Helps with sales tasks",
  "category": "sales_marketing",
  "librechat_config": {
    "instructions": "You are a sales expert...",
    "model": "gpt-4",
    "provider": "openai",
    "tools": ["Google Drive", "HubSpot"],
    "model_parameters": {"temperature": 0.7}
  }
}
```

## 🚀 Benefits

### For Organizations
- **Centralized management** - All data in Supabase
- **Real-time updates** - Changes appear immediately
- **Backup and sync** - Native Supabase features
- **Multi-tenant security** - Built-in isolation

### For Developers  
- **Single database** - No MongoDB required
- **Unified API** - Same Supabase client everywhere
- **Better debugging** - All data visible in Supabase dashboard
- **Easier deployment** - One less service to manage

### For Users
- **Faster loading** - Direct database access
- **Better reliability** - No sync issues between systems
- **Organization-aware** - Content scoped to their org
- **Immediate availability** - No background sync needed

## 🔗 API Endpoints

### Agents
```bash
# Get organization agents
GET /api/organization-agents

# Sync status
GET /api/librechat-sync/status

# Manual sync (if needed)
POST /api/librechat-sync/organization
```

### Prompts  
```bash
# Get organization prompts
GET /api/organization-prompts

# Search prompts
GET /api/organization-prompts?search=meeting

# Create prompt
POST /api/organization-prompts
```

## 🛠️ Configuration

### Environment Variables
```bash
# Already configured in your system
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-anon-key
```

### LibreChat Configuration
```yaml
# In librechat.yaml - already configured
interface:
  agents: true
  prompts: true
```

## 🔍 Debugging

### Check Organization Context
```bash
# Test organization context
curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:3080/api/organization-agents
```

### Monitor Logs
```bash
# Look for these log messages:
[SupabaseAgent] Retrieved X agents for organization
[OrganizationContext] Added organization context
[SupabasePrompts] Created prompt for organization
```

### Verify Data
```sql
-- Check agent data in Supabase
SELECT id, name, category, organization_id, librechat_config 
FROM agent_library 
WHERE organization_id = 'your-org-id';

-- Check prompt data
SELECT id, name, category, organization_id, prompt_text
FROM prompt_library 
WHERE organization_id = 'your-org-id';
```

## 🎉 Result

After integration, you'll have:

- ✅ **LibreChat UI** working normally
- ✅ **Agents stored** in Supabase `agent_library`
- ✅ **Prompts stored** in Supabase `prompt_library`  
- ✅ **Organization isolation** via RLS
- ✅ **No MongoDB dependency** for agents/prompts
- ✅ **Real-time updates** across all users
- ✅ **Unified admin interface** in Supabase

Your LibreChat instance will be fully organization-aware with all data centralized in Supabase! 🎊
