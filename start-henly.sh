#!/bin/sh

echo "🚀 Starting Henly AI LibreChat..."
echo "🔧 Environment Check:"

# Check critical environment variables
if [ -z "$SUPABASE_URL" ]; then
    echo "❌ SUPABASE_URL is not set!"
    echo "   This is required for organization MCP loading and agent/prompt injection"
    exit 1
else
    echo "✅ SUPABASE_URL: ${SUPABASE_URL}"
fi

if [ -z "$SUPABASE_ANON_KEY" ]; then
    echo "❌ SUPABASE_ANON_KEY is not set!"
    echo "   This is required for Supabase database access"
    exit 1
else
    echo "✅ SUPABASE_ANON_KEY: [SET]"
fi

if [ -z "$DEFAULT_ORGANIZATION_ID" ]; then
    echo "❌ DEFAULT_ORGANIZATION_ID is not set!"
    echo "   This is required for loading MCPs on public routes"
    exit 1
else
    echo "✅ DEFAULT_ORGANIZATION_ID: ${DEFAULT_ORGANIZATION_ID}"
fi

if [ -z "$JWT_SECRET" ]; then
    echo "❌ JWT_SECRET is not set!"
    echo "   This is required for iframe SSO authentication"
    exit 1
else
    echo "✅ JWT_SECRET: [SET]"
fi

echo "🎯 All critical environment variables are set!"
echo "🔍 LibreChat Config Check:"

# Verify mcpServers is enabled
if grep -q "mcpServers: true" librechat.yaml; then
    echo "✅ mcpServers: enabled in librechat.yaml"
else
    echo "❌ mcpServers: NOT enabled in librechat.yaml"
    echo "   MCPs will not appear in the UI!"
fi

if grep -q "agents: true" librechat.yaml; then
    echo "✅ agents: enabled in librechat.yaml"
else
    echo "❌ agents: NOT enabled in librechat.yaml"
fi

if grep -q "prompts: true" librechat.yaml; then
    echo "✅ prompts: enabled in librechat.yaml"
else
    echo "❌ prompts: NOT enabled in librechat.yaml"
fi

echo "🌐 Network Configuration:"
echo "   PORT: ${PORT:-8080}"
echo "   NODE_ENV: ${NODE_ENV:-production}"

echo "🎊 Starting LibreChat backend with Henly AI integrations..."
exec npm run backend
