#!/bin/bash

CLIENT_ID=$1

if [ -z "$CLIENT_ID" ]; then
    echo "Usage: $0 <client_id>"
    echo "Example: $0 client-a"
    exit 1
fi

CLIENT_CONFIG_DIR="client-configs/$CLIENT_ID"

if [ ! -d "$CLIENT_CONFIG_DIR" ]; then
    echo "❌ Error: Client configuration not found for $CLIENT_ID"
    echo "Run: ./scripts/generate-client-config.sh $CLIENT_ID 'Client Name'"
    exit 1
fi

echo "🚀 Deploying client: $CLIENT_ID"

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found. Installing..."
    npm install -g @railway/cli
fi

# Deploy shared MCPs (if not already deployed)
echo "📦 Deploying shared MCPs..."

# Deploy Google Drive MCP
echo "  - Deploying Google Drive MCP..."
cd "custom-mcp-servers/shared/google-drive-mcp"
if [ ! -f ".railway" ]; then
    railway init --name "shared-google-drive-mcp"
fi
railway up
cd - > /dev/null

# Deploy Slack MCP (when created)
if [ -d "custom-mcp-servers/shared/slack-mcp" ]; then
    echo "  - Deploying Slack MCP..."
    cd "custom-mcp-servers/shared/slack-mcp"
    if [ ! -f ".railway" ]; then
        railway init --name "shared-slack-mcp"
    fi
    railway up
    cd - > /dev/null
fi

# Deploy client-specific MCPs
echo "📦 Deploying client-specific MCPs..."
for mcp_dir in "custom-mcp-servers/clients/$CLIENT_ID"/*; do
    if [ -d "$mcp_dir" ]; then
        mcp_name=$(basename "$mcp_dir")
        echo "  - Deploying $mcp_name..."
        cd "$mcp_dir"
        if [ ! -f ".railway" ]; then
            railway init --name "$CLIENT_ID-$mcp_name"
        fi
        railway up
        cd - > /dev/null
    fi
done

# Deploy LibreChat with client configuration
echo "📦 Deploying LibreChat for $CLIENT_ID..."

# Backup current configuration
cp librechat.yaml librechat.yaml.backup
cp .env .env.backup

# Apply client configuration
cp "$CLIENT_CONFIG_DIR/librechat.yaml" librechat.yaml
cp "$CLIENT_CONFIG_DIR/environment.env" .env

# Deploy to Railway
if [ ! -f ".railway" ]; then
    railway init --name "$CLIENT_ID-librechat"
fi
railway up

# Restore original configuration
cp librechat.yaml.backup librechat.yaml
cp .env.backup .env

echo "✅ Deployment complete for $CLIENT_ID"
echo ""
echo "📋 Next steps:"
echo "1. Update Google Cloud OAuth settings with new Railway URLs"
echo "2. Test the OAuth flow in production"
echo "3. Verify all MCP servers are working" 