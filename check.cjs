const fs = require('fs');
const config = JSON.parse(fs.readFileSync('C:\\Users\\Asus\\.gemini\\config\\mcp_config.json', 'utf8')).mcpServers['social-media-mcp'].env;
async function check() {
  const res = await fetch(`https://graph.facebook.com/v19.0/${config.FACEBOOK_PAGE_ID}/scheduled_posts?access_token=${config.FACEBOOK_ACCESS_TOKEN}`);
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}
check();
