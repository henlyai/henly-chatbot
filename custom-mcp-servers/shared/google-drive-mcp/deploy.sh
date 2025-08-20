#!/bin/bash

# Google Drive MCP Server Deployment Script
# This script helps deploy the MCP server to Railway

set -e

echo "🚀 Google Drive MCP Server Deployment Script"
echo "=============================================="

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI is not installed. Please install it first:"
    echo "   npm install -g @railway/cli"
    echo "   railway login"
    exit 1
fi

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Please run this script from the google-drive-mcp directory"
    exit 1
fi

echo "📦 Installing dependencies..."
npm install

echo "🧪 Running tests..."
npm test

echo "🔧 Setting up Railway project..."
if [ ! -f ".railway" ]; then
    echo "Creating new Railway project..."
    railway init
else
    echo "Railway project already exists"
fi

echo "🔐 Setting up environment variables..."
echo "Please make sure these environment variables are set in Railway:"
echo ""
echo "GOOGLE_CLIENT_ID=your_google_client_id"
echo "GOOGLE_CLIENT_SECRET=your_google_client_secret"
echo "GOOGLE_REDIRECT_URI=https://your-railway-app.up.railway.app/oauth/callback"
echo ""

read -p "Have you set up the environment variables in Railway? (y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Please set up the environment variables first"
    exit 1
fi

echo "🚀 Deploying to Railway..."
railway up

echo "✅ Deployment complete!"
echo ""
echo "🔗 Your MCP server should be available at:"
echo "   https://your-railway-app.up.railway.app"
echo ""
echo "🧪 Test the deployment:"
echo "   curl https://your-railway-app.up.railway.app/health"
echo ""
echo "📋 Next steps:"
echo "1. Update your LibreChat configuration with the new MCP server URL"
echo "2. Test the OAuth flow with a user"
echo "3. Verify that Google Drive tools work in the chatbot" 