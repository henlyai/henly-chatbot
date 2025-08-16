# Multi-Client MCP Configuration Guide

This guide explains how to manage multiple clients with different MCP configurations in a scalable way.

## 🏗️ Architecture Overview

### Repository Structure
```
scalewize-production-chatbot/
├── custom-mcp-servers/           # All MCP servers
│   ├── shared/                   # Shared MCPs (Google Drive, Slack, etc.)
│   │   ├── google-drive-mcp/
│   │   ├── slack-mcp/
│   │   └── base-mcp-template/    # Template for new MCPs
│   └── clients/                  # Client-specific MCPs
│       ├── client-a/
│       │   ├── custom-crm-mcp/
│       │   └── custom-analytics-mcp/
│       └── client-b/
│           ├── custom-erp-mcp/
│           └── custom-hr-mcp/
├── client-configs/               # Client-specific configurations
│   ├── client-a/
│   │   ├── librechat.yaml        # Client A's LibreChat config
│   │   ├── environment.env       # Client A's environment variables
│   │   └── mcp-servers.json      # Client A's MCP server list
│   ├── client-b/
│   │   ├── librechat.yaml
│   │   ├── environment.env
│   │   └── mcp-servers.json
│   └── default/                  # Default configuration
│       ├── librechat.yaml
│       ├── environment.env
│       └── mcp-servers.json
├── scripts/
│   ├── deploy-client.sh          # Deploy specific client
│   ├── generate-client-config.sh # Generate client config
│   └── update-mcp-servers.sh     # Update MCP server list
└── docker-compose.yml            # Multi-service setup
```

## 🚀 Railway Deployment Strategy

### Option 1: Single Railway Project (Recommended for < 10 clients)
```
Railway Project: "ScaleWize AI Platform"
├── Service: LibreChat (Main)
├── Service: Google Drive MCP (Shared)
├── Service: Slack MCP (Shared)
├── Service: Client A Custom MCP
├── Service: Client B Custom MCP
└── Service: MCP Router (Optional)
```

### Option 2: Separate Railway Projects (Recommended for > 10 clients)
```
Railway Project: "ScaleWize Shared MCPs"
├── Service: Google Drive MCP
├── Service: Slack MCP
└── Service: Base MCP Template

Railway Project: "ScaleWize Client A"
├── Service: LibreChat (Client A)
├── Service: Custom CRM MCP
└── Service: Custom Analytics MCP

Railway Project: "ScaleWize Client B"
├── Service: LibreChat (Client B)
├── Service: Custom ERP MCP
└── Service: Custom HR MCP
```

## ⚙️ Configuration Management

### Client Configuration Files

#### 1. Client-Specific LibreChat Config (`client-configs/client-a/librechat.yaml`)
```yaml
# Client A's LibreChat configuration
mcpServers:
  "Google Drive":
    type: sse
    url: ${GOOGLE_DRIVE_MCP_URL}
    timeout: 60000
    oauth:
      authorization_url: https://accounts.google.com/o/oauth2/auth
      token_url: https://oauth2.googleapis.com/token
      scope: https://www.googleapis.com/auth/drive.readonly
      client_id: ${GOOGLE_CLIENT_ID}
      client_secret: ${GOOGLE_CLIENT_SECRET}
      redirect_uri: ${GOOGLE_DRIVE_MCP_URL}/oauth/callback
  
  "Slack":
    type: sse
    url: ${SLACK_MCP_URL}
    timeout: 60000
  
  "Custom CRM":
    type: sse
    url: ${CLIENT_A_CRM_MCP_URL}
    timeout: 60000
  
  "Custom Analytics":
    type: sse
    url: ${CLIENT_A_ANALYTICS_MCP_URL}
    timeout: 60000
```

#### 2. Client Environment Variables (`client-configs/client-a/environment.env`)
```env
# Client A specific environment variables
CLIENT_ID=client-a
CLIENT_NAME="Client A Corporation"

# Shared MCP URLs
GOOGLE_DRIVE_MCP_URL=https://shared-google-drive-mcp.railway.app/sse
SLACK_MCP_URL=https://shared-slack-mcp.railway.app/sse

# Client-specific MCP URLs
CLIENT_A_CRM_MCP_URL=https://client-a-crm-mcp.railway.app/sse
CLIENT_A_ANALYTICS_MCP_URL=https://client-a-analytics-mcp.railway.app/sse

# OAuth credentials (client-specific)
GOOGLE_CLIENT_ID=client-a-google-client-id
GOOGLE_CLIENT_SECRET=client-a-google-client-secret
SLACK_CLIENT_ID=client-a-slack-client-id
SLACK_CLIENT_SECRET=client-a-slack-client-secret

# Custom MCP credentials
CRM_API_KEY=client-a-crm-api-key
ANALYTICS_API_KEY=client-a-analytics-api-key
```

#### 3. MCP Server List (`client-configs/client-a/mcp-servers.json`)
```json
{
  "client_id": "client-a",
  "client_name": "Client A Corporation",
  "mcp_servers": [
    {
      "name": "Google Drive",
      "type": "shared",
      "url": "https://shared-google-drive-mcp.railway.app/sse",
      "enabled": true,
      "oauth_required": true
    },
    {
      "name": "Slack",
      "type": "shared",
      "url": "https://shared-slack-mcp.railway.app/sse",
      "enabled": true,
      "oauth_required": true
    },
    {
      "name": "Custom CRM",
      "type": "client-specific",
      "url": "https://client-a-crm-mcp.railway.app/sse",
      "enabled": true,
      "oauth_required": false
    },
    {
      "name": "Custom Analytics",
      "type": "client-specific",
      "url": "https://client-a-analytics-mcp.railway.app/sse",
      "enabled": true,
      "oauth_required": false
    }
  ]
}
```

## 🔧 Deployment Scripts

### 1. Deploy Client Script (`scripts/deploy-client.sh`)
```bash
#!/bin/bash

CLIENT_ID=$1
CLIENT_CONFIG_DIR="client-configs/$CLIENT_ID"

if [ ! -d "$CLIENT_CONFIG_DIR" ]; then
    echo "Error: Client configuration not found for $CLIENT_ID"
    exit 1
fi

echo "Deploying client: $CLIENT_ID"

# Deploy shared MCPs (if not already deployed)
echo "Deploying shared MCPs..."
railway up --service shared-google-drive-mcp
railway up --service shared-slack-mcp

# Deploy client-specific MCPs
echo "Deploying client-specific MCPs..."
for mcp_dir in custom-mcp-servers/clients/$CLIENT_ID/*; do
    if [ -d "$mcp_dir" ]; then
        mcp_name=$(basename "$mcp_dir")
        echo "Deploying $mcp_name..."
        cd "$mcp_dir"
        railway up --service "$CLIENT_ID-$mcp_name"
        cd - > /dev/null
    fi
done

# Deploy LibreChat with client configuration
echo "Deploying LibreChat for $CLIENT_ID..."
cp "$CLIENT_CONFIG_DIR/librechat.yaml" librechat.yaml
cp "$CLIENT_CONFIG_DIR/environment.env" .env
railway up --service "$CLIENT_ID-librechat"

echo "Deployment complete for $CLIENT_ID"
```

### 2. Generate Client Config Script (`scripts/generate-client-config.sh`)
```bash
#!/bin/bash

CLIENT_ID=$1
CLIENT_NAME=$2

if [ -z "$CLIENT_ID" ] || [ -z "$CLIENT_NAME" ]; then
    echo "Usage: $0 <client_id> <client_name>"
    exit 1
fi

CLIENT_CONFIG_DIR="client-configs/$CLIENT_ID"

echo "Generating configuration for client: $CLIENT_NAME ($CLIENT_ID)"

# Create client config directory
mkdir -p "$CLIENT_CONFIG_DIR"

# Generate LibreChat config
cat > "$CLIENT_CONFIG_DIR/librechat.yaml" << EOF
# LibreChat configuration for $CLIENT_NAME
mcpServers:
  "Google Drive":
    type: sse
    url: \${GOOGLE_DRIVE_MCP_URL}
    timeout: 60000
    oauth:
      authorization_url: https://accounts.google.com/o/oauth2/auth
      token_url: https://oauth2.googleapis.com/token
      scope: https://www.googleapis.com/auth/drive.readonly
      client_id: \${GOOGLE_CLIENT_ID}
      client_secret: \${GOOGLE_CLIENT_SECRET}
      redirect_uri: \${GOOGLE_DRIVE_MCP_URL}/oauth/callback
  
  "Slack":
    type: sse
    url: \${SLACK_MCP_URL}
    timeout: 60000
EOF

# Generate environment file
cat > "$CLIENT_CONFIG_DIR/environment.env" << EOF
# Environment variables for $CLIENT_NAME
CLIENT_ID=$CLIENT_ID
CLIENT_NAME="$CLIENT_NAME"

# Shared MCP URLs
GOOGLE_DRIVE_MCP_URL=https://shared-google-drive-mcp.railway.app/sse
SLACK_MCP_URL=https://shared-slack-mcp.railway.app/sse

# OAuth credentials (to be filled in)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
SLACK_CLIENT_ID=your_slack_client_id
SLACK_CLIENT_SECRET=your_slack_client_secret
EOF

# Generate MCP server list
cat > "$CLIENT_CONFIG_DIR/mcp-servers.json" << EOF
{
  "client_id": "$CLIENT_ID",
  "client_name": "$CLIENT_NAME",
  "mcp_servers": [
    {
      "name": "Google Drive",
      "type": "shared",
      "url": "https://shared-google-drive-mcp.railway.app/sse",
      "enabled": true,
      "oauth_required": true
    },
    {
      "name": "Slack",
      "type": "shared",
      "url": "https://shared-slack-mcp.railway.app/sse",
      "enabled": true,
      "oauth_required": true
    }
  ]
}
EOF

echo "Configuration generated for $CLIENT_NAME in $CLIENT_CONFIG_DIR"
echo "Next steps:"
echo "1. Update OAuth credentials in $CLIENT_CONFIG_DIR/environment.env"
echo "2. Add client-specific MCPs to $CLIENT_CONFIG_DIR/mcp-servers.json"
echo "3. Run: ./scripts/deploy-client.sh $CLIENT_ID"
```

## 📊 Scaling Considerations

### When to Use Each Approach

#### Monorepo (Recommended for < 10 clients)
**Pros:**
- ✅ Easier to manage
- ✅ Shared code and configurations
- ✅ Single deployment pipeline
- ✅ Lower infrastructure costs

**Cons:**
- ❌ Can become complex with many clients
- ❌ Single point of failure
- ❌ Harder to isolate client-specific issues

#### Separate Repos (Recommended for > 10 clients)
**Pros:**
- ✅ Better isolation
- ✅ Independent deployments
- ✅ Client-specific versioning
- ✅ Easier to manage large teams

**Cons:**
- ❌ More complex infrastructure
- ❌ Higher costs
- ❌ Code duplication
- ❌ More maintenance overhead

## 🎯 Recommended Implementation Plan

### Phase 1: Start with Monorepo
1. **Use the current structure** with `client-configs/`
2. **Deploy shared MCPs** to Railway
3. **Add client-specific configurations**
4. **Test with 2-3 clients**

### Phase 2: Scale as Needed
1. **Monitor performance and complexity**
2. **When you reach 8-10 clients**, consider separate repos
3. **Implement client-specific Railway projects**
4. **Add monitoring and analytics**

## 🔐 Security Considerations

### Multi-Tenant Security
1. **Environment isolation** - Each client gets separate environment variables
2. **OAuth scoping** - Client-specific OAuth credentials
3. **API key management** - Separate API keys per client
4. **Access control** - Client-specific access controls in LibreChat

### Best Practices
1. **Never share credentials** between clients
2. **Use environment variables** for all sensitive data
3. **Implement proper logging** for audit trails
4. **Regular security audits** of client configurations

This architecture will scale from 1 client to 100+ clients while maintaining security and manageability. 