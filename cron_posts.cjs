const cron = require('node-cron');
const axios = require('axios');
const fs = require('fs');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const CONFIG_PATH = 'C:\\Users\\Asus\\.gemini\\config\\mcp_config.json';
const env = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')).mcpServers['social-media-mcp'].env;

async function generateAndPost(prompt) {
  try {
    const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    
    const aiResult = await model.generateContent(prompt);
    const caption = aiResult.response.text().trim();

    await axios.post(`https://graph.facebook.com/v19.0/${env.FACEBOOK_PAGE_ID}/feed`, {
      message: caption,
      access_token: env.FACEBOOK_ACCESS_TOKEN
    });
    console.log("SUCCESSFULLY POSTED AUTOMATED CRON JOB!");
  } catch (err) {
    console.error("FAILED TO POST AUTOMATED CRON JOB:", err.message);
  }
}

function startCronJobs() {
  // วันจันทร์-เสาร์ เวลา 05:00 น. (เปิดร้าน)
  cron.schedule('0 5 * * 1-6', () => {
    console.log("Triggered Opening Shop Post (Mon-Sat 5 AM)");
    const prompt = "คุณคือแอดมินเพจ กาแฟสดท้ายรถ (สาขาวัดบางวัว) จงแต่งแคปชั่นความยาว 3-4 บรรทัด ทักทายตอนเช้าและประกาศเปิดร้านวันนี้พร้อมให้บริการแล้ว เวลา 05:00 - 09:00 น. เชิญชวนหนุ่มสาวโรงงานมาแวะซื้อกาแฟก่อนเข้ากะ ใช้ภาษาเป็นกันเอง ตลก สนุกสนาน พร้อมใส่แฮชแท็ก #กาแฟสดท้ายรถ #ตลาดเช้าหน้าวัดบางวัว";
    generateAndPost(prompt);
  }, {
    timezone: "Asia/Bangkok"
  });

  // วันอาทิตย์ เวลา 08:00 น. (วันหยุดร้าน)
  cron.schedule('0 8 * * 0', () => {
    console.log("Triggered Shop Closed Post (Sunday 8 AM)");
    const prompt = "คุณคือแอดมินเพจ กาแฟสดท้ายรถ (สาขาวัดบางวัว) จงแต่งแคปชั่นความยาว 3-4 บรรทัด ประกาศว่าวันนี้วันอาทิตย์ ร้านหยุด 1 วัน ให้ลูกค้าพักผ่อนชิลๆ แล้วพรุ่งนี้กลับมาเจอกันใหม่ ใช้ภาษาเป็นกันเอง พร้อมใส่แฮชแท็ก #กาแฟสดท้ายรถ #ร้านหยุด";
    generateAndPost(prompt);
  }, {
    timezone: "Asia/Bangkok"
  });

  console.log("Started recurring cron jobs for Shop Opening and Closing.");
}

module.exports = { startCronJobs };
