# LibreChat Deployment Guide for ScaleWize AI

This guide covers the complete setup and deployment of LibreChat for integration with the ScaleWize AI platform.

## 🏗️ Architecture Overview

```
ScaleWize AI (Next.js) → LibreChat (Multi-tenant) → AI Models
     ↓                        ↓                        ↓
Supabase Auth          JWT Authentication        OpenAI/Claude/etc.
     ↓                        ↓                        ↓
User Management        Organization Context      AI Responses
```

## 📋 Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for development)
- Git
- API keys for AI models (OpenAI, Anthropic, etc.)
- Supabase project (for ScaleWize AI)

## 🚀 Local Development Setup

### Step 1: Environment Configuration

1. **Copy environment template:**
   ```bash
   cp .env.example .env
   ```

2. **Update `.env` with your configuration:**
   ```env
   # Required: JWT Configuration
   JWT_SECRET=your-super-secret-jwt-key-here
   JWT_REFRESH_SECRET=your-super-secret-refresh-key-here
   
   # Required: AI Model API Keys
   OPENAI_API_KEY=your-openai-api-key-here
   ANTHROPIC_API_KEY=your-anthropic-api-key-here
   
   # Required: Database Configuration
   MONGO_URI=mongodb://mongodb:27017/LibreChat
   MEILI_MASTER_KEY=your-meili-master-key-here
   
   # Optional: Additional AI Models
   GOOGLE_API_KEY=your-google-api-key-here
   ```

3. **Update `librechat.yaml` for multi-tenant setup:**
   ```yaml
   # Enable multi-tenant features
   organizations:
     enabled: true
     defaultPlan: "starter"
   
   # Enable JWT authentication
   jwt:
     enabled: true
     secret: "${JWT_SECRET}"
     refreshSecret: "${JWT_REFRESH_SECRET}"
   
   # Disable default registration
   registration:
     enabled: false
   ```

### Step 2: Start Services

1. **Run the setup script:**
   ```bash
   ./setup-scalewize.sh
   ```

2. **Or manually start services:**
   ```bash
   # Set user permissions
   export UID=$(id -u)
   export GID=$(id -g)
   
   # Start services
   docker-compose up -d
   ```

3. **Verify services are running:**
   ```bash
   # Check LibreChat API
   curl http://localhost:3080/api/health
   
   # Check MongoDB
   docker-compose exec mongodb mongosh --eval "db.adminCommand('ping')"
   
   # Check Meilisearch
   curl http://localhost:7700/health
   ```

### Step 3: Integration Testing

1. **Update ScaleWize AI configuration:**
   ```env
   # In scalewize-website/.env.local
   NEXT_PUBLIC_LIBRECHAT_URL=http://localhost:3080
   LIBRECHAT_JWT_SECRET=your-super-secret-jwt-key-here
   ```

2. **Test the integration:**
   - Start ScaleWize AI: `cd ../scalewize-website && npm run dev`
   - Visit: http://localhost:3000/dashboard/chatbot
   - Verify iframe loads LibreChat correctly

## 🌐 Production Deployment

### Option 1: Vercel Deployment (Recommended)

1. **Prepare for Vercel:**
   ```bash
   # Create vercel.json
   cat > vercel.json << EOF
   {
     "version": 2,
     "builds": [
       {
         "src": "api/server/index.js",
         "use": "@vercel/node"
       }
     ],
     "routes": [
       {
         "src": "/api/(.*)",
         "dest": "/api/server/index.js"
       },
       {
         "src": "/(.*)",
         "dest": "/client/build/$1"
       }
     ],
     "env": {
       "NODE_ENV": "production"
     }
   }
   EOF
   ```

2. **Deploy to Vercel:**
   ```bash
   # Install Vercel CLI
   npm i -g vercel
   
   # Deploy
   vercel --prod
   ```

3. **Configure environment variables in Vercel:**
   - Go to Vercel Dashboard → Your Project → Settings → Environment Variables
   - Add all variables from your `.env` file

### Option 2: Railway Deployment

1. **Connect to Railway:**
   ```bash
   # Install Railway CLI
   npm i -g @railway/cli
   
   # Login and deploy
   railway login
   railway init
   railway up
   ```

2. **Configure environment variables in Railway:**
   - Go to Railway Dashboard → Your Project → Variables
   - Add all required environment variables

### Option 3: Docker Deployment

1. **Build production image:**
   ```bash
   docker build -t scalewize-librechat .
   ```

2. **Run with production compose:**
   ```bash
   docker-compose -f deploy-compose.yml up -d
   ```

## 🔧 Configuration

### Multi-Tenant Setup

1. **Organization Configuration:**
   ```yaml
   # In librechat.yaml
   organizations:
     enabled: true
     defaultPlan: "starter"
     plans:
       starter:
         maxTokens: 10000
         models: ["gpt-3.5-turbo"]
       professional:
         maxTokens: 100000
         models: ["gpt-4", "claude-3-sonnet"]
       enterprise:
         maxTokens: 1000000
         models: ["gpt-4-turbo", "claude-3-opus"]
   ```

2. **JWT Token Structure:**
   ```json
   {
     "sub": "user-id",
     "email": "user@company.com",
     "organization": {
       "id": "org-id",
       "name": "Company Name",
       "domain": "company-domain",
       "plan_type": "professional"
     },
     "iat": 1234567890,
     "exp": 1234654290
   }
   ```

### MCP Servers Configuration

1. **Add MCP servers to `librechat.yaml`:**
   ```yaml
   mcpServers:
     filesystem:
       command: npx
       args:
         - -y
         - "@modelcontextprotocol/server-filesystem"
         - /home/user/LibreChat/
     everything:
       url: http://localhost:3001/sse
       timeout: 60000
   ```

2. **Organization-specific MCP servers:**
   ```typescript
   // In ScaleWize AI
   const mcpServers = {
     "acme-corp": [
       {
         name: "Acme CRM",
         endpoint: "https://acme-crm.internal/api/mcp",
         capabilities: ["read_customers", "update_leads"]
       }
     ]
   }
   ```

### Knowledge Base Setup

1. **Enable vector search:**
   ```yaml
   # In librechat.yaml
   knowledgeBases:
     enabled: true
     vectorDimensions: 1536
     embeddingModel: "text-embedding-ada-002"
   ```

2. **Add knowledge bases per organization:**
   ```sql
   -- In Supabase
   INSERT INTO knowledge_bases (name, organization_id, type)
   VALUES ('Company Documentation', 'org-id', 'documentation');
   ```

## 🔒 Security Configuration

### JWT Security

1. **Generate secure secrets:**
   ```bash
   # Generate JWT secret
   openssl rand -base64 32
   
   # Generate refresh secret
   openssl rand -base64 32
   ```

2. **Configure token expiration:**
   ```env
   JWT_ACCESS_TOKEN_EXPIRY=24h
   JWT_REFRESH_TOKEN_EXPIRY=7d
   ```

### CORS Configuration

1. **Update CORS settings:**
   ```env
   CORS_ORIGINS=https://yourdomain.com,https://app.yourdomain.com
   ```

2. **For development:**
   ```env
   CORS_ORIGINS=http://localhost:3000,http://localhost:3080
   ```

### Rate Limiting

1. **Configure rate limits:**
   ```yaml
   # In librechat.yaml
   rateLimits:
     requests:
       windowMs: 900000  # 15 minutes
       max: 100          # limit each IP to 100 requests per windowMs
     fileUploads:
       windowMs: 3600000 # 1 hour
       max: 50           # limit each user to 50 uploads per hour
   ```

## 📊 Monitoring and Analytics

### Health Checks

1. **API Health Endpoint:**
   ```bash
   curl https://your-librechat-domain.com/api/health
   ```

2. **Database Health:**
   ```bash
   # MongoDB
   docker-compose exec mongodb mongosh --eval "db.adminCommand('ping')"
   
   # PostgreSQL (for RAG)
   docker-compose exec vectordb pg_isready
   ```

### Logging

1. **View logs:**
   ```bash
   # All services
   docker-compose logs -f
   
   # Specific service
   docker-compose logs -f api
   ```

2. **Log levels:**
   ```env
   LOG_LEVEL=info  # debug, info, warn, error
   ```

### Usage Tracking

1. **Enable usage tracking:**
   ```env
   ENABLE_USAGE_TRACKING=true
   USAGE_DATABASE_URL=your-supabase-project-url
   ```

2. **Monitor usage in Supabase:**
   ```sql
   -- Check usage by organization
   SELECT 
     organization_id,
     SUM(tokens_used) as total_tokens,
     COUNT(*) as message_count
   FROM usage_metrics 
   WHERE date >= CURRENT_DATE - INTERVAL '30 days'
   GROUP BY organization_id;
   ```

## 🚀 Scaling Considerations

### Horizontal Scaling

1. **Load Balancer Setup:**
   ```nginx
   # nginx.conf
   upstream librechat_backend {
     server librechat-1:3080;
     server librechat-2:3080;
     server librechat-3:3080;
   }
   
   server {
     listen 80;
     location / {
       proxy_pass http://librechat_backend;
       proxy_set_header Host $host;
       proxy_set_header X-Real-IP $remote_addr;
     }
   }
   ```

2. **Session Stickyness:**
   ```nginx
   upstream librechat_backend {
     sticky cookie srv_id expires=1h domain=.example.com path=/;
     server librechat-1:3080;
     server librechat-2:3080;
   }
   ```

### Database Scaling

1. **MongoDB Replica Set:**
   ```yaml
   # In docker-compose.yml
   mongodb:
     image: mongo:latest
     command: mongod --replSet rs0 --bind_ip_all
     environment:
       MONGO_INITDB_ROOT_USERNAME: admin
       MONGO_INITDB_ROOT_PASSWORD: password
   ```

2. **PostgreSQL with pgvector:**
   ```yaml
   vectordb:
     image: ankane/pgvector:latest
     environment:
       POSTGRES_DB: vectordb
       POSTGRES_USER: vectoruser
       POSTGRES_PASSWORD: vectorpass
   ```

## 🔧 Troubleshooting

### Common Issues

1. **JWT Authentication Fails:**
   ```bash
   # Check JWT secret matches between services
   echo $JWT_SECRET
   echo $LIBRECHAT_JWT_SECRET
   ```

2. **Database Connection Issues:**
   ```bash
   # Check MongoDB
   docker-compose exec mongodb mongosh --eval "db.adminCommand('ping')"
   
   # Check PostgreSQL
   docker-compose exec vectordb pg_isready -U myuser -d mydatabase
   ```

3. **CORS Issues:**
   ```bash
   # Check CORS configuration
   curl -H "Origin: http://localhost:3000" \
        -H "Access-Control-Request-Method: GET" \
        -H "Access-Control-Request-Headers: X-Requested-With" \
        -X OPTIONS http://localhost:3080/api/health
   ```

### Performance Optimization

1. **Enable caching:**
   ```yaml
   # In librechat.yaml
   cache: true
   ```

2. **Optimize database queries:**
   ```sql
   -- Add indexes for performance
   CREATE INDEX idx_usage_metrics_org_date ON usage_metrics(organization_id, date);
   CREATE INDEX idx_chat_sessions_org ON chat_sessions(organization_id);
   ```

3. **Monitor resource usage:**
   ```bash
   # Check container resource usage
   docker stats
   
   # Check disk usage
   docker system df
   ```

## 📚 Additional Resources

- [LibreChat Documentation](https://docs.librechat.ai/)
- [ScaleWize AI Integration Guide](../scalewize-website/LIBRECHAT_SCALING_STRATEGY.md)
- [JWT Authentication Guide](https://jwt.io/introduction)
- [Docker Compose Documentation](https://docs.docker.com/compose/)

## 🆘 Support

For issues and questions:
- Check the troubleshooting section above
- Review LibreChat logs: `docker-compose logs -f`
- Check ScaleWize AI integration logs
- Open an issue in the GitHub repository

---

**Next Steps:**
1. Complete local development setup
2. Test integration with ScaleWize AI
3. Deploy to production
4. Configure monitoring and alerts
5. Set up backup and disaster recovery 