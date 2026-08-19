const fs = require('fs');
const CONFIG_PATH = 'C:\\Users\\Asus\\.gemini\\config\\mcp_config.json';
const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')).mcpServers['social-media-mcp'].env;

async function check() {
  try {
    const res = await fetch(`https://graph.facebook.com/v19.0/${config.FACEBOOK_PAGE_ID}/scheduled_posts?access_token=${config.FACEBOOK_ACCESS_TOKEN}&fields=id,message,scheduled_publish_time,is_published&limit=100`);
    const data = await res.json();
    console.log("SCHEDULED:", JSON.stringify(data, null, 2));
    
    // Also check published posts
    const res2 = await fetch(`https://graph.facebook.com/v19.0/${config.FACEBOOK_PAGE_ID}/published_posts?access_token=${config.FACEBOOK_ACCESS_TOKEN}&fields=id,message,created_time&limit=5`);
    const data2 = await res2.json();
    console.log("PUBLISHED:", JSON.stringify(data2, null, 2));
  } catch (e) {
    console.error(e.message);
  }
}
check();
