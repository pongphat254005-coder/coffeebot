const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const path = require('path');

const CONFIG_PATH = 'C:\\Users\\Asus\\.gemini\\config\\mcp_config.json';
const configStr = fs.readFileSync(CONFIG_PATH, 'utf8');
const env = JSON.parse(configStr).mcpServers['social-media-mcp'].env;

const imagePath = 'C:\\Users\\Asus\\.gemini\\antigravity\\brain\\43689fb4-3bde-4303-a501-f5f7c0a392eb\\.user_uploaded\\media_1786959110068.jpg';

const caption = `☕️ สายกาแฟรู้หรือยัง? 'อาราบิก้า' กับ 'โรบัสต้า' ต่างกันยังไง? 🤔

หลายคนดื่มกาแฟทุกวัน แต่เอ๊ะ... ที่เราดื่มอยู่มันคือสายพันธุ์อะไรกันแน่นะ? วันนี้แอดมินสรุปมาให้ดูกันชัดๆ เลยครับ! 👇

✨ อาราบิก้า (Arabica)
🌱 จุดเด่น: หอม นุ่มละมุน ชับซ้อน มีความเปรี้ยวผลไม้นิดๆ ดื่มง่าย
⚡ คาเฟอีน: 0.8% - 1.4% (คาเฟอีนต่ำกว่า ดื่มแล้วผ่อนคลาย)
ใครชอบเสพ 'รสชาติและกลิ่นหอม' ต้องจัดอาราบิก้าเลยครับ!

🔥 โรบัสต้า (Robusta)
🌱 จุดเด่น: เข้มข้น จัดจ้าน ขม หนักแน่น!
⚡ คาเฟอีน: 1.7% - 3.5% (คาเฟอีนสูงปรี๊ด ดีดตาสว่าง!)
ใครต้องการ 'พลังงานและความตื่นตัว' แบบกระปรี้กระเปร่า โรบัสต้าคือคำตอบครับ!

💬 คำถามประจำวัน:
แล้วเพื่อนๆ หนุ่มสาวโรงงานหรือลูกเพจที่น่ารักของเราล่ะครับ... ชอบดื่มกาแฟแบบไหนมากกว่ากัน?
A. สายหอมนุ่มละมุน (อาราบิก้า) 🥰
B. สายเข้มดีดตาสว่าง (โรบัสต้า) 🤩

คอมเมนต์บอกกันหน่อยครับ แอดมินอยากรู้! 👇👇

📍 พิกัด: ตลาดเช้า หน้าวัดบางวัว 
⏰ เปิดบริการทุกเช้า: 05:00 น. - 09:00 น.
#กาแฟสดหน้าวัดบางวัว #หนุ่มสาวโรงงาน #ตลาดเช้าวัดบางวัว #อาราบิก้า #โรบัสต้า`;

async function postImage() {
  const form = new FormData();
  form.append('access_token', env.FACEBOOK_ACCESS_TOKEN);
  form.append('message', caption);
  form.append('source', fs.createReadStream(imagePath));

  try {
    const res = await axios.post(`https://graph.facebook.com/v19.0/${env.FACEBOOK_PAGE_ID}/photos`, form, {
      headers: form.getHeaders(),
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });
    console.log('SUCCESS:', res.data);
  } catch(e) {
    console.error('ERROR:', e.response ? JSON.stringify(e.response.data) : e.message);
  }
}

postImage();
