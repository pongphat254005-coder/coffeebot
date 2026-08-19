const fs = require('fs');
const CONFIG_PATH = 'C:\\Users\\Asus\\.gemini\\config\\mcp_config.json';
const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')).mcpServers['social-media-mcp'].env;

async function test() {
  const form = new FormData();
  form.append('access_token', config.FACEBOOK_ACCESS_TOKEN);
  form.append('published', 'false');
  form.append('scheduled_publish_time', Math.floor(Date.now()/1000) + 900); // 15 mins from now
  form.append('description', 'Test Video');
  
  // Create a dummy video (just a 1 second mp4, or wait, I don't have a video file)
  // Let me just upload a dummy photo to check if attachments work for scheduled posts
  form.append('url', 'https://raw.githubusercontent.com/github/explore/master/topics/javascript/javascript.png');
  
  try {
    const res = await fetch(`https://graph.facebook.com/v19.0/${config.FACEBOOK_PAGE_ID}/photos`, {
      method: 'POST',
      body: form
    });
    const result = await res.json();
    console.log("Uploaded:", result);
    
    // Now fetch scheduled posts
    const res2 = await fetch(`https://graph.facebook.com/v19.0/${config.FACEBOOK_PAGE_ID}/scheduled_posts?access_token=${config.FACEBOOK_ACCESS_TOKEN}&fields=id,message,scheduled_publish_time,is_published,permalink_url,attachments{media_type,media,url}`);
    const data = await res2.json();
    console.log("Scheduled:", JSON.stringify(data, null, 2));
  } catch (e) {
    console.error(e.response ? e.response.data : e.message);
  }
}
test();
