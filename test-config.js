const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');

console.log('=== LibreChat Configuration Test ===');

// Test 1: Check if librechat.yaml exists
const configPath = process.env.CONFIG_PATH || path.resolve(__dirname, 'librechat.yaml');
console.log('Config path:', configPath);
console.log('Config file exists:', fs.existsSync(configPath));

// Test 2: Try to load the config
try {
  const configContent = fs.readFileSync(configPath, 'utf8');
  console.log('Config file content length:', configContent.length);
  
  const config = yaml.load(configContent);
  console.log('Config loaded successfully');
  console.log('Config keys:', Object.keys(config));
  
  // Test 3: Check MCP configuration
  if (config.mcpServers) {
    console.log('MCP servers found:', Object.keys(config.mcpServers));
    console.log('Google Drive MCP config:', config.mcpServers['Google Drive']);
  } else {
    console.log('No MCP servers found in config');
  }
  
} catch (error) {
  console.error('Error loading config:', error.message);
}

console.log('=== End Test ==='); 