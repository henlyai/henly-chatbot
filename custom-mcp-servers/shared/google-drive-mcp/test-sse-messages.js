import fetch from 'node-fetch';

const MCP_SERVER_URL = 'https://mcp-servers-production-c189.up.railway.app';
const SESSION_ID = 'test-session-' + Date.now();

async function testSSEMessages() {
  console.log('🧪 Testing SSE Message Flow');
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

    // Step 2: Establish SSE connection and listen for messages
    console.log('2️⃣ Establishing SSE connection and listening for messages...');
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
    console.log('   Waiting for messages...');
    console.log('');

    // Read the SSE stream using Node.js events
    let messageCount = 0;
    let initMessageReceived = false;
    let toolsMessageReceived = false;
    let timeoutId;

    // Set up timeout
    timeoutId = setTimeout(() => {
      console.log('   ⏰ Timeout - stopping test');
      sseResponse.body.destroy();
    }, 10000);

    // Listen for data events
    sseResponse.body.on('data', (chunk) => {
      const chunkStr = chunk.toString();
      const lines = chunkStr.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6); // Remove 'data: ' prefix
          if (data.trim() && data.trim() !== ':') {
            try {
              const message = JSON.parse(data);
              messageCount++;
              
              console.log(`   📨 Message ${messageCount}:`, JSON.stringify(message, null, 2));
              
              // Check if this is the initialization message
              if (message.jsonrpc === "2.0" && message.id === 1 && message.result?.protocolVersion) {
                console.log('   ✅ Initialization message received');
                initMessageReceived = true;
              }
              
              // Check if this is the tools list message
              if (message.jsonrpc === "2.0" && message.id === 2 && message.result?.tools) {
                console.log('   ✅ Tools list message received');
                console.log('   🛠️  Tools:', message.result.tools.map(t => t.name));
                toolsMessageReceived = true;
              }
              
              // If we've received both messages, we can stop
              if (initMessageReceived && toolsMessageReceived) {
                console.log('   🎉 All expected messages received!');
                clearTimeout(timeoutId);
                sseResponse.body.destroy();
                return;
              }
              
            } catch (e) {
              console.log('   📡 Non-JSON data:', data);
            }
          }
        }
      }
    });

    // Listen for end event
    sseResponse.body.on('end', () => {
      console.log('   📡 Stream ended');
      clearTimeout(timeoutId);
    });

    // Wait for the stream to end or timeout
    await new Promise((resolve) => {
      sseResponse.body.on('end', resolve);
      sseResponse.body.on('close', resolve);
      timeoutId = setTimeout(resolve, 10000);
    });
    
    console.log('');
    console.log('📊 Test Summary:');
    console.log(`   📨 Total messages received: ${messageCount}`);
    console.log(`   ✅ Initialization message: ${initMessageReceived ? 'YES' : 'NO'}`);
    console.log(`   ✅ Tools list message: ${toolsMessageReceived ? 'YES' : 'NO'}`);
    
    if (initMessageReceived && toolsMessageReceived) {
      console.log('   🎉 SUCCESS: MCP server is sending correct messages!');
    } else {
      console.log('   ❌ FAILED: Missing expected messages');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('   Error details:', error);
    process.exit(1);
  }
}

// Run the test
testSSEMessages(); 