# 🔧 Railway Deployment Troubleshooting

## Common Issues and Solutions

### 1. Health Check Failure

**Problem:** Deployment fails during health check phase

**Solutions:**
- ✅ **Use the simplified Dockerfile**: `Dockerfile.railway`
- ✅ **Remove health check from Railway config** (already done)
- ✅ **Increase timeout**: Set to 600 seconds
- ✅ **Check environment variables**: Ensure all required vars are set

### 2. Build Failures

**Problem:** Build process fails

**Solutions:**
- ✅ **Check Node.js version**: Ensure using Node 18+
- ✅ **Verify package.json**: All dependencies should be correct
- ✅ **Check Dockerfile**: Use `Dockerfile.railway` for Railway

### 3. Environment Variable Issues

**Problem:** App starts but doesn't work properly

**Required Environment Variables:**
```env
# JWT Configuration (generate with: openssl rand -base64 32)
JWT_SECRET=your-generated-jwt-secret
JWT_REFRESH_SECRET=your-generated-refresh-secret

# AI Model API Keys (at least one required)
OPENAI_API_KEY=your-openai-api-key
ANTHROPIC_API_KEY=your-anthropic-api-key

# CORS Configuration (your ScaleWize AI domain)
CORS_ORIGINS=https://your-scaleWize-app.vercel.app

# Database Configuration
MEILI_MASTER_KEY=your-generated-meili-key
```

### 4. Database Connection Issues

**Problem:** Can't connect to databases

**Solutions:**
- ✅ **Add MongoDB service** in Railway
- ✅ **Add PostgreSQL service** in Railway
- ✅ **Check connection strings** in environment variables

## Step-by-Step Fix for Health Check Issues

### Step 1: Update Railway Configuration

1. **Go to Railway Dashboard**
2. **Select your project**
3. **Go to "Settings" tab**
4. **Under "Health Check":**
   - **Disable health check** (uncheck the box)
   - **Or set timeout to 600 seconds**

### Step 2: Redeploy

1. **Go to "Deployments" tab**
2. **Click "Redeploy"**
3. **Wait for build to complete**

### Step 3: Manual Health Check

After deployment, test manually:
```bash
curl https://your-app.railway.app/api/health
```

## Alternative Deployment Methods

### Option 1: Disable Health Check Completely

In Railway dashboard:
1. **Settings** → **Health Check**
2. **Uncheck "Enable Health Check"**
3. **Redeploy**

### Option 2: Use Railway CLI

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Deploy without health check
railway up --no-healthcheck
```

### Option 3: Manual Deployment

1. **Build locally:**
   ```bash
   docker build -f Dockerfile.railway -t librechat .
   ```

2. **Push to Railway:**
   ```bash
   railway up
   ```

## Debugging Commands

### Check Logs
```bash
# View Railway logs
railway logs

# Or in Railway dashboard:
# Deployments → Click deployment → View logs
```

### Test Locally
```bash
# Test the Dockerfile locally
docker build -f Dockerfile.railway -t librechat .
docker run -p 3080:3080 librechat
```

### Check Environment Variables
```bash
# In Railway dashboard:
# Variables tab → Verify all required variables are set
```

## Common Error Messages

### "Healthcheck failure"
- **Solution**: Disable health check in Railway settings

### "Build failed"
- **Solution**: Check logs for specific error, usually missing dependencies

### "Connection refused"
- **Solution**: Check environment variables and database connections

### "Port already in use"
- **Solution**: Ensure only one service is using port 3080

## Success Indicators

✅ **Deployment successful** when you see:
- Build completes without errors
- Service shows "Running" status
- Health check passes (if enabled)
- Can access `https://your-app.railway.app/api/health`

## Next Steps After Successful Deployment

1. **Test the API:**
   ```bash
   curl https://your-app.railway.app/api/health
   ```

2. **Update ScaleWize AI:**
   - Add environment variables in Vercel
   - Test the integration

3. **Monitor logs:**
   - Check Railway logs for any issues
   - Set up monitoring if needed

---

**Need more help?** Check the Railway logs for specific error messages and share them for more targeted assistance. 