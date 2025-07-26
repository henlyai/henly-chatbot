# 🚂 Railway Deployment Guide for LibreChat

## Prerequisites
- GitHub account
- Railway account (free tier available)
- AI model API keys (OpenAI, Anthropic, etc.)

## Step 1: Set Up Railway

1. **Go to [Railway.app](https://railway.app)**
2. **Sign up/Login with GitHub**
3. **Click "New Project"**
4. **Select "Deploy from GitHub repo"**
5. **Choose your `scalewize-production-chatbot` repository**

## Step 2: Configure Environment Variables

In your Railway project dashboard:

1. **Go to "Variables" tab**
2. **Add these environment variables:**

```env
# Required: JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-here
JWT_REFRESH_SECRET=your-super-secret-refresh-key-here

# Required: AI Model API Keys (at least one)
OPENAI_API_KEY=your-openai-api-key-here
ANTHROPIC_API_KEY=your-anthropic-api-key-here

# Required: Database Configuration
MONGO_URI=mongodb://mongodb:27017/LibreChat
MEILI_MASTER_KEY=your-meili-master-key-here

# Required: CORS Configuration
CORS_ORIGINS=https://your-scaleWize-app.vercel.app

# Optional: Additional Configuration
LOG_LEVEL=info
ENABLE_USAGE_TRACKING=true
```

## Step 3: Add Databases

1. **Click "New" → "Database"**
2. **Add MongoDB:**
   - Service: MongoDB
   - Name: `librechat-mongodb`
3. **Add PostgreSQL (for RAG):**
   - Service: PostgreSQL
   - Name: `librechat-postgres`

## Step 4: Deploy

1. **Railway will automatically detect the Dockerfile**
2. **Click "Deploy"**
3. **Wait for build to complete (5-10 minutes)**

## Step 5: Get Your Domain

1. **Go to "Settings" tab**
2. **Copy your Railway domain** (e.g., `https://your-app.railway.app`)
3. **This is your LibreChat URL**

## Step 6: Update ScaleWize AI

In your **Vercel Dashboard** → **ScaleWize AI Project** → **Settings** → **Environment Variables**:

```env
NEXT_PUBLIC_LIBRECHAT_URL=https://your-app.railway.app
LIBRECHAT_JWT_SECRET=your-jwt-secret-from-railway
```

## Step 7: Test Integration

1. **Visit your ScaleWize AI dashboard**
2. **Go to AI Chatbot page**
3. **Verify the iframe loads LibreChat correctly**

## 🛠️ Railway Management

### View Logs
- Go to Railway dashboard → Your project → "Deployments" tab
- Click on any deployment to view logs

### Update Environment Variables
- Go to "Variables" tab
- Edit any variable and Railway will redeploy automatically

### Redeploy
- Go to "Deployments" tab
- Click "Redeploy" button

### Monitor Usage
- Railway shows resource usage in the dashboard
- Free tier includes $5 credit monthly

## 🔧 Troubleshooting

### Build Fails
- Check logs in Railway dashboard
- Verify all environment variables are set
- Ensure Dockerfile path is correct

### Connection Issues
- Verify CORS_ORIGINS includes your ScaleWize AI domain
- Check that JWT_SECRET matches between services

### Database Issues
- Ensure MongoDB and PostgreSQL services are running
- Check connection strings in environment variables

## 💰 Pricing

- **Free Tier**: $5 credit monthly
- **Pro Plan**: $20/month for more resources
- **Pay-as-you-go**: Only pay for what you use

## 🎉 Success!

Your LibreChat instance is now running on Railway and integrated with ScaleWize AI!

---

**Next Steps:**
1. Test the integration thoroughly
2. Set up monitoring and alerts
3. Configure backups for your databases
4. Consider upgrading to Pro plan for production use 