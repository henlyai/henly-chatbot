# 🚨 Quick Fix for Railway Health Check Failure

## Immediate Steps to Fix the Issue

### Step 1: Disable Health Check in Railway Dashboard

1. **Go to Railway Dashboard**
2. **Select your LibreChat project**
3. **Go to "Settings" tab**
4. **Scroll down to "Health Check" section**
5. **Uncheck "Enable Health Check"** (this is the most important step!)
6. **Click "Save"**

### Step 2: Redeploy

1. **Go to "Deployments" tab**
2. **Click "Redeploy"**
3. **Wait for build to complete**

### Step 3: Check if Service is Running

After deployment:
1. **Go to "Deployments" tab**
2. **Click on the latest deployment**
3. **Check the logs** - you should see:
   ```
   Starting LibreChat...
   Waiting for dependencies to be ready...
   Starting backend...
   ```

## Why This Happens

LibreChat takes time to:
- Initialize databases
- Load AI models
- Start all services

Railway's default health check timeout is too short for LibreChat's startup process.

## Alternative: Manual Health Check

If you want to keep health checks:

1. **In Railway Settings:**
   - Set **Health Check Path** to: `/api/health`
   - Set **Timeout** to: `600` seconds (10 minutes)
   - Set **Interval** to: `60` seconds

2. **Redeploy**

## Environment Variables Required

Make sure you have these in Railway:

```env
JWT_SECRET=your-generated-jwt-secret
JWT_REFRESH_SECRET=your-generated-refresh-secret
OPENAI_API_KEY=your-openai-key
CORS_ORIGINS=https://your-scaleWize-app.vercel.app
MEILI_MASTER_KEY=your-generated-meili-key
```

## Generate Required Secrets

```bash
# Generate JWT secrets
openssl rand -base64 32
openssl rand -base64 32

# Generate MeiliSearch key
openssl rand -base64 32
```

## Success Indicators

✅ **Deployment successful** when:
- Build completes without errors
- Service shows "Running" status
- Logs show "Starting backend..."
- Can access `https://your-app.railway.app/api/health`

## Next Steps After Fix

1. **Test the API:**
   ```bash
   curl https://your-app.railway.app/api/health
   ```

2. **Update Henly AI environment variables:**
   - Add `LIBRECHAT_URL=https://your-app.railway.app`
   - Add `LIBRECHAT_JWT_SECRET=your-jwt-secret`

3. **Test the integration**

---

**The key is disabling health check in Railway settings!** 🎯 