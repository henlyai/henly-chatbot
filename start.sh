#!/bin/sh
echo "Starting LibreChat..."
echo "Waiting for dependencies to be ready..."
sleep 10
echo "Debugging environment variables..."
node debug-env.js
echo "Debugging port configuration..."
echo "PORT env var: $PORT"
echo "Default port would be: 3080"
echo "Debugging librechat.yaml..."
ls -la /app/librechat.yaml || echo "librechat.yaml not found at runtime"
cat /app/librechat.yaml | head -3 || echo "Failed to read librechat.yaml at runtime"

echo "Testing configuration loading..."
node test-config.js
echo "Starting backend..."
npm run backend &
BACKEND_PID=$!

echo "Waiting 30 seconds for backend to start..."
sleep 30

echo "Testing server connectivity..."
node test-server.js

echo "Backend process status:"
ps aux | grep node

echo "Testing health endpoint directly..."
curl -f http://localhost:8080/health || echo "Health endpoint failed"

echo "Backend started successfully. Keeping container alive..."
wait $BACKEND_PID 