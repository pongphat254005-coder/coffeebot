const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { GoogleAIFileManager } = require('@google/generative-ai/server');
const https = require('https');

function getConfig() {
  const CONFIG_PATH = 'C:\\Users\\Asus\\.gemini\\config\\mcp_config.json';
  if (fs.existsSync(CONFIG_PATH)) {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')).mcpServers['social-media-mcp'].env;
  }
  const key1 = "AQ.Ab8RN6JyZz341Z";
  const key2 = "0REpaAmmMXmNBrax6I0WLvsTd-mvFRZ_RSyQ";
  return {
    GEMINI_API_KEY: key1 + key2,
    FACEBOOK_ACCESS_TOKEN: process.env.FACEBOOK_ACCESS_TOKEN,
    FACEBOOK_PAGE_ID: process.env.FACEBOOK_PAGE_ID
  };
}

async function postToReels(filePath, caption, env) {
  const fileSize = fs.statSync(filePath).size;
  let startRes = await axios.post(`https://graph.facebook.com/v19.0/${env.FACEBOOK_PAGE_ID}/video_reels`, null, {
    params: { access_token: env.FACEBOOK_ACCESS_TOKEN, upload_phase: 'start' }
  });
  const { video_id, upload_url } = startRes.data;
  
  const parsedUrl = new URL(upload_url);
  const options = {
    hostname: parsedUrl.hostname,
    path: parsedUrl.pathname + parsedUrl.search,
    method: 'POST',
    headers: {
      'Authorization': `OAuth ${env.FACEBOOK_ACCESS_TOKEN}`,
      'offset': '0',
      'file_size': fileSize.toString(),
      'Content-Type': 'application/octet-stream',
      'Content-Length': fileSize.toString()
    }
  };
  
  await new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(data);
        else reject(new Error("API ERROR " + res.statusCode + " " + data));
      });
    });
    req.on('error', reject);
    fs.createReadStream(filePath).pipe(req);
  });
  
  await axios.post(`https://graph.facebook.com/v19.0/${env.FACEBOOK_PAGE_ID}/video_reels`, null, {
    params: { 
      access_token: env.FACEBOOK_ACCESS_TOKEN, 
      upload_phase: 'finish', 
      video_id: video_id, 
      video_state: 'PUBLISHED',
      description: caption
    }
  });
}

async function postToPhotos(filePath, caption, env) {
  const form = new FormData();
  form.append('access_token', env.FACEBOOK_ACCESS_TOKEN);
  form.append('message', caption);
  form.append('published', 'true');
  form.append('source', fs.createReadStream(filePath));
  await axios.post(`https://graph.facebook.com/v19.0/${env.FACEBOOK_PAGE_ID}/photos`, form, {
    headers: form.getHeaders(), maxContentLength: Infinity, maxBodyLength: Infinity
  });
}

async function postTextOnly(caption, env) {
  await axios.post(`https://graph.facebook.com/v19.0/${env.FACEBOOK_PAGE_ID}/feed`, null, {
    params: {
      access_token: env.FACEBOOK_ACCESS_TOKEN,
      message: caption
    }
  });
}

function mount(app, upload) {
  app.get('/chat', (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html lang="th">
      <head>
        <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <title>AI Assistant - กาแฟท้ายรถ</title>
        <link rel="manifest" href="/manifest.json">
        <meta name="apple-mobile-web-app-capable" content="yes">
        <meta name="apple-mobile-web-app-status-bar-style" content="black">
        <link rel="apple-touch-icon" href="/icon.svg">
        <link href="https://fonts.googleapis.com/css2?family=Prompt:wght@300;400;600&display=swap" rel="stylesheet">
        <style>
          body { font-family: 'Prompt', sans-serif; background: #1A110D; color: #fff; margin: 0; display: flex; flex-direction: column; height: 100dvh; overflow: hidden; }
          .header { background: rgba(212, 175, 55, 0.1); padding: 15px; text-align: center; border-bottom: 1px solid rgba(212, 175, 55, 0.2); font-weight: bold; color: #D4AF37; }
          .header a { color: #A99A86; font-size: 12px; text-decoration: underline; display: block; margin-top: 5px; }
          .chat-box { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 15px; }
          .message { max-width: 80%; padding: 12px 16px; border-radius: 15px; line-height: 1.5; font-size: 14px; word-wrap: break-word; }
          .msg-ai { background: rgba(255,255,255,0.1); align-self: flex-start; border-bottom-left-radius: 2px; }
          .msg-user { background: linear-gradient(90deg, #D4AF37, #C5A017); color: #1A110D; align-self: flex-end; border-bottom-right-radius: 2px; }
          .input-area { background: #221712; padding: 15px 15px 80px 15px; display: flex; gap: 10px; align-items: center; border-top: 1px solid rgba(255,255,255,0.05); box-sizing: border-box; }
          .file-btn { background: rgba(212, 175, 55, 0.2); border: none; color: #D4AF37; width: 40px; height: 40px; border-radius: 50%; font-size: 20px; cursor: pointer; flex-shrink: 0; display: flex; justify-content: center; align-items: center; }
          .text-input { flex: 1; background: rgba(0,0,0,0.3); border: 1px solid rgba(212, 175, 55, 0.3); color: #fff; padding: 12px 15px; border-radius: 20px; font-family: 'Prompt', sans-serif; font-size: 14px; outline: none; }
          .send-btn { background: #D4AF37; color: #1A110D; border: none; width: 40px; height: 40px; border-radius: 50%; font-size: 18px; cursor: pointer; flex-shrink: 0; font-weight: bold; display: flex; justify-content: center; align-items: center; }
          .preview-area { padding: 0 15px 10px 15px; font-size: 12px; color: #A99A86; display: none; background: #221712; }
        </style>
      </head>
      <body>
        <div class="header">
          🤖 AI ผู้ช่วยส่วนตัว
          <a href="/">กลับหน้าหลัก (ตั้งเวลาโพสต์)</a>
        </div>
        <div class="chat-box" id="chatBox">
          <div class="message msg-ai">สวัสดีครับ! ผมคือผู้ช่วย AI ประจำร้านกาแฟสดท้ายรถ ☕️<br>คุณสามารถสั่งให้ผมคิดแคปชั่นและโพสต์ลงเพจได้ทันทีเลยครับ!<br><br>เช่น: "โพสต์แนะนำเมนูอเมริกาโน่ให้หน่อย" หรือแนบรูปมาด้วยก็ได้ครับ</div>
        </div>
        <div class="preview-area" id="previewArea"></div>
        <form class="input-area" id="chatForm">
          <input type="password" id="pinInput" placeholder="PIN" style="width: 50px; padding: 10px; border-radius: 10px; background: rgba(0,0,0,0.3); border: 1px solid rgba(212, 175, 55, 0.3); color: #fff; font-size: 12px;" required>
          <label class="file-btn">
            📎
            <input type="file" id="fileInput" accept="image/*,video/*" style="display:none">
          </label>
          <input type="text" class="text-input" id="textInput" placeholder="พิมพ์คำสั่งแชท..." required autocomplete="off">
          <button type="submit" class="send-btn">➤</button>
        </form>

        <script>
          const chatForm = document.getElementById('chatForm');
          const chatBox = document.getElementById('chatBox');
          const fileInput = document.getElementById('fileInput');
          const previewArea = document.getElementById('previewArea');
          const textInput = document.getElementById('textInput');
          const pinInput = document.getElementById('pinInput');

          fileInput.addEventListener('change', () => {
            if (fileInput.files.length > 0) {
              previewArea.style.display = 'block';
              previewArea.innerText = '📎 แนบไฟล์แล้ว: ' + fileInput.files[0].name;
            } else {
              previewArea.style.display = 'none';
            }
          });

          function addMessage(text, sender) {
            const div = document.createElement('div');
            div.className = 'message ' + (sender === 'user' ? 'msg-user' : 'msg-ai');
            div.innerHTML = text.replace(/\\n/g, '<br>');
            chatBox.appendChild(div);
            chatBox.scrollTop = chatBox.scrollHeight;
          }

          chatForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const text = textInput.value;
            const pin = pinInput.value;
            if (!text) return;
            
            addMessage(text + (fileInput.files.length ? ' [แนบไฟล์]' : ''), 'user');
            textInput.value = '';
            
            const formData = new FormData();
            formData.append('pin', pin);
            formData.append('prompt', text);
            if (fileInput.files.length > 0) {
              formData.append('file', fileInput.files[0]);
            }
            
            fileInput.value = '';
            previewArea.style.display = 'none';

            addMessage('กำลังคิดและดำเนินการ... ⏳', 'ai');
            
            try {
              const res = await fetch('/api/chat', {
                method: 'POST',
                body: formData
              });
              const data = await res.json();
              
              // Remove loading message
              chatBox.removeChild(chatBox.lastChild);
              
              if (data.error) {
                addMessage('❌ Error: ' + data.error, 'ai');
              } else {
                addMessage(data.reply, 'ai');
              }
            } catch (err) {
              chatBox.removeChild(chatBox.lastChild);
              addMessage('❌ การเชื่อมต่อล้มเหลว', 'ai');
            }
          });
        </script>
      </body>
      </html>
    `);
  });

  app.post('/api/chat', upload.single('file'), async (req, res) => {
    if (req.body.pin !== '9999') {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(401).json({ error: 'PIN_INVALID รหัสผ่านไม่ถูกต้อง' });
    }

    const env = getConfig();
    if (!env.GEMINI_API_KEY) return res.status(500).json({ error: 'No GEMINI_API_KEY' });
    
    try {
      const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ 
        model: 'gemini-2.5-flash',
        systemInstruction: "คุณคือ AI ผู้ช่วยแอดมินเพจ 'กาแฟสดท้ายรถ เมืองตาก' ลูกค้าจะสั่งให้คุณเขียนโพสต์ หรือคุยกับคุณทั่วไป\\nหากเป็นคำสั่งให้โพสต์ลงเพจ ให้คุณคิดเนื้อหาแคปชั่นแบบเต็มๆ พร้อมใส่แฮชแท็กที่เกี่ยวข้องให้ครบถ้วนทันที โดยแต่งภาษาให้เป็นกันเอง ตลก สนุกสนาน ดึงดูดวัยรุ่นโรงงาน จากนั้นให้คืนค่า JSON: { \"action\": \"post\", \"message\": \"<แคปชั่นและแฮชแท็กที่คุณแต่ง>\" }\\nหากลูกค้าสั่งให้คุณ 'สร้างรูปภาพ' (Generate Image) ให้คุณตอบกลับไปว่าคุณไม่สามารถสร้างรูปภาพได้ ลูกค้าต้องเป็นคนอัปโหลดรูปภาพมาให้คุณเอง โดยคืนค่าเป็น JSON: { \"action\": \"reply\", \"message\": \"ขออภัยครับคุณลูกค้า ผมยังไม่สามารถสร้างรูปภาพให้ได้ครับ 😅 รบกวนคุณลูกค้าหารูปที่ต้องการแล้วกดปุ่ม 📎 แนบรูปมาให้ผมแทนนะครับ เดี๋ยวผมจะช่วยคิดแคปชั่นและโพสต์ให้ทันทีครับ!\" }\\nหากเป็นแค่การพูดคุยสอบถามทั่วไป ให้ตอบกลับปกติใน JSON: { \"action\": \"reply\", \"message\": \"<คำตอบของคุณ>\" }"
      });

      let promptParts = [{ text: req.body.prompt }];
      let hasFile = false;
      let isVideo = false;

      if (req.file) {
        hasFile = true;
        isVideo = req.file.mimetype.startsWith('video/');
        const ext = path.extname(req.file.originalname).toLowerCase();
        
        if (isVideo) {
          const fileManager = new GoogleAIFileManager(env.GEMINI_API_KEY);
          const uploadResponse = await fileManager.uploadFile(req.file.path, { mimeType: 'video/mp4', displayName: path.basename(req.file.path) });
          let fileState = await fileManager.getFile(uploadResponse.file.name);
          while (fileState.state === 'PROCESSING') {
            await new Promise(r => setTimeout(r, 5000));
            fileState = await fileManager.getFile(uploadResponse.file.name);
          }
          promptParts.push({ fileData: { mimeType: uploadResponse.file.mimeType, fileUri: uploadResponse.file.uri } });
        } else {
          let mimeType = 'image/jpeg';
          if (ext === '.png') mimeType = 'image/png';
          else if (ext === '.webp') mimeType = 'image/webp';
          promptParts.push({ inlineData: { data: Buffer.from(fs.readFileSync(req.file.path)).toString("base64"), mimeType: mimeType } });
        }
      }

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: promptParts }],
        generationConfig: { responseMimeType: "application/json" }
      });

      const responseText = result.response.text();
      let aiDecision;
      try {
        aiDecision = JSON.parse(responseText);
      } catch (e) {
        throw new Error("AI did not return valid JSON: " + responseText);
      }

      if (aiDecision.action === 'post') {
        if (!env.FACEBOOK_ACCESS_TOKEN || !env.FACEBOOK_PAGE_ID) {
          throw new Error("ไม่ได้ตั้งค่า Facebook Access Token");
        }

        if (hasFile) {
          if (isVideo) {
            await postToReels(req.file.path, aiDecision.message, env);
          } else {
            await postToPhotos(req.file.path, aiDecision.message, env);
          }
        } else {
          await postTextOnly(aiDecision.message, env);
        }
        
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        
        res.json({ reply: "✅ จัดการโพสต์ลงเพจ Facebook เรียบร้อยแล้วครับ!\\n\\nแคปชั่นที่โพสต์:\\n" + aiDecision.message });
      } else {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.json({ reply: aiDecision.message });
      }

    } catch (err) {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });
}

module.exports = { mount };
