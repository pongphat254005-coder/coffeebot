process.env.TZ = 'Asia/Bangkok';
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const { processQueue } = require('./scheduler.cjs');

const app = express();
const PORT = process.env.PORT || 3000;

const NEW_DIR = path.join(__dirname, 'New');
const POSTED_DIR = path.join(__dirname, 'Posted');
const FAILED_DIR = path.join(__dirname, 'Failed');

// Ensure directories exist
[NEW_DIR, POSTED_DIR, FAILED_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Configure Multer for local storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, NEW_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const ts = Date.now();
    const rnd = Math.floor(Math.random() * 1000000);
    cb(null, `upload_${ts}_${rnd}${ext}`);
  }
});
const upload = multer({ storage });

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Serve the 'New' directory so we can preview queued files
app.use('/media', express.static(NEW_DIR));

// Mount Chat Module
require('./chat.cjs').mount(app, upload);

// PWA Files
app.get('/manifest.json', (req, res) => res.sendFile(path.join(__dirname, 'manifest.json')));
app.get('/sw.js', (req, res) => res.sendFile(path.join(__dirname, 'sw.js')));
app.get('/icon.svg', (req, res) => res.sendFile(path.join(__dirname, 'icon.svg')));

// Basic HTML UI for uploading
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="th">
    <head>
      <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      <title>อัปโหลดรูป/วีดีโอบอท - กาแฟท้ายรถ</title>
      <link rel="manifest" href="/manifest.json">
      <meta name="apple-mobile-web-app-capable" content="yes">
      <meta name="apple-mobile-web-app-status-bar-style" content="black">
      <link rel="apple-touch-icon" href="/icon.svg">
      <link href="https://fonts.googleapis.com/css2?family=Prompt:wght@300;400;600&display=swap" rel="stylesheet">
      <style>
        body { font-family: 'Prompt', sans-serif; background: linear-gradient(135deg, #1A110D 0%, #2C1A14 100%); color: #fff; padding: 20px; text-align: center; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
        .container { width: 100%; max-width: 450px; background: rgba(255, 255, 255, 0.05); padding: 40px; border-radius: 20px; box-shadow: 0 8px 32px rgba(0,0,0,0.5); backdrop-filter: blur(10px); border: 1px solid rgba(212, 175, 55, 0.2); }
        h1 { color: #D4AF37; margin-top: 0; display: flex; align-items: center; justify-content: center; gap: 10px; }
        p { color: #A99A86; font-size: 14px; margin-bottom: 30px; }
        input[type="password"] { width: 100%; padding: 14px; margin-bottom: 20px; background: rgba(0,0,0,0.2); color: #fff; border: 1px solid rgba(212, 175, 55, 0.3); border-radius: 10px; box-sizing: border-box; font-family: 'Prompt', sans-serif; }
        input[type="file"] { display: none; }
        .file-label { display: block; background: rgba(212, 175, 55, 0.1); border: 1px dashed #D4AF37; padding: 20px; border-radius: 10px; cursor: pointer; margin-bottom: 20px; color: #D4AF37; transition: all 0.3s; }
        .file-label:hover { background: rgba(212, 175, 55, 0.2); }
        button { background: linear-gradient(90deg, #D4AF37, #F3E5AB); color: #1A110D; border: none; padding: 14px; border-radius: 10px; width: 100%; cursor: pointer; font-size: 16px; font-weight: bold; font-family: 'Prompt', sans-serif; box-shadow: 0 4px 15px rgba(212, 175, 55, 0.3); transition: transform 0.2s; }
        button:active { transform: scale(0.98); }
        .footer { margin-top: 30px; font-size: 12px; color: #666; }
        .progress-container { display: none; margin-top: 20px; background: rgba(255,255,255,0.1); border-radius: 10px; overflow: hidden; height: 25px; width: 100%; border: 1px solid rgba(212, 175, 55, 0.3); }
        .progress-bar { background: linear-gradient(90deg, #4cd137, #44bd32); height: 100%; width: 0%; transition: width 0.3s; }
        #progressText { margin-top: 10px; color: #4cd137; font-weight: bold; font-size: 14px; display: none; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>✨ AI Coffee Bot ✨</h1>
        <p>อัปโหลดรูปภาพหรือวีดีโอได้สูงสุด 100 ไฟล์ เพื่อส่งเข้าคิวโพสต์อัตโนมัติ (ตั้งเวลาล่วงหน้าบนเพจเฟซบุ๊ก)</p>
        
        <form id="uploadForm">
          <input type="password" id="pin" placeholder="รหัสผ่าน (PIN)" required />
          <label class="file-label" id="fileLabel">
            📸 กดเพื่อเลือกไฟล์ (รูป/วีดีโอ)...
            <input type="file" id="fileInput" accept="image/*,video/*" multiple required />
          </label>
          <div id="fileCount" style="margin-bottom: 20px; color: #A99A86; font-size: 14px;"></div>
          <button type="submit" id="submitBtn">🚀 อัปโหลดและเริ่มตั้งเวลา</button>
        </form>

        <div class="progress-container" id="progressContainer">
          <div class="progress-bar" id="progressBar"></div>
        </div>
        <div id="progressText">อัปโหลด: 0%</div>

        <div style="margin-top: 20px; font-size: 14px; color: #D4AF37;">
          <a href="/chat" style="color: #4cd137; text-decoration: none; cursor: pointer; display: block; margin-bottom: 15px; font-weight: bold; background: rgba(76, 209, 55, 0.1); border: 1px solid #4cd137; padding: 10px; border-radius: 10px;">💬 สั่ง AI โพสต์ด่วน (ระบบแชท)</a>
          <a href="/dashboard" style="color: #A99A86; text-decoration: underline; cursor: pointer;">📋 เข้าไปดูคิวโพสต์ที่ตั้งเวลาไว้แล้ว</a>
        </div>

        <div class="footer">Premium Admin Portal<br>© กาแฟสดท้ายรถ เมืองตาก</div>
      </div>
      <script>
        document.getElementById('fileInput').addEventListener('change', function(e) {
          const count = e.target.files.length;
          if (count > 0) {
            document.getElementById('fileCount').innerText = 'เลือกแล้ว ' + count + ' ไฟล์';
            document.getElementById('fileLabel').style.borderColor = '#4cd137';
            document.getElementById('fileLabel').style.color = '#4cd137';
          }
        });

        document.getElementById('uploadForm').addEventListener('submit', async function(e) {
          e.preventDefault();
          const pin = document.getElementById('pin').value;
          const files = document.getElementById('fileInput').files;
          if(files.length === 0) { alert('กรุณาเลือกไฟล์ก่อน'); return; }

          document.getElementById('submitBtn').style.display = 'none';
          document.getElementById('progressContainer').style.display = 'block';
          document.getElementById('progressText').style.display = 'block';

          let successCount = 0;
          for (let i = 0; i < files.length; i++) {
            const formData = new FormData();
            formData.append('pin', pin);
            formData.append('files', files[i]);

            try {
              await new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open('POST', '/upload', true);
                
                xhr.upload.onprogress = function(e) {
                  if (e.lengthComputable) {
                    const filePercent = (e.loaded / e.total);
                    const overallPercent = Math.round(((i + filePercent) / files.length) * 100);
                    document.getElementById('progressBar').style.width = overallPercent + '%';
                    document.getElementById('progressText').innerText = 'อัปโหลด: ' + overallPercent + '% (' + (i+1) + '/' + files.length + ')';
                  }
                };

                xhr.onload = function() {
                  if (xhr.status === 200) {
                    successCount++;
                    resolve();
                  } else {
                    reject(new Error('รหัสผ่านอาจจะไม่ถูกต้อง หรือเซิร์ฟเวอร์ขัดข้อง'));
                  }
                };
                
                xhr.onerror = function() {
                  reject(new Error('การเชื่อมต่อล้มเหลว ลองใหม่อีกครั้งครับ'));
                };

                xhr.send(formData);
              });
            } catch (err) {
              alert('❌ เกิดข้อผิดพลาดไฟล์ที่ ' + (i+1) + ': ' + err.message);
              window.location.reload();
              return;
            }
          }
          
          window.location.href = '/processing?total=' + successCount;
        });

        if ('serviceWorker' in navigator) {
          window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js').then(reg => {
              console.log('SW registered!', reg);
            }).catch(err => console.log('SW error', err));
          });
        }
      </script>
    </body>
    </html>
  `);
});

app.get('/status', (req, res) => {
  const count = fs.existsSync(NEW_DIR) ? fs.readdirSync(NEW_DIR).filter(f => !f.startsWith('.')).length : 0;
  res.json({ count });
});

// Process Uploads (AJAX endpoint)
app.post('/upload', upload.array('files', 100), (req, res) => {
  if (req.body.pin !== '9999') {
    if (req.files) req.files.forEach(f => { if(fs.existsSync(f.path)) fs.unlinkSync(f.path); });
    return res.status(401).json({ error: 'PIN_INVALID' });
  }
  
  processQueue().catch(e => console.error("Process Queue Error:", e));
  res.json({ status: 'success', total: req.files.length });
});

app.get('/processing', (req, res) => {
  const total = parseInt(req.query.total) || 1;
  res.send(`
    <!DOCTYPE html>
    <html lang="th">
    <head>
      <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>กำลังประมวลผล</title>
      <link href="https://fonts.googleapis.com/css2?family=Prompt:wght@300;400;600&display=swap" rel="stylesheet">
      <style>
        body { font-family: 'Prompt', sans-serif; background: #1A110D; color: #fff; padding: 20px; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
        .spinner { border: 4px solid rgba(255,255,255,0.1); border-left-color: #D4AF37; border-radius: 50%; width: 50px; height: 50px; animation: spin 1s linear infinite; margin-bottom: 20px; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .warning { color: #ff4757; font-weight: bold; background: rgba(255, 71, 87, 0.1); padding: 15px; border-radius: 10px; border: 1px solid rgba(255, 71, 87, 0.3); margin-top: 20px; max-width: 450px; }
        .count-box { background: rgba(212, 175, 55, 0.1); border: 1px solid #D4AF37; padding: 20px; border-radius: 15px; margin-top: 20px; font-size: 20px; color: #D4AF37; font-weight: bold; width: 100%; max-width: 400px; box-sizing: border-box; }
        .proc-progress-container { margin-top: 15px; background: rgba(255,255,255,0.1); border-radius: 10px; overflow: hidden; height: 25px; width: 100%; border: 1px solid rgba(212, 175, 55, 0.3); }
        .proc-progress-bar { background: linear-gradient(90deg, #D4AF37, #F3E5AB); height: 100%; width: 0%; transition: width 0.5s; }
      </style>
    </head>
    <body>
      <div class="spinner"></div>
      <h2>⏳ AI กำลังดูวีดีโอ แต่งแคปชั่น และตั้งเวลาโพสต์บนเฟซบุ๊ก...</h2>
      
      <div class="count-box">
        กำลังจัดการไฟล์: <span id="doneCount">0</span> / ${total}
        <div class="proc-progress-container">
          <div class="proc-progress-bar" id="procProgressBar"></div>
        </div>
        <div style="font-size:14px; margin-top:10px; color: #fff;">ประมวลผลสำเร็จ <span id="percentText">0</span>%</div>
      </div>

      <div class="warning">
        ⚠️ กรุณาเปิดหน้าจอนี้ทิ้งไว้จนกว่าจะเสร็จสมบูรณ์ ⚠️<br>
        <span style="font-size: 14px; font-weight: normal;">(เพื่อป้องกันเซิร์ฟเวอร์หลับ และไฟล์สูญหายระหว่างทาง)</span>
      </div>

      <script>
        const total = ${total};
        setInterval(() => {
          fetch('/status').then(r=>r.json()).then(data => {
            const left = data.count;
            const done = total - left;
            let percent = Math.round((done / total) * 100);
            if(percent < 0) percent = 0;
            if(percent > 100) percent = 100;

            document.getElementById('doneCount').innerText = done;
            document.getElementById('procProgressBar').style.width = percent + '%';
            document.getElementById('percentText').innerText = percent;

            if (left === 0) {
              alert('✅ เสร็จสิ้น! ทุกไฟล์ถูกส่งไปตั้งเวลาล่วงหน้าบน Facebook สำเร็จ! ระบบปลอดภัย 100% ปิดหน้านี้ได้เลยครับ');
              window.location.href = '/dashboard';
            }
          });
        }, 5000);
      </script>
    </body>
    </html>
  `);
});

// Dashboard UI
app.get('/dashboard', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="th">
    <head>
      <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>ระบบจัดการคิวโพสต์</title>
      <link href="https://fonts.googleapis.com/css2?family=Prompt:wght@300;400;600&display=swap" rel="stylesheet">
      <style>
        body { font-family: 'Prompt', sans-serif; background: linear-gradient(135deg, #1A110D 0%, #2C1A14 100%); color: #fff; padding: 20px; text-align: center; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
        .container { width: 100%; max-width: 400px; background: rgba(255, 255, 255, 0.05); padding: 40px; border-radius: 20px; box-shadow: 0 8px 32px rgba(0,0,0,0.5); backdrop-filter: blur(10px); border: 1px solid rgba(212, 175, 55, 0.2); }
        h2 { color: #D4AF37; margin-top: 0; }
        input { width: 100%; padding: 14px; margin: 20px 0; background: rgba(0,0,0,0.2); color: #fff; border: 1px solid rgba(212, 175, 55, 0.3); border-radius: 10px; box-sizing: border-box; font-family: 'Prompt', sans-serif;}
        button { background: linear-gradient(90deg, #D4AF37, #F3E5AB); color: #1A110D; border: none; padding: 14px; border-radius: 10px; width: 100%; cursor: pointer; font-size: 16px; font-weight: bold; font-family: 'Prompt', sans-serif;}
        a { color: #A99A86; display: block; margin-top: 20px; text-decoration: none; }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>🔒 เช็คคิวที่ตั้งเวลาบน Facebook</h2>
        <form action="/dashboard" method="POST">
          <input type="password" name="pin" placeholder="รหัส PIN 4 หลัก" required autofocus />
          <button type="submit">🔓 เข้าสู่ระบบ</button>
        </form>
        <a href="/">⬅️ กลับหน้าอัปโหลด</a>
      </div>
    </body>
    </html>
  `);
});

const CONFIG_PATH = 'C:\\Users\\Asus\\.gemini\\config\\mcp_config.json';
function getConfig() {
  if (fs.existsSync(CONFIG_PATH)) {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')).mcpServers['social-media-mcp'].env;
  }
  return { FACEBOOK_ACCESS_TOKEN: process.env.FACEBOOK_ACCESS_TOKEN, FACEBOOK_PAGE_ID: process.env.FACEBOOK_PAGE_ID };
}

app.post('/dashboard', async (req, res) => {
  if (req.body.pin !== '9999') return res.status(401).send('<h2 style="color:red;text-align:center;margin-top:50px;">❌ รหัสผ่านไม่ถูกต้อง!</h2><br><center><a href="/dashboard">กลับไปลองใหม่</a></center>');
  
  const env = getConfig();
  let files = [];
  try {
    const fbRes = await axios.get(`https://graph.facebook.com/v19.0/${env.FACEBOOK_PAGE_ID}/scheduled_posts`, {
      params: { access_token: env.FACEBOOK_ACCESS_TOKEN, fields: 'id,message,scheduled_publish_time,attachments{media_type,media}', limit: 100 }
    });
    if (fbRes.data && fbRes.data.data) {
      files = fbRes.data.data.sort((a,b) => {
        const tA = new Date(a.scheduled_publish_time).getTime();
        const tB = new Date(b.scheduled_publish_time).getTime();
        return tA - tB;
      });
    }
  } catch(e) {
    console.error("Dashboard FB API Error:", e.response ? e.response.data : e.message);
  }

  let mediaHtml = '';
  if (files.length === 0) {
    mediaHtml = '<p style="text-align:center; color:#A99A86; grid-column: 1 / -1;">ไม่มีคิวโพสต์ล่วงหน้าบน Facebook ในขณะนี้</p>';
  } else {
    // Sort ascending
    files.sort((a,b) => {
      const ta = (typeof a.scheduled_publish_time === 'number') ? a.scheduled_publish_time : new Date(a.scheduled_publish_time).getTime()/1000;
      const tb = (typeof b.scheduled_publish_time === 'number') ? b.scheduled_publish_time : new Date(b.scheduled_publish_time).getTime()/1000;
      return ta - tb;
    });
    
    files.forEach((post, i) => {
      const parsedT = (typeof post.scheduled_publish_time === 'number') 
          ? post.scheduled_publish_time * 1000 
          : new Date(post.scheduled_publish_time).getTime();
      const d = new Date(parsedT).toLocaleString('th-TH');
      
      let previewHtml = '';
      if (post.attachments && post.attachments.data && post.attachments.data.length > 0) {
        const media = post.attachments.data[0].media;
        const mediaType = post.attachments.data[0].media_type;
        // Facebook API returns the image thumbnail in media.image for both photos and videos!
        if (media && media.image && media.image.src) {
           previewHtml = `<img src="${media.image.src}" style="width: 100%; height: 200px; object-fit: cover; border-bottom: 1px solid rgba(212, 175, 55, 0.2);" />`;
        }
      }
      
      if (!previewHtml) {
        previewHtml = `<div style="width: 100%; height: 200px; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; color: #A99A86; border-bottom: 1px solid rgba(212, 175, 55, 0.2);">[รอการประมวลผลวิดีโอจาก Facebook]</div>`;
      }
      
      mediaHtml += `
        <div class="card">
          ${previewHtml}
          <div style="background: rgba(212, 175, 55, 0.1); padding: 15px; border-bottom: 1px solid rgba(212, 175, 55, 0.2);">
            <div style="color: #D4AF37; font-weight: bold; font-size: 16px;">คิวที่ ${i+1}</div>
            <div style="color: #4cd137; font-size: 14px;">⏰ เวลาโพสต์: ${d}</div>
          </div>
          <div class="filename" style="text-align:left; padding: 15px; font-size: 13px; color: #fff; line-height: 1.5; white-space: pre-wrap;">${post.message || 'ไม่มีแคปชั่น'}</div>
        </div>
      `;
    });
  }

  res.send(`
    <!DOCTYPE html>
    <html lang="th">
    <head>
      <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>รายการคิวบน Facebook</title>
      <link href="https://fonts.googleapis.com/css2?family=Prompt:wght@300;400;600&display=swap" rel="stylesheet">
      <style>
        body { font-family: 'Prompt', sans-serif; background: #1A110D; color: #fff; padding: 20px; margin: 0; }
        .header { text-align: center; margin-bottom: 30px; }
        h2 { color: #D4AF37; }
        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; }
        .card { background: #2C1A14; border-radius: 12px; overflow: hidden; border: 1px solid rgba(212, 175, 55, 0.2); }
        .btn-back { display: inline-block; margin-top: 30px; background: #333; color: #fff; padding: 10px 20px; border-radius: 8px; text-decoration: none; }
      </style>
    </head>
    <body>
      <div class="header">
        <h2>📋 โพสต์ทั้งหมดที่ปลอดภัย 100% บน Facebook</h2>
        <p style="color: #A99A86;">ระบบตรวจสอบจากคิวล่วงหน้าจริงบนเพจ <b>${files.length}</b> โพสต์</p>
      </div>
      <div class="grid">
        ${mediaHtml}
      </div>
      <div style="text-align: center;">
        <a href="/" class="btn-back">⬅️ กลับหน้าแรก</a>
      </div>
    </body>
    </html>
  `);
});

app.listen(PORT, () => {
  console.log(`Web Server & Bot running on port ${PORT}`);
});
