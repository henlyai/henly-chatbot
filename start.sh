#!/bin/sh
echo "Starting LibreChat..."
echo "Waiting for dependencies to be ready..."
sleep 10
echo "Debugging environment variables..."
node debug-env.js
echo "Starting backend..."
npm run backend 