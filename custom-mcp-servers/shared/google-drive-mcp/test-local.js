import fetch from 'node-fetch';

async function testMCPServer() {
  console.log('🧪 Testing MCP Server locally...\n');

  // Test 1: Health endpoint
  console.log('1. Testing health endpoint...');
  try {
    const healthResponse = await fetch('http://localhost:3001/health');
    const healthData = await healthResponse.json();
    console.log('✅ Health check passed:', healthData);
  } catch (error) {
    console.log('❌ Health check failed:', error.message);
    return;
  }

  // Test 2: SSE connection
  console.log('\n2. Testing SSE connection...');
  try {
    const response = await fetch('http://localhost:3001/sse');
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    console.log('✅ SSE connection established');
    console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()));

    // Read the stream using Node.js approach
    const chunks = [];
    response.body.on('data', (chunk) => {
      chunks.push(chunk);
    });

    response.body.on('end', () => {
      const data = Buffer.concat(chunks).toString();
      const lines = data.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const messageData = line.substring(6);
          if (messageData.trim()) {
            try {
              const parsed = JSON.parse(messageData);
              console.log('📨 Received message:', JSON.stringify(parsed, null, 2));
              
              // Check if this is the initialization message
              if (parsed.jsonrpc === '2.0' && parsed.result && parsed.result.capabilities) {
                console.log('✅ Initialization message received with tools:', Object.keys(parsed.result.capabilities.tools));
              }
            } catch (e) {
              console.log('📨 Raw data:', messageData);
            }
          }
        }
      }
      console.log('✅ SSE test completed successfully');
    });

    // Wait a bit for the data to be received
    await new Promise(resolve => setTimeout(resolve, 2000));

  } catch (error) {
    console.log('❌ SSE test failed:', error.message);
  }

  console.log('\n🎉 Local MCP server test completed!');
}

testMCPServer().catch(console.error); 