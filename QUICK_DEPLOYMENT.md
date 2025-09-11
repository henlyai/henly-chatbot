# 🚀 Quick LibreChat Deployment Guide

## Prerequisites
- Docker and Docker Compose installed
- API keys for AI models (OpenAI, Anthropic, etc.)
- Domain name for your LibreChat instance

## Step 1: Environment Setup

1. **Copy the environment template:**
   ```bash
   cp env.production.template .env
   ```

2. **Edit `.env` file with your values:**
   ```bash
   nano .env
   ```

   **Required changes:**
   - `OPENAI_API_KEY`: Your OpenAI API key
   - `ANTHROPIC_API_KEY`: Your Anthropic API key (optional)
   - `CORS_ORIGINS`: Your Henly AI domain (e.g., `https://your-app.vercel.app`)

## Step 2: Automated Deployment

Run the deployment script:
```bash
./deploy-production.sh
```

This script will:
- ✅ Generate secure JWT secrets
- ✅ Create SSL certificates
- ✅ Build and start all services
- ✅ Wait for services to be ready
- ✅ Display deployment information

## Step 3: Update Henly AI Configuration

In your Henly AI Vercel project, add these environment variables:

```env
NEXT_PUBLIC_LIBRECHAT_URL=https://your-librechat-domain.com
LIBRECHAT_JWT_SECRET=your-jwt-secret-from-env-file
```

## Step 4: Test Integration

1. **Check LibreChat health:**
   ```bash
   curl https://your-domain.com/api/health
   ```

2. **Test from Henly AI:**
   - Visit your Henly AI dashboard
   - Navigate to the AI Chatbot page
   - Verify the iframe loads correctly

## 🛠️ Management Commands

```bash
# View logs
docker-compose -f deploy-compose.yml logs -f

# Stop services
docker-compose -f deploy-compose.yml down

# Restart services
docker-compose -f deploy-compose.yml restart

# Update and redeploy
git pull
docker-compose -f deploy-compose.yml up -d --build
```

## 🔧 Troubleshooting

### Common Issues:

1. **Port 3080 already in use:**
   ```bash
   sudo lsof -ti:3080 | xargs kill -9
   ```

2. **Docker permission issues:**
   ```bash
   sudo usermod -aG docker $USER
   # Log out and back in
   ```

3. **SSL certificate issues:**
   ```bash
   rm -rf ssl/
   ./deploy-production.sh
   ```

### Check Service Status:
```bash
# Check all containers
docker-compose -f deploy-compose.yml ps

# Check specific service logs
docker-compose -f deploy-compose.yml logs api
```

## 📞 Support

If you encounter issues:
1. Check the logs: `docker-compose -f deploy-compose.yml logs -f`
2. Verify environment variables are set correctly
3. Ensure your domain is accessible and SSL certificates are valid
4. Check that CORS_ORIGINS includes your Henly AI domain

---

**🎉 You're all set!** Your LibreChat instance should now be running and integrated with Henly AI. 