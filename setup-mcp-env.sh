#!/bin/bash

# Henly AI MCP Environment Variables Setup Script
# This script helps configure MCP servers via environment variables

set -e

echo "🔧 Setting up MCP Environment Variables for LibreChat"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_status "This script will help you configure MCP servers via environment variables"
echo ""

print_status "Environment Variables to add to your LibreChat Railway service:"
echo ""

cat << 'EOF'
# Google Drive MCP Server Configuration
MCP_SERVERS_GOOGLE_DRIVE_TYPE=sse
MCP_SERVERS_GOOGLE_DRIVE_URL=https://mcp-servers-production-c189.up.railway.app/sse
MCP_SERVERS_GOOGLE_DRIVE_TIMEOUT=60000
MCP_SERVERS_GOOGLE_DRIVE_OAUTH_AUTHORIZATION_URL=https://accounts.google.com/o/oauth2/auth
MCP_SERVERS_GOOGLE_DRIVE_OAUTH_TOKEN_URL=https://oauth2.googleapis.com/token
MCP_SERVERS_GOOGLE_DRIVE_OAUTH_SCOPE=https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.file
MCP_SERVERS_GOOGLE_DRIVE_OAUTH_CLIENT_ID=${GOOGLE_CLIENT_ID}
MCP_SERVERS_GOOGLE_DRIVE_OAUTH_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
MCP_SERVERS_GOOGLE_DRIVE_OAUTH_REDIRECT_URI=https://mcp-servers-production-c189.up.railway.app/oauth/callback
EOF

echo ""
print_warning "Steps to configure:"
echo "1. Go to your LibreChat Railway project (scalewize-production-chatbot)"
echo "2. Navigate to the 'Variables' tab"
echo "3. Add each of the environment variables above"
echo "4. Railway will automatically redeploy LibreChat"
echo "5. Test the MCP integration in your chatbot"
echo ""

print_status "Note: The MCP configuration has been removed from librechat.yaml to avoid conflicts"
print_status "The environment variables will take precedence over the YAML configuration"
echo ""

print_success "Setup instructions complete!"
print_status "After adding the environment variables, test your chatbot to see if Google Drive tools appear." 