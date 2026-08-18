const axios = require('axios');
const fs = require('fs');

const CONFIG_PATH = 'C:\\Users\\Asus\\.gemini\\config\\mcp_config.json';
const configStr = fs.readFileSync(CONFIG_PATH, 'utf8');
const env = JSON.parse(configStr).mcpServers['social-media-mcp'].env;

async function checkInsights() {
  try {
    const url = `https://graph.facebook.com/v19.0/${env.FACEBOOK_PAGE_ID}/posts?fields=message,created_time,likes.summary(true),comments.summary(true),shares&limit=10&access_token=${env.FACEBOOK_ACCESS_TOKEN}`;
    
    const res = await axios.get(url);
    const posts = res.data.data;
    
    console.log("=== สรุปผลลัพธ์จาก 10 โพสต์ล่าสุด ===");
    let totalLikes = 0;
    let totalComments = 0;
    let totalShares = 0;

    posts.forEach((post, i) => {
      const likes = post.likes ? post.likes.summary.total_count : 0;
      const comments = post.comments ? post.comments.summary.total_count : 0;
      const shares = post.shares ? post.shares.count : 0;
      
      totalLikes += likes;
      totalComments += comments;
      totalShares += shares;
      
      const text = post.message ? post.message.substring(0, 30).replace(/\n/g, ' ') + '...' : '(รูป/วิดีโอ)';
      console.log(`${i+1}. [${post.created_time.split('T')[0]}] ${text}`);
      console.log(`   👍 ไลก์: ${likes} | 💬 คอมเมนต์: ${comments} | 🔗 แชร์: ${shares}`);
    });
    
    console.log("-----------------------------------");
    console.log(`🔥 ภาพรวม 10 โพสต์ล่าสุด:`);
    console.log(`ยอดไลก์รวม: ${totalLikes} ครั้ง`);
    console.log(`ยอดคอมเมนต์รวม: ${totalComments} ครั้ง`);
    console.log(`ยอดแชร์รวม: ${totalShares} ครั้ง`);
    console.log("-----------------------------------");

  } catch(e) {
    console.error('ERROR fetching insights:', e.response ? JSON.stringify(e.response.data) : e.message);
  }
}

checkInsights();
