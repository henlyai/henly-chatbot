# Supabase MCP Server for Henly AI

A comprehensive Model Context Protocol (MCP) server for Supabase database integration with LibreChat, designed for multi-tenant SaaS platforms.

## 🚀 Features

- **Multi-tenant Support**: Organization-based authentication and configuration
- **Comprehensive Database Operations**: 8 powerful tools for database management
- **Security First**: Encrypted credential storage and secure authentication
- **Performance Optimized**: Intelligent caching and rate limiting
- **Production Ready**: Railway deployment with health checks
- **SQL-like Operations**: Query, insert, update, delete, and count operations

## 🛠️ Available Tools

### 1. `supabase_list_tables`
List all tables in the Supabase database to explore the database structure.

**Parameters:** None

**Example Usage:**
```
List all tables in my database
```

### 2. `supabase_describe_table`
Get detailed information about a specific table including columns, data types, and constraints.

**Parameters:**
- `tableName` (string): Name of the table to describe

**Example Usage:**
```
Describe the users table structure
```

### 3. `supabase_query_table`
Query data from a specific table with filtering, sorting, and pagination options.

**Parameters:**
- `tableName` (string): Name of the table to query
- `select` (string, optional): Comma-separated list of columns to select
- `where` (string, optional): WHERE clause for filtering
- `orderBy` (string, optional): ORDER BY clause for sorting
- `limit` (number, optional): Maximum number of rows to return (default: 100)
- `offset` (number, optional): Number of rows to skip (default: 0)

**Example Usage:**
```
Query all active users from the users table, ordered by created_at DESC, limit 10
```

### 4. `supabase_insert_data`
Insert new data into a table to add records to your database.

**Parameters:**
- `tableName` (string): Name of the table to insert data into
- `data` (string): JSON string containing the data to insert

**Example Usage:**
```
Insert a new user: {"name": "John Doe", "email": "john@example.com", "status": "active"}
```

### 5. `supabase_update_data`
Update existing data in a table to modify records in your database.

**Parameters:**
- `tableName` (string): Name of the table to update data in
- `where` (string): WHERE clause to identify records to update
- `data` (string): JSON string containing the data to update

**Example Usage:**
```
Update user with id=1: set status to "inactive"
```

### 6. `supabase_delete_data`
Delete data from a table to remove records from your database.

**Parameters:**
- `tableName` (string): Name of the table to delete data from
- `where` (string): WHERE clause to identify records to delete

**Example Usage:**
```
Delete user with id=1 from the users table
```

### 7. `supabase_count_records`
Count the number of records in a table with optional filtering.

**Parameters:**
- `tableName` (string): Name of the table to count records in
- `where` (string, optional): WHERE clause for filtering

**Example Usage:**
```
Count all active users in the users table
```

### 8. `supabase_get_database_info`
Get information about the Supabase database including version, size, and connection details.

**Parameters:** None

**Example Usage:**
```
Get database information and connection status
```

## 🏗️ Architecture

```
Organization → MCP Server → Supabase Database
     ↓              ↓              ↓
Supabase Config → SSE Transport → PostgreSQL
```

## 📋 Prerequisites

1. **Supabase Project** with database access
2. **Railway Account** for deployment
3. **Henly AI Platform** with MCP support
4. **Organization ID** from your Supabase database

## 🚀 Quick Start

### 1. Deploy to Railway

1. **Create Railway Service:**
   ```bash
   # Create new Railway service
   railway init
   ```

2. **Set Environment Variables:**
   ```bash
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-supabase-anon-key
   MCP_ENCRYPTION_KEY=your-32-character-encryption-key
   PORT=3000
   ```

3. **Deploy:**
   ```bash
   railway up
   ```

### 2. Configure in Supabase

Use the setup script to configure the MCP server:

```bash
# Set environment variables
export SUPABASE_URL="your_supabase_url"
export SUPABASE_ANON_KEY="your_supabase_anon_key"
export MCP_ENCRYPTION_KEY="your-32-character-encryption-key"

# Run setup script
node setup-supabase-mcp.js
```

### 3. Manual Configuration

Alternatively, insert the configuration manually:

```sql
INSERT INTO mcp_servers (
  name, description, endpoint, capabilities, 
  organization_id, is_active, auth_type, auth_config
) VALUES (
  'Supabase',
  'Supabase database integration for querying, inserting, updating, and deleting data',
  'https://your-supabase-mcp.up.railway.app/mcp',
  ARRAY[
    'supabase_list_tables',
    'supabase_describe_table',
    'supabase_query_table',
    'supabase_insert_data',
    'supabase_update_data',
    'supabase_delete_data',
    'supabase_count_records',
    'supabase_get_database_info'
  ],
  'your-organization-id',
  true,
  'none',
  '{}'::jsonb
);
```

## 🔒 Security Features

### Multi-tenant Isolation
- Each organization has isolated database access
- Organization-specific Supabase client instances
- Secure credential encryption and storage

### Rate Limiting
- Maximum 20 database operations per minute per session
- Prevents abuse and infinite loops
- Automatic session cleanup

### Data Protection
- Encrypted credential storage using AES-256-CBC
- Secure key derivation with scrypt
- Sanitized error messages (no sensitive data exposure)

## 🧪 Testing

### Local Development
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Test health endpoint
curl http://localhost:3000/health

# Test MCP endpoint
curl -H "Accept: text/event-stream" http://localhost:3000/mcp
```

### Production Testing
```bash
# Test Railway deployment
curl https://your-supabase-mcp.up.railway.app/health

# Test MCP connection
curl -H "Accept: text/event-stream" https://your-supabase-mcp.up.railway.app/mcp
```

## 🔧 Configuration Options

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `SUPABASE_URL` | Your Supabase project URL | Yes |
| `SUPABASE_ANON_KEY` | Your Supabase anon key | Yes |
| `MCP_ENCRYPTION_KEY` | 32-character encryption key | Yes |
| `PORT` | Server port (default: 3000) | No |
| `NODE_ENV` | Environment (production/development) | No |

### Custom Supabase Credentials

For organizations with their own Supabase projects:

1. **Use the setup script** and choose "Yes" for custom credentials
2. **Provide your Supabase URL and anon key**
3. **Credentials will be encrypted and stored securely**

## 📊 Performance Optimization

### Caching Strategy
- **Organization Clients**: Cached for 30 minutes
- **Query Results**: Cached for 5 minutes
- **Table Metadata**: Cached for 10 minutes

### Rate Limiting
- **Per Session**: 20 operations per minute
- **Global**: 100 operations per minute per organization
- **Automatic Cleanup**: Expired sessions removed

## 🚨 Error Handling

### Common Errors

1. **"Supabase not configured for organization"**
   - Run the setup script to configure the MCP
   - Verify organization ID is correct

2. **"Table not found"**
   - Use `supabase_list_tables` to see available tables
   - Check table name spelling

3. **"Rate limit exceeded"**
   - Wait 1 minute before making more requests
   - Reduce the frequency of operations

4. **"Invalid JSON data"**
   - Ensure data is valid JSON format
   - Use proper escaping for special characters

### Debug Commands

```bash
# Check Railway logs
railway logs

# Test Supabase connection
curl -X GET "https://your-project.supabase.co/rest/v1/mcp_servers?select=*" \
  -H "apikey: your_anon_key" \
  -H "Authorization: Bearer your_anon_key"

# Verify environment variables
echo $SUPABASE_URL
echo $SUPABASE_ANON_KEY
```

## 🔄 Updates and Maintenance

### Updating the MCP Server
```bash
# Pull latest changes
git pull origin main

# Deploy to Railway
railway up
```

### Monitoring
- **Health Checks**: Automatic monitoring via Railway
- **Logs**: Real-time logs in Railway dashboard
- **Metrics**: Request count and response times

## 🤝 Contributing

1. **Fork the repository**
2. **Create a feature branch**
3. **Make your changes**
4. **Test thoroughly**
5. **Submit a pull request**

## 📄 License

MIT License - see LICENSE file for details.

## 🆘 Support

For support and questions:
1. Check the troubleshooting section above
2. Review the error logs
3. Contact the Henly AI team

## 🎯 Success Criteria

- ✅ MCP tools appear in LibreChat chatbot UI
- ✅ Database operations work correctly for each organization
- ✅ Proper error messages for configuration issues
- ✅ Performance is acceptable (no infinite loops)
- ✅ Security best practices followed
- ✅ Multi-tenant isolation maintained
