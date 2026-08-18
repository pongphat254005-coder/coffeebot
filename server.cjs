const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Load the scheduler so cron jobs start running!
const { processQueue } = require('./scheduler.cjs');

const app = express();
const PORT = process.env.PORT || 3000;

// Setup directories
const NEW_DIR = path.join(__dirname, 'New');
const POSTED_DIR = path.join(__dirname, 'Posted');
const FAILED_DIR = path.join(__dirname, 'Failed');

if (!fs.existsSync(NEW_DIR)) fs.mkdirSync(NEW_DIR, { recursive: true });
if (!fs.existsSync(POSTED_DIR)) fs.mkdirSync(POSTED_DIR, { recursive: true });
if (!fs.existsSync(FAILED_DIR)) fs.mkdirSync(FAILED_DIR, { recursive: true });

// Multer storage config
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, NEW_DIR);
  },
  filename: function (req, file, cb) {
    // Keep original filename or generate a safe one
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'upload_' + uniqueSuffix + ext);
  }
});

const upload = multer({ storage: storage });

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Serve the 'New' directory so we can preview queued files
app.use('/media', express.static(NEW_DIR));

// Basic HTML UI for uploading
app.get('/', (req, res) => {
  const queuedFiles = fs.readdirSync(NEW_DIR).filter(f => !f.startsWith('.')).length;
  res.send(`
    <!DOCTYPE html>
    <html lang="th">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>อัปโหลดรูปลงบอท - กาแฟท้ายรถ</title>
      <link href="https://fonts.googleapis.com/css2?family=Prompt:wght@300;400;600&display=swap" rel="stylesheet">
      <style>
        body { 
          font-family: 'Prompt', sans-serif; 
          background: linear-gradient(135deg, #1A110D 0%, #2C1A14 100%); 
          color: #fff;
          padding: 20px; 
          text-align: center; 
          min-height: 100vh;
          margin: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .container { 
          width: 100%;
          max-width: 420px; 
          background: rgba(255, 255, 255, 0.03); 
          padding: 40px 30px; 
          border-radius: 20px; 
          box-shadow: 0 8px 32px rgba(0,0,0,0.5); 
          backdrop-filter: blur(10px);
          border: 1px solid rgba(212, 175, 55, 0.2);
        }
        h2 { 
          color: #D4AF37; 
          margin-top: 0;
          font-weight: 600;
          letter-spacing: 1px;
        }
        p {
          color: #A99A86;
          font-size: 14px;
          margin-bottom: 30px;
        }
        input[type=password], input[type=file] { 
          width: 100%; 
          padding: 14px; 
          margin: 10px 0; 
          background: rgba(0, 0, 0, 0.2);
          color: #fff;
          border: 1px solid rgba(212, 175, 55, 0.3); 
          border-radius: 10px; 
          box-sizing: border-box; 
          font-family: 'Prompt', sans-serif;
          transition: all 0.3s ease;
        }
        input[type=password]:focus, input[type=file]:focus {
          outline: none;
          border-color: #D4AF37;
          box-shadow: 0 0 10px rgba(212, 175, 55, 0.2);
        }
        /* Custom file input text */
        input[type=file]::file-selector-button {
          background: rgba(212, 175, 55, 0.1);
          color: #D4AF37;
          border: 1px solid #D4AF37;
          padding: 8px 16px;
          border-radius: 6px;
          margin-right: 15px;
          cursor: pointer;
          font-family: 'Prompt', sans-serif;
          transition: all 0.2s;
        }
        input[type=file]::file-selector-button:hover {
          background: #D4AF37;
          color: #1A110D;
        }
        button { 
          background: linear-gradient(90deg, #D4AF37 0%, #F3E5AB 50%, #D4AF37 100%);
          background-size: 200% auto;
          color: #1A110D; 
          border: none; 
          padding: 14px 20px; 
          margin-top: 15px;
          border-radius: 10px; 
          cursor: pointer; 
          width: 100%; 
          font-size: 16px; 
          font-weight: 600;
          font-family: 'Prompt', sans-serif;
          transition: 0.5s;
          box-shadow: 0 4px 15px rgba(212, 175, 55, 0.3);
        }
        button:hover { 
          background-position: right center;
        }
        button:disabled {
          background: #555;
          color: #888;
          cursor: not-allowed;
          box-shadow: none;
        }
        .footer { 
          margin-top: 30px; 
          font-size: 12px; 
          color: #6b7280; 
          letter-spacing: 0.5px;
        }
        
        /* Progress Bar Styles */
        #progressContainer {
          display: none;
          margin-top: 25px;
          text-align: left;
        }
        .progress-bg {
          width: 100%;
          background-color: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
          overflow: hidden;
          height: 12px;
          position: relative;
        }
        .progress-bar {
          width: 0%;
          height: 100%;
          background: linear-gradient(90deg, #D4AF37, #F3E5AB);
          border-radius: 10px;
          transition: width 0.3s ease;
        }
        .progress-text {
          color: #D4AF37;
          font-size: 14px;
          margin-top: 8px;
          display: flex;
          justify-content: space-between;
        }
        #statusMsg {
          margin-top: 15px;
          font-size: 14px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>✨ AI Coffee Bot ✨</h2>
        <p>อัปโหลดรูปภาพหรือวีดีโอ เพื่อส่งเข้าคิวโพสต์อัตโนมัติ</p>
        
        <form id="uploadForm">
          <input type="password" name="pin" id="pin" placeholder="รหัสผ่าน (PIN)" required />
          <input type="file" name="files" id="file" accept="image/*,video/*" multiple required />
          <button type="submit" id="submitBtn">🚀 อัปโหลดเข้าคิว</button>
        </form>

        <div style="margin-top: 20px; font-size: 14px; color: #D4AF37;">
          <p>📌 ตอนนี้มีรูป/วีดีโอ รอโพสต์อยู่ <b>${queuedFiles}</b> ไฟล์</p>
          <a href="/dashboard" style="color: #A99A86; text-decoration: underline; cursor: pointer;">📋 เข้าไปดูวีดีโอที่อัปโหลดไว้</a>
        </div>

        <div id="progressContainer">
          <div class="progress-bg">
            <div class="progress-bar" id="progressBar"></div>
          </div>
          <div class="progress-text">
            <span>กำลังอัปโหลด...</span>
            <span id="progressPercent">0%</span>
          </div>
        </div>
        
        <div id="statusMsg"></div>

        <div class="footer">Premium Admin Portal<br>© กาแฟสดท้ายรถ เมืองตาก</div>
      </div>

      <script>
        const form = document.getElementById('uploadForm');
        const progressContainer = document.getElementById('progressContainer');
        const progressBar = document.getElementById('progressBar');
        const progressPercent = document.getElementById('progressPercent');
        const statusMsg = document.getElementById('statusMsg');
        const submitBtn = document.getElementById('submitBtn');

        form.addEventListener('submit', function(e) {
          e.preventDefault();
          
          const formData = new FormData(form);
          const pin = document.getElementById('pin').value;
          const fileInput = document.getElementById('file');
          
          if (!pin || fileInput.files.length === 0) {
            statusMsg.innerHTML = '<span style="color:#ff6b6b">กรุณากรอกรหัสผ่านและเลือกไฟล์อย่างน้อย 1 ไฟล์</span>';
            return;
          }

          submitBtn.disabled = true;
          submitBtn.innerHTML = 'กำลังประมวลผล...';
          progressContainer.style.display = 'block';
          progressBar.style.width = '0%';
          progressPercent.innerText = '0%';
          statusMsg.innerHTML = '';
          
          const xhr = new XMLHttpRequest();
          xhr.open('POST', '/upload', true);
          
          xhr.upload.onprogress = function(e) {
            if (e.lengthComputable) {
              const percentComplete = Math.round((e.loaded / e.total) * 100);
              progressBar.style.width = percentComplete + '%';
              progressPercent.innerText = percentComplete + '%';
            }
          };
          
          xhr.onload = function() {
            if (xhr.status === 200) {
              statusMsg.innerHTML = '<span style="color:#4ade80">✅ อัปโหลดสำเร็จ! บอทได้รับ ' + fileInput.files.length + ' ไฟล์แล้ว</span>';
              form.reset();
            } else if (xhr.status === 401) {
              statusMsg.innerHTML = '<span style="color:#ff6b6b">❌ รหัสผ่านไม่ถูกต้อง!</span>';
            } else {
              statusMsg.innerHTML = '<span style="color:#ff6b6b">❌ เกิดข้อผิดพลาดในการอัปโหลด</span>';
            }
            submitBtn.disabled = false;
            submitBtn.innerHTML = '🚀 อัปโหลดไฟล์เพิ่ม';
            setTimeout(() => { progressContainer.style.display = 'none'; }, 5000);
          };
          
          xhr.onerror = function() {
            statusMsg.innerHTML = '<span style="color:#ff6b6b">❌ ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้</span>';
            submitBtn.disabled = false;
            submitBtn.innerHTML = '🚀 ลองใหม่อีกครั้ง';
            progressContainer.style.display = 'none';
          };
          
          xhr.send(formData);
        });
      </script>
    </body>
    </html>
  `);
});

// Handle upload (multiple files up to 10 at once)
app.post('/upload', upload.array('files', 10), (req, res) => {
  const pin = req.body.pin;
  // Simple password protection
  if (pin !== '9999') {
    if (req.files) {
      req.files.forEach(file => fs.unlinkSync(file.path)); // Delete unauthorized files
    }
    return res.status(401).send('<h2 style="color:red;text-align:center;margin-top:50px;">❌ รหัสผ่านไม่ถูกต้อง!</h2><br><center><a href="/">กลับไปลองใหม่</a></center>');
  }

  res.send('<h2 style="color:green;text-align:center;margin-top:50px;">✅ อัปโหลดสำเร็จ!</h2><br><center><a href="/">อัปโหลดเพิ่ม</a></center>');
});

app.get('/force-post', async (req, res) => {
  try {
    res.send('<h2 style="color:green;text-align:center;margin-top:50px;">🚀 กำลังสั่งให้ AI เริ่มแต่งแคปชั่นและโพสต์...<br>กรุณารอประมาณ 1-2 นาที แล้วเช็คที่หน้าเพจเฟซบุ๊กได้เลยครับ!</h2><br><center><a href="/">กลับหน้าหลัก</a></center>');
    // run async in background
    processQueue(false).catch(e => console.error("Force post error:", e));
  } catch (e) {
    res.send('<h2 style="color:red;text-align:center;margin-top:50px;">❌ บังคับโพสต์ล้มเหลว</h2>');
  }
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
        <h2>🔒 ใส่รหัสผ่านเพื่อดูคิวโพสต์</h2>
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

app.post('/dashboard', (req, res) => {
  if (req.body.pin !== '9999') return res.status(401).send('<h2 style="color:red;text-align:center;margin-top:50px;">❌ รหัสผ่านไม่ถูกต้อง!</h2><br><center><a href="/dashboard">กลับไปลองใหม่</a></center>');
  
  const files = fs.readdirSync(NEW_DIR).filter(f => !f.startsWith('.'));
  
  let mediaHtml = '';
  if (files.length === 0) {
    mediaHtml = '<p style="color:#A99A86;">ตอนนี้ไม่มีไฟล์ค้างอยู่ในคิวเลยครับ 🎉</p>';
  } else {
    files.forEach(file => {
      const isVideo = file.toLowerCase().endsWith('.mp4') || file.toLowerCase().endsWith('.mov');
      mediaHtml += `
        <div class="card">
          ${isVideo 
            ? `<video src="/media/${file}" controls preload="metadata"></video>`
            : `<img src="/media/${file}" />`
          }
          <div class="filename">${file}</div>
          <form action="/delete-file" method="POST" style="padding: 10px; margin: 0; text-align: center; border-top: 1px solid rgba(255,255,255,0.1);">
            <input type="hidden" name="pin" value="${req.body.pin}" />
            <input type="hidden" name="filename" value="${file}" />
            <button type="submit" style="width: 100%; padding: 8px; font-size: 12px; background: #ff4757; color: white; border: none; border-radius: 6px; cursor: pointer;" onclick="return confirm('คุณแน่ใจหรือไม่ว่าต้องการลบไฟล์นี้?')">🗑 ลบไฟล์นี้</button>
          </form>
        </div>
      `;
    });
  }

  res.send(`
    <!DOCTYPE html>
    <html lang="th">
    <head>
      <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>รายการคิวรอโพสต์</title>
      <link href="https://fonts.googleapis.com/css2?family=Prompt:wght@300;400;600&display=swap" rel="stylesheet">
      <style>
        body { font-family: 'Prompt', sans-serif; background: #1A110D; color: #fff; padding: 20px; margin: 0; }
        .header { text-align: center; margin-bottom: 30px; }
        h2 { color: #D4AF37; }
        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 15px; }
        .card { background: #2C1A14; border-radius: 12px; overflow: hidden; border: 1px solid rgba(212, 175, 55, 0.2); }
        .card img, .card video { width: 100%; height: 250px; object-fit: contain; display: block; background: #000; }
        .filename { padding: 10px; font-size: 11px; color: #A99A86; word-break: break-all; text-align: center; }
        .btn-back { display: inline-block; margin-top: 30px; background: #333; color: #fff; padding: 10px 20px; border-radius: 8px; text-decoration: none; }
      </style>
    </head>
    <body>
      <div class="header">
        <h2>📋 วีดีโอและรูปภาพที่รอคิวโพสต์</h2>
        <p style="color: #A99A86;">มีทั้งหมด <b>${files.length}</b> ไฟล์ในคิว</p>
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

app.post('/delete-file', (req, res) => {
  if (req.body.pin !== '9999') return res.status(401).send('Unauthorized');
  const filename = req.body.filename;
  if (!filename || filename.includes('/') || filename.includes('\\') || filename.startsWith('.')) {
    return res.status(400).send('Invalid filename');
  }
  const filepath = path.join(NEW_DIR, filename);
  if (fs.existsSync(filepath)) {
    fs.unlinkSync(filepath);
  }
  // Redirect back to dashboard preserving the POST payload (HTTP 307)
  res.redirect(307, '/dashboard');
});

app.listen(PORT, () => {
  console.log(`Web Server & Bot running on port ${PORT}`);
});
