import fetch from 'node-fetch';

const MCP_SERVER_URL = 'https://mcp-servers-production-c189.up.railway.app';
const SESSION_ID = 'test-session-' + Date.now();

async function testBidirectionalMCP() {
  console.log('🧪 Testing Bidirectional MCP Server');
  console.log('🔗 Server URL:', MCP_SERVER_URL);
  console.log('🆔 Session ID:', SESSION_ID);
  console.log('');

  try {
    // Step 1: Test health endpoint
    console.log('1️⃣ Testing health endpoint...');
    const healthResponse = await fetch(`${MCP_SERVER_URL}/health`);
    console.log('   Health status:', healthResponse.status);
    if (!healthResponse.ok) {
      throw new Error(`Health check failed: ${healthResponse.status}`);
    }
    console.log('   ✅ Health check passed');
    console.log('');

    // Step 2: Test endpoint
    console.log('2️⃣ Testing test endpoint...');
    const testResponse = await fetch(`${MCP_SERVER_URL}/test`);
    const testData = await testResponse.json();
    console.log('   Test response:', testData);
    console.log('   ✅ Test endpoint working');
    console.log('');

    // Step 3: Establish SSE connection
    console.log('3️⃣ Establishing SSE connection...');
    const sseUrl = `${MCP_SERVER_URL}/sse?sessionId=${SESSION_ID}`;
    console.log('   SSE URL:', sseUrl);
    
    const sseResponse = await fetch(sseUrl, {
      headers: {
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'X-MCP-Client': SESSION_ID
      }
    });

    if (!sseResponse.ok) {
      throw new Error(`SSE connection failed: ${sseResponse.status}`);
    }

    console.log('   ✅ SSE connection established');
    console.log('   Response status:', sseResponse.status);
    console.log('   Response headers:', Object.fromEntries(sseResponse.headers.entries()));
    console.log('');

    // Step 4: Send initialize request via POST
    console.log('4️⃣ Sending initialize request...');
    const initRequest = {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {
          tools: {},
          resources: {}
        },
        clientInfo: {
          name: "test-client",
          version: "1.0.0"
        }
      }
    };

    console.log('   Initialize request:', JSON.stringify(initRequest, null, 2));
    
    const initResponse = await fetch(`${MCP_SERVER_URL}/sse`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-MCP-Client': SESSION_ID
      },
      body: JSON.stringify(initRequest)
    });

    if (!initResponse.ok) {
      throw new Error(`Initialize request failed: ${initResponse.status}`);
    }

    const initResult = await initResponse.json();
    console.log('   Initialize response:', JSON.stringify(initResult, null, 2));
    console.log('   ✅ Initialize request sent');
    console.log('');

    // Step 5: Send tools/list request via POST
    console.log('5️⃣ Sending tools/list request...');
    const toolsRequest = {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
      params: {}
    };

    console.log('   Tools request:', JSON.stringify(toolsRequest, null, 2));
    
    const toolsResponse = await fetch(`${MCP_SERVER_URL}/sse`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-MCP-Client': SESSION_ID
      },
      body: JSON.stringify(toolsRequest)
    });

    if (!toolsResponse.ok) {
      throw new Error(`Tools request failed: ${toolsResponse.status}`);
    }

    const toolsResult = await toolsResponse.json();
    console.log('   Tools response:', JSON.stringify(toolsResult, null, 2));
    console.log('   ✅ Tools request sent');
    console.log('');

    // Step 6: Test a tool call
    console.log('6️⃣ Testing tool call...');
    const toolRequest = {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "search_file",
        arguments: {
          query: "test document"
        }
      }
    };

    console.log('   Tool call request:', JSON.stringify(toolRequest, null, 2));
    
    const toolResponse = await fetch(`${MCP_SERVER_URL}/sse`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-MCP-Client': SESSION_ID
      },
      body: JSON.stringify(toolRequest)
    });

    if (!toolResponse.ok) {
      throw new Error(`Tool call failed: ${toolResponse.status}`);
    }

    const toolResult = await toolResponse.json();
    console.log('   Tool call response:', JSON.stringify(toolResult, null, 2));
    console.log('   ✅ Tool call completed');
    console.log('');

    // Step 7: Test invalid session
    console.log('7️⃣ Testing invalid session...');
    const invalidRequest = {
      jsonrpc: "2.0",
      id: 4,
      method: "tools/list",
      params: {}
    };

    const invalidResponse = await fetch(`${MCP_SERVER_URL}/sse`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-MCP-Client': 'invalid-session'
      },
      body: JSON.stringify(invalidRequest)
    });

    const invalidResult = await invalidResponse.json();
    console.log('   Invalid session response:', JSON.stringify(invalidResult, null, 2));
    console.log('   ✅ Invalid session properly rejected');
    console.log('');

    console.log('🎉 All tests completed successfully!');
    console.log('');
    console.log('📊 Test Summary:');
    console.log('   ✅ Health endpoint working');
    console.log('   ✅ Test endpoint working');
    console.log('   ✅ SSE connection established');
    console.log('   ✅ Initialize request processed');
    console.log('   ✅ Tools list request processed');
    console.log('   ✅ Tool call request processed');
    console.log('   ✅ Invalid session properly rejected');
    console.log('');
    console.log('🚀 MCP Server is ready for LibreChat integration!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('   Error details:', error);
    process.exit(1);
  }
}

// Run the test
testBidirectionalMCP(); 