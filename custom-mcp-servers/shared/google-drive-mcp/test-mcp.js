#!/usr/bin/env node

/**
 * Test script for Google Drive MCP Server
 * This script tests the various endpoints and functionality
 */

const fetch = require('node-fetch');

const MCP_SERVER_URL = 'https://mcp-servers-production-c189.up.railway.app';
const TEST_USER_ID = 'test-user-123';

async function testEndpoint(endpoint, description) {
  console.log(`\n🧪 Testing: ${description}`);
  console.log(`📍 Endpoint: ${endpoint}`);
  
  try {
    const response = await fetch(endpoint);
    const data = await response.json();
    
    console.log(`✅ Status: ${response.status} ${response.statusText}`);
    console.log(`📄 Response:`, JSON.stringify(data, null, 2));
    
    return { success: true, data };
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function testOAuthInitiate() {
  console.log(`\n🧪 Testing: OAuth Initiation`);
  console.log(`📍 Endpoint: ${MCP_SERVER_URL}/oauth/initiate?userId=${TEST_USER_ID}`);
  
  try {
    const response = await fetch(`${MCP_SERVER_URL}/oauth/initiate?userId=${TEST_USER_ID}`);
    const data = await response.json();
    
    console.log(`✅ Status: ${response.status} ${response.statusText}`);
    console.log(`📄 Response:`, JSON.stringify(data, null, 2));
    
    if (data.auth_url) {
      console.log(`🔗 OAuth URL: ${data.auth_url}`);
      console.log(`💡 You can visit this URL to test the OAuth flow`);
    }
    
    return { success: true, data };
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function testOAuthStatus() {
  console.log(`\n🧪 Testing: OAuth Status Check`);
  console.log(`📍 Endpoint: ${MCP_SERVER_URL}/oauth/status/${TEST_USER_ID}`);
  
  try {
    const response = await fetch(`${MCP_SERVER_URL}/oauth/status/${TEST_USER_ID}`);
    const data = await response.json();
    
    console.log(`✅ Status: ${response.status} ${response.statusText}`);
    console.log(`📄 Response:`, JSON.stringify(data, null, 2));
    
    return { success: true, data };
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function runTests() {
  console.log('🚀 Starting Google Drive MCP Server Tests');
  console.log('=' .repeat(50));
  
  // Test basic endpoints
  await testEndpoint(`${MCP_SERVER_URL}/health`, 'Health Check');
  await testEndpoint(`${MCP_SERVER_URL}/test`, 'Test Endpoint');
  
  // Test OAuth endpoints
  await testOAuthInitiate();
  await testOAuthStatus();
  
  console.log('\n' + '=' .repeat(50));
  console.log('✅ All tests completed!');
  console.log('\n📋 Next Steps:');
  console.log('1. If OAuth initiation works, visit the provided auth_url');
  console.log('2. Complete the Google OAuth flow');
  console.log('3. Check the OAuth status again');
  console.log('4. Test the MCP tools in LibreChat');
}

// Run the tests
runTests().catch(console.error); 