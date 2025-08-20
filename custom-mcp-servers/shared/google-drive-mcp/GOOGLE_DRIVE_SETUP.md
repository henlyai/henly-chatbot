# Google Drive MCP Setup Guide

## 🎯 Overview
This guide will help you set up Google Drive MCP integration with your own Google Cloud credentials for organization-based authentication. The MCP server automatically extracts the organization ID from request headers, so no manual parameter passing is required.

## 📋 Prerequisites

1. **Google Cloud Project** with Google Drive API enabled
2. **Service Account** with Google Drive access
3. **Supabase Database** with the enhanced `mcp_servers` table
4. **Organization ID** from your Supabase database

## 🔧 Step-by-Step Setup

### 1. Google Cloud Setup

#### A. Enable Google Drive API
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project or create a new one
3. Navigate to **APIs & Services** > **Library**
4. Search for "Google Drive API" and enable it

#### B. Create Service Account
1. Go to **APIs & Services** > **Credentials**
2. Click **Create Credentials** > **Service Account**
3. Fill in the details:
   - **Name**: `mcp-google-drive-service`
   - **Description**: `Service account for MCP Google Drive integration`
4. Click **Create and Continue**
5. Skip role assignment (we'll handle permissions separately)
6. Click **Done**

#### C. Create and Download Service Account Key
1. Click on your newly created service account
2. Go to **Keys** tab
3. Click **Add Key** > **Create New Key**
4. Choose **JSON** format
5. Download the key file (keep it secure!)

#### D. Set Up Google Drive Permissions
1. **Option 1: Share specific folder**
   - Create a folder in Google Drive
   - Right-click > **Share**
   - Add your service account email: `mcp-google-drive-service@your-project.iam.gserviceaccount.com`
   - Give **Viewer** permissions

2. **Option 2: Use service account's own Drive**
   - The service account has its own Google Drive
   - Upload files to the service account's Drive
   - Use folder ID `root` for access

### 2. Environment Variables

Set these environment variables in your Railway deployment:

```bash
# Supabase Configuration
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# Encryption Key (32 characters)
MCP_ENCRYPTION_KEY=your-32-character-encryption-key-here

# Optional: Override MCP server endpoint
MCP_SERVER_ENDPOINT=https://mcp-servers-production-c189.up.railway.app/mcp
```

### 3. Database Migration

Run this SQL in your Supabase SQL Editor:

```sql
-- Migration: Add authentication columns to mcp_servers table
ALTER TABLE public.mcp_servers 
ADD COLUMN IF NOT EXISTS auth_type TEXT DEFAULT 'none' CHECK (auth_type IN ('none', 'oauth', 'service_account'));

ALTER TABLE public.mcp_servers 
ADD COLUMN IF NOT EXISTS auth_config JSONB DEFAULT '{}'::jsonb;

ALTER TABLE public.mcp_servers 
ADD COLUMN IF NOT EXISTS google_drive_folder_id TEXT;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_mcp_servers_auth_type ON public.mcp_servers(auth_type);
CREATE INDEX IF NOT EXISTS idx_mcp_servers_google_drive_folder ON public.mcp_servers(google_drive_folder_id);

-- Update existing Google Drive MCP servers
UPDATE public.mcp_servers 
SET auth_type = 'service_account'
WHERE name = 'Google Drive' AND auth_type = 'none';
```

### 4. Client Configuration

#### Option A: Use the Setup Script (Recommended)

1. **Navigate to the MCP server directory:**
   ```bash
   cd SWAI/scalewize-chatbot/custom-mcp-servers/shared/google-drive-mcp
   ```

2. **Set environment variables:**
   ```bash
   export SUPABASE_URL="your_supabase_url"
   export SUPABASE_ANON_KEY="your_supabase_anon_key"
   export MCP_ENCRYPTION_KEY="your-32-character-encryption-key"
   ```

3. **Run the setup script:**
   ```bash
   node setup-first-client.js
   ```

4. **Follow the prompts:**
   - Enter your organization ID
   - Provide path to service account key JSON file
   - Enter Google Drive folder ID (or press Enter for root)

#### Option B: Manual Database Insert

```sql
-- Replace with your actual values
INSERT INTO public.mcp_servers (
  name, description, endpoint, capabilities, organization_id,
  auth_type, auth_config, google_drive_folder_id, is_active
) VALUES (
  'Google Drive',
  'Access Google Drive files and folders with full content reading capabilities',
  'https://mcp-servers-production-c189.up.railway.app/mcp',
  ARRAY['search_file', 'list_files', 'get_file_metadata', 'read_content'],
  'your-organization-id-here',
  'service_account',
  '{
    "service_account_key": "encrypted-key-here",
    "scopes": ["https://www.googleapis.com/auth/drive.readonly"],
    "client_email": "your-service-account@your-project.iam.gserviceaccount.com"
  }'::jsonb,
  'your-google-drive-folder-id-here',
  true
) ON CONFLICT (name, organization_id) DO UPDATE SET
  auth_type = EXCLUDED.auth_type,
  auth_config = EXCLUDED.auth_config,
  google_drive_folder_id = EXCLUDED.google_drive_folder_id,
  is_active = EXCLUDED.is_active,
  updated_at = now();
```

### 5. Deploy MCP Server

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Deploy to Railway:**
   ```bash
   # If using GitHub integration (recommended)
   git add .
   git commit -m "Add organization-based Google Drive MCP authentication"
   git push origin main
   ```

3. **Verify deployment:**
   ```bash
   curl https://mcp-servers-production-c189.up.railway.app/health
   ```

### 6. Test Configuration

1. **Check organization config:**
   ```bash
   curl https://mcp-servers-production-c189.up.railway.app/config/your-organization-id
   ```

2. **Test MCP server:**
   ```bash
   curl https://mcp-servers-production-c189.up.railway.app/test
   ```

## 🔍 Troubleshooting

### Common Issues

1. **"Google Drive not configured for organization"**
   - Verify organization ID is correct
   - Check that MCP server record exists in database
   - Ensure `is_active` is `true`

2. **"Service account authentication failed"**
   - Verify service account key is valid
   - Check that Google Drive API is enabled
   - Ensure service account has Drive permissions

3. **"Encryption key error"**
   - Verify `MCP_ENCRYPTION_KEY` is exactly 32 characters
   - Ensure same key is used for encryption and decryption

4. **"Supabase connection error"**
   - Verify `SUPABASE_URL` and `SUPABASE_ANON_KEY`
   - Check Supabase service status

### Debug Commands

```bash
# Check MCP server logs
railway logs

# Test Supabase connection
curl -X GET "https://your-project.supabase.co/rest/v1/mcp_servers?select=*" \
  -H "apikey: your_anon_key" \
  -H "Authorization: Bearer your_anon_key"

# Verify service account key
node -e "
const fs = require('fs');
const key = JSON.parse(fs.readFileSync('path/to/service-account.json'));
console.log('Service account:', key.client_email);
console.log('Project ID:', key.project_id);
"
```

## 🔒 Security Best Practices

1. **Service Account Keys**
   - Store keys securely (encrypted in database)
   - Use minimal permissions (read-only for Drive)
   - Rotate keys regularly

2. **Encryption**
   - Use a strong 32-character encryption key
   - Store encryption key securely
   - Never commit keys to version control

3. **Access Control**
   - Use organization-specific folders
   - Implement proper user authentication
   - Monitor access logs

## 📊 Monitoring

1. **Check MCP server health:**
   ```bash
   curl https://mcp-servers-production-c189.up.railway.app/health
   ```

2. **Monitor Railway logs:**
   ```bash
   railway logs --service mcp-servers
   ```

3. **Check Supabase logs:**
   - Go to Supabase Dashboard > Logs
   - Monitor database queries and errors

## 🚀 Next Steps

1. **Test Google Drive access** in your chatbot
2. **Add more organizations** using the same process
3. **Implement additional MCP tools** as needed
4. **Set up monitoring and alerting**

## 📞 Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review Railway and Supabase logs
3. Verify all environment variables are set correctly
4. Test with a simple Google Drive folder first

---

**🎉 Congratulations!** Your Google Drive MCP integration is now ready to use with organization-based authentication. 