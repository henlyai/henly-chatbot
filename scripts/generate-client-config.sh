#!/bin/bash

CLIENT_ID=$1
CLIENT_NAME=$2

if [ -z "$CLIENT_ID" ] || [ -z "$CLIENT_NAME" ]; then
    echo "Usage: $0 <client_id> <client_name>"
    echo "Example: $0 client-a 'Client A Corporation'"
    exit 1
fi

CLIENT_CONFIG_DIR="client-configs/$CLIENT_ID"

echo "Generating configuration for client: $CLIENT_NAME ($CLIENT_ID)"

# Create client config directory
mkdir -p "$CLIENT_CONFIG_DIR"

# Generate LibreChat config from default template
echo "Generating LibreChat config..."
cp "client-configs/default/librechat.yaml" "$CLIENT_CONFIG_DIR/librechat.yaml"

# Generate environment file from default template
echo "Generating environment file..."
cp "client-configs/default/environment.env" "$CLIENT_CONFIG_DIR/environment.env"

# Update environment file with client-specific values
sed -i '' "s/CLIENT_ID=default/CLIENT_ID=$CLIENT_ID/" "$CLIENT_CONFIG_DIR/environment.env"
sed -i '' "s/CLIENT_NAME=\"Default Client\"/CLIENT_NAME=\"$CLIENT_NAME\"/" "$CLIENT_CONFIG_DIR/environment.env"

# Generate MCP server list from default template
echo "Generating MCP server list..."
cp "client-configs/default/mcp-servers.json" "$CLIENT_CONFIG_DIR/mcp-servers.json"

# Update MCP server list with client-specific values
sed -i '' "s/\"client_id\": \"default\"/\"client_id\": \"$CLIENT_ID\"/" "$CLIENT_CONFIG_DIR/mcp-servers.json"
sed -i '' "s/\"client_name\": \"Default Client\"/\"client_name\": \"$CLIENT_NAME\"/" "$CLIENT_CONFIG_DIR/mcp-servers.json"

echo "✅ Configuration generated for $CLIENT_NAME in $CLIENT_CONFIG_DIR"
echo ""
echo "📋 Next steps:"
echo "1. Update OAuth credentials in $CLIENT_CONFIG_DIR/environment.env"
echo "2. Add client-specific MCPs to $CLIENT_CONFIG_DIR/mcp-servers.json"
echo "3. Run: ./scripts/deploy-client.sh $CLIENT_ID"
echo ""
echo "📁 Generated files:"
echo "  - $CLIENT_CONFIG_DIR/librechat.yaml"
echo "  - $CLIENT_CONFIG_DIR/environment.env"
echo "  - $CLIENT_CONFIG_DIR/mcp-servers.json" 