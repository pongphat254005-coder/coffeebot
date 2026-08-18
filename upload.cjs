const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

async function postPhoto() {
  const config = JSON.parse(fs.readFileSync('C:\\Users\\Asus\\.gemini\\config\\mcp_config.json', 'utf8'));
  const env = config.mcpServers['social-media-mcp'].env;
  
  const form = new FormData();
  form.append('access_token', env.FACEBOOK_ACCESS_TOKEN);
  form.append('message', 'ชีวิตพนักงานโรงงานตอนเช้า: รูดบัตรเข้างาน 8 โมง แต่ต้องตื่นมาตลาดตั้งแต่ 6 โมง... เพื่อมาซื้อกาแฟ! 🧟‍♂️☕️\n\nเพื่อนถาม: "มึงมาซื้อข้าวกินเหรอ?"\nตอบ: "เปล่า... กูมาซื้อวิญญาณ! ถ้าไม่ได้กาแฟสด กูว่ากูหลับคาไลน์ผลิตแน่ๆ!" 😂\n\nใครกำลังร่างแหลกตอนเช้า แวะมารับวิญญาณ เอ้ย! รับความสดชื่นกันได้ที่ "กาแฟสดท้ายรถ เมืองตาก" นะครับ 🚗💨 รับรองตาสว่างยันเลิกโอที!\n\n#ชีวิตหนุ่มสาวโรงงาน #กาแฟสดท้ายรถ #เมืองตาก #มนุษย์เงินเดือน #กาแฟยามเช้า');
  form.append('source', fs.createReadStream('C:\\Users\\Asus\\.gemini\\antigravity\\brain\\43689fb4-3bde-4303-a501-f5f7c0a392eb\\factory_worker_coffee_1786949997608.jpg'));

  try {
    const res = await axios.post('https://graph.facebook.com/v19.0/' + env.FACEBOOK_PAGE_ID + '/photos', form, {
      headers: form.getHeaders()
    });
    console.log('SUCCESS:', res.data);
  } catch(e) {
    console.error('ERROR:', e.response ? e.response.data : e.message);
  }
}
postPhoto();
