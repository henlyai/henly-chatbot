# MCP Implementation Guide for ScaleWize AI

## 🎯 **Project Context**

You are helping implement a new Model Context Protocol (MCP) server for the ScaleWize AI chatbot project. This is a multi-tenant SaaS platform where each client organization has their own MCP configurations.

## 📁 **Project Structure**

```
SWAI/scalewize-chatbot/
├── custom-mcp-servers/shared/
│   ├── google-drive-mcp/          # ✅ Reference implementation
│   └── [your-new-mcp]/            # 🆕 Create here
├── api/server/services/
│   ├── OrganizationMCP.js         # Loads MCP configs from Supabase
│   └── MCP.js                     # Manages MCP tool calls
└── librechat.yaml                 # LibreChat configuration
```

## 🏗️ **Architecture Overview**

- **Frontend**: ScaleWize AI website (Vercel) with iframe-embedded chatbot
- **Chatbot**: LibreChat fork hosted on Railway
- **MCP Servers**: Individual Railway services per MCP
- **Database**: Supabase for MCP configuration management
- **Authentication**: Organization-based service account authentication

## 🗄️ **Database Schema**

```sql
-- mcp_servers table structure
CREATE TABLE mcp_servers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,                    -- MCP name (e.g., 'GitHub', 'Slack')
  description text,                      -- MCP description
  endpoint text NOT NULL,                -- Railway deployment URL
  capabilities text[] DEFAULT '{}',      -- Array of tool names
  organization_id uuid NOT NULL,         -- Links to organizations table
  is_active boolean DEFAULT true,
  auth_type text DEFAULT 'none',         -- 'none', 'oauth', 'service_account'
  auth_config jsonb DEFAULT '{}',        -- Encrypted API keys, OAuth settings
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
```

## 🔧 **Key Implementation Requirements**

### **1. MCP Server Structure**
- **Location**: `custom-mcp-servers/shared/[your-mcp-name]/`
- **Language**: TypeScript with ES modules
- **Framework**: Express.js with MCP SDK
- **Transport**: SSE (Server-Sent Events) for production

### **2. Required Dependencies**
```json
{
  "@modelcontextprotocol/sdk": "^0.4.0",
  "@supabase/supabase-js": "^2.38.0",
  "express": "^4.18.2",
  "cors": "^2.8.5",
  "zod": "^3.22.4"
}
```

### **3. Core Functions to Implement**
```typescript
// 1. Organization ID extraction from context
function getOrganizationIdFromContext(context: any): string {
  return context.headers['x-mcp-client'] || 
         context.headers['X-MCP-Client'] || 
         context.requestInfo?.headers['x-mcp-client'] ||
         context.requestInfo?.headers['X-MCP-Client'] ||
         context.organizationId ||
         'default-org';
}

// 2. Organization-specific configuration loading
async function getOrganizationConfig(organizationId: string, mcpName: string) {
  const { data: mcpServer, error } = await supabase
    .from('mcp_servers')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('name', mcpName)
    .eq('is_active', true)
    .single();

  if (error || !mcpServer) {
    throw new Error(`${mcpName} not configured for organization ${organizationId}`);
  }

  return mcpServer;
}
```

### **4. Required Endpoints**
- `GET /health` - Health check
- `GET /mcp` - MCP protocol handshake (SSE)
- `POST /messages` - MCP message handling

### **5. Tool Implementation Pattern**
```typescript
server.tool('your_tool_name', 'Description of what this tool does', {
  param1: z.string().describe('Description of parameter 1'),
  param2: z.number().optional().describe('Description of parameter 2')
}, async ({ param1, param2 }, context) => {
  try {
    const organizationId = getOrganizationIdFromContext(context);
    const config = await getOrganizationConfig(organizationId, 'Your MCP Name');
    
    // Your tool implementation here
    
    return {
      content: [
        {
          type: 'text',
          text: 'Your result here'
        }
      ]
    };
  } catch (error) {
    console.error(`❌ Error in your_tool_name: ${error}`);
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      ]
    };
  }
});
```

## 🚀 **Deployment Process**

### **1. Railway Setup**
- Create new Railway service
- Connect to GitHub repository
- Set environment variables:
  ```
  SUPABASE_URL=https://ad82fce8-ba9a-438f-9fe2-956a86f479a5.supabase.co
  SUPABASE_ANON_KEY=your-anon-key
  PORT=3000
  ```

### **2. Database Configuration**
```sql
-- Add MCP server configuration
INSERT INTO mcp_servers (
  name, description, endpoint, capabilities, 
  organization_id, is_active, auth_type, auth_config
) VALUES (
  'Your MCP Name',
  'Description of your MCP',
  'https://your-mcp-server-production.up.railway.app/mcp',
  ARRAY['your_tool_name', 'another_tool_name'],
  'ad82fce8-ba9a-438f-9fe2-956a86f479a5', -- Organization ID
  true,
  'service_account',
  '{}'::jsonb
);
```

### **3. Authentication (if needed)**
For MCPs requiring API keys:
```sql
-- Update with encrypted authentication
UPDATE mcp_servers 
SET auth_config = '{
  "api_key": "your-encrypted-api-key",
  "base_url": "https://api.yourservice.com"
}'::jsonb
WHERE name = 'Your MCP Name';
```

## 🔍 **Reference Implementation**

Study the existing Google Drive MCP at `custom-mcp-servers/shared/google-drive-mcp/` for:
- Complete TypeScript implementation
- Error handling patterns
- Performance optimizations (caching, rate limiting)
- File type handling
- Organization-based authentication

## 🧪 **Testing Checklist**

- [ ] Local development with `npm run dev`
- [ ] Railway deployment successful
- [ ] Health endpoint accessible
- [ ] MCP endpoint responds correctly
- [ ] Tools appear in LibreChat UI
- [ ] Organization-specific configuration loads
- [ ] Error handling works properly

## 🔒 **Security Requirements**

- Store sensitive data in Railway environment variables
- Use encryption for API keys in `auth_config`
- Implement proper error handling (no sensitive data in logs)
- Validate organization access for all operations
- Add rate limiting to prevent abuse

## 📋 **Implementation Steps**

1. **Create MCP directory** in `custom-mcp-servers/shared/`
2. **Initialize package.json** with required dependencies
3. **Implement MCP server** with organization support
4. **Deploy to Railway** and get endpoint URL
5. **Add to Supabase** configuration
6. **Test integration** in LibreChat
7. **Add client setup** scripts if needed

## 🎯 **Success Criteria**

- MCP tools appear in LibreChat chatbot UI
- Tools work correctly for the specific organization
- Proper error messages for configuration issues
- Performance is acceptable (no infinite loops)
- Security best practices followed

This guide provides all the context needed to implement a new MCP server that integrates seamlessly with the existing ScaleWize AI architecture. 