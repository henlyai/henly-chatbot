import fetch from 'node-fetch';

async function testMCPConnection() {
  console.log('🧪 Testing MCP connection...');
  
  try {
    // Test SSE connection
    const response = await fetch('https://mcp-servers-production-c189.up.railway.app/sse', {
      headers: {
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache'
      }
    });
    
    console.log('📡 SSE Response status:', response.status);
    console.log('📡 SSE Response headers:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    // Read the SSE stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    console.log('📡 Reading SSE stream...');
    
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        console.log('📡 Stream ended');
        break;
      }
      
      const chunk = decoder.decode(value);
      console.log('📡 Received chunk:', chunk);
      
      // Parse SSE data
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6); // Remove 'data: ' prefix
          if (data.trim()) {
            try {
              const message = JSON.parse(data);
              console.log('📡 Parsed message:', JSON.stringify(message, null, 2));
            } catch (e) {
              console.log('📡 Non-JSON data:', data);
            }
          }
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testMCPConnection(); 