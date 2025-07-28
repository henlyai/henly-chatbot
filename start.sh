#!/bin/sh
echo "Starting LibreChat..."
echo "Waiting for dependencies to be ready..."
sleep 10
echo "Debugging environment variables..."
node debug-env.js
echo "Debugging port configuration..."
echo "PORT env var: $PORT"
echo "Default port would be: 3080"
echo "Starting backend with timeout..."
timeout 60 npm run backend &
BACKEND_PID=$!

echo "Waiting 30 seconds for backend to start..."
sleep 30

echo "Testing server connectivity..."
node test-server.js

echo "Backend process status:"
ps aux | grep node

wait $BACKEND_PID 