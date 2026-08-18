const axios = require('axios');
const fs = require('fs');
const CONFIG_PATH = 'C:\\Users\\Asus\\.gemini\\config\\mcp_config.json';
const env = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')).mcpServers['social-media-mcp'].env;

async function testToken() {
  try {
    const res = await axios.get(`https://graph.facebook.com/v19.0/me?access_token=${env.FACEBOOK_ACCESS_TOKEN}`);
    console.log('TOKEN IS VALID:', res.data.name);
  } catch(e) {
    console.error('TOKEN ERROR:', e.response ? e.response.data : e.message);
  }
}
testToken();
