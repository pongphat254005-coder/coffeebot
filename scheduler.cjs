const cron = require('node-cron');
process.env.TZ = 'Asia/Bangkok';
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { GoogleAIFileManager } = require('@google/generative-ai/server');

const NEW_DIR = path.join(__dirname, 'New');
const CONFIG_PATH = 'C:\\Users\\Asus\\.gemini\\config\\mcp_config.json';

function getConfig() {
  if (fs.existsSync(CONFIG_PATH)) {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')).mcpServers['social-media-mcp'].env;
  }
  return {
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    FACEBOOK_ACCESS_TOKEN: process.env.FACEBOOK_ACCESS_TOKEN,
    FACEBOOK_PAGE_ID: process.env.FACEBOOK_PAGE_ID
  };
}

// Calculate the next valid slot
function getNextSlotTime(startTimeStr) {
  const now = new Date();
  let baseTime = startTimeStr ? new Date(startTimeStr) : now;
  if (baseTime.getTime() < now.getTime()) baseTime = now;
  
  // Must be at least 15 minutes in the future
  const minValidTime = new Date(now.getTime() + 15 * 60000);
  if (baseTime.getTime() < minValidTime.getTime()) baseTime = minValidTime;

  const validHours = [5, 6, 7, 8, 10, 12, 14, 16, 18, 20];
  
  for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
    let d = new Date(baseTime);
    d.setDate(d.getDate() + dayOffset);
    d.setMinutes(0, 0, 0); // round to top of hour
    
    for (let vh of validHours) {
      d.setHours(vh);
      if (d.getTime() > baseTime.getTime() && d.getTime() > minValidTime.getTime()) {
        return d;
      }
    }
  }
}

async function getMaxScheduledTime(env) {
  try {
    const res = await axios.get(`https://graph.facebook.com/v19.0/${env.FACEBOOK_PAGE_ID}/scheduled_posts`, {
      params: { access_token: env.FACEBOOK_ACCESS_TOKEN, fields: 'scheduled_publish_time', limit: 100 }
    });
    if (res.data && res.data.data && res.data.data.length > 0) {
      let maxTime = 0;
      for (const post of res.data.data) {
        const t = post.scheduled_publish_time * 1000; // API returns unix timestamp sometimes, but let's safely parse
        // Actually facebook graph API scheduled_publish_time is ISO string or timestamp?
        // Wait, documentation says it's a UNIX timestamp!
        const parsedT = (typeof post.scheduled_publish_time === 'number') 
            ? post.scheduled_publish_time * 1000 
            : new Date(post.scheduled_publish_time).getTime();
        if (parsedT > maxTime) maxTime = parsedT;
      }
      if (maxTime > 0) return new Date(maxTime);
    }
  } catch (e) {
    console.error("Error fetching scheduled posts:", e.response ? e.response.data : e.message);
  }
  return new Date();
}

async function generateAICaption(filePath, isVideo, isPromoTime) {
  const env = getConfig();
  if (!env.GEMINI_API_KEY) throw new Error('No GEMINI_API_KEY found in config.');
  const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
  const { GoogleAIFileManager } = require('@google/generative-ai/server');
  const fileManager = new GoogleAIFileManager(env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });

  const prompt = isPromoTime 
    ? "คุณคือแอดมินเพจเฟซบุ๊ก 'กาแฟสดท้ายรถ เมืองตาก' สาขาหน้าวัดบางวัว จงดูวีดีโอหรือรูปภาพนี้ แล้วแต่งแคปชั่นสั้นๆ 2-3 บรรทัดให้ดึงดูดใจวัยรุ่นหนุ่มสาวโรงงานเพื่อชวนให้มาซื้อกาแฟหรือเครื่องดื่มก่อนเข้ากะตอนเช้า ใช้ภาษาเป็นกันเอง ตลก สนุกสนาน มีอีโมจิ (ห้ามใส่แฮชแท็กเพราะจะมีระบบใส่ให้อัตโนมัติ)" 
    : "คุณคือแอดมินเพจเฟซบุ๊ก 'กาแฟสดท้ายรถ เมืองตาก' จงดูวีดีโอหรือรูปภาพนี้ แล้วแต่งแคปชั่นสั้นๆ ให้ความรู้หรือบรรยายความน่ากินของเครื่องดื่ม หรือเล่นมุกตลก เพื่อสร้างปฏิสัมพันธ์กับลูกเพจ ใช้ภาษาเป็นกันเอง (ห้ามใส่แฮชแท็ก)";

  try {
    let result;
    if (isVideo) {
      const fileSize = fs.statSync(filePath).size;
      const MAX_GEMINI_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB safe limit for Render Free Tier RAM

      if (fileSize < MAX_GEMINI_VIDEO_SIZE) {
        // Upload full video
        const uploadResponse = await fileManager.uploadFile(filePath, { mimeType: 'video/mp4', displayName: path.basename(filePath) });
        let fileState = await fileManager.getFile(uploadResponse.file.name);
        while (fileState.state === 'PROCESSING') {
          await new Promise((r) => setTimeout(r, 5000));
          fileState = await fileManager.getFile(uploadResponse.file.name);
        }
        if (fileState.state === 'FAILED') throw new Error('Video processing failed.');
        result = await model.generateContent([prompt, { fileData: { mimeType: uploadResponse.file.mimeType, fileUri: uploadResponse.file.uri } }]);
      } else {
        // Fallback to frame extraction for huge videos
        const ffmpeg = require('fluent-ffmpeg');
        const ffmpegStatic = require('ffmpeg-static');
        ffmpeg.setFfmpegPath(ffmpegStatic);
        
        const framePath = path.join(__dirname, 'New', 'temp_frame_' + Date.now() + '.jpg');
        await new Promise((resolve, reject) => {
          ffmpeg(filePath)
            .on('end', resolve)
            .on('error', reject)
            .screenshots({
              timestamps: ['50%'],
              folder: path.dirname(framePath),
              filename: path.basename(framePath)
            });
        });
        
        result = await model.generateContent([prompt, { inlineData: { data: Buffer.from(fs.readFileSync(framePath)).toString("base64"), mimeType: 'image/jpeg' } }]);
        if (fs.existsSync(framePath)) fs.unlinkSync(framePath);
      }
    } else {
      const ext = path.extname(filePath).toLowerCase();
      let mimeType = 'image/jpeg';
      if (ext === '.png') mimeType = 'image/png';
      else if (ext === '.webp') mimeType = 'image/webp';
      result = await model.generateContent([prompt, { inlineData: { data: Buffer.from(fs.readFileSync(filePath)).toString("base64"), mimeType: mimeType } }]);
    }
    return result.response.text().trim();
  } catch (error) {
    console.error('Error in AI:', error.message);
    return "เมนูเด็ดโดนใจคอกาแฟและสายชา! แวะมาเติมความอร่อยกันได้เลยครับ 🥤✨";
  }
}

let isProcessing = false;

async function processQueue() {
  if (isProcessing) return;
  isProcessing = true;
  
  try {
    if (!fs.existsSync(NEW_DIR)) return;
    const env = getConfig();
    let currentMaxTime = await getMaxScheduledTime(env);
    
    while (true) {
      const files = fs.readdirSync(NEW_DIR).filter(f => !f.startsWith('.'));
      if (files.length === 0) break; // Queue empty

      let targetFile = null;
      let isVideo = false;
      for (const file of files) {
        const ext = path.extname(file).toLowerCase();
        if (ext === '.mp4' || ext === '.mov') { targetFile = file; isVideo = true; break; }
        else if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) { targetFile = file; isVideo = false; break; }
      }
      if (!targetFile) break;

      const filePath = path.join(NEW_DIR, targetFile);
      
      const nextSlotDate = getNextSlotTime(currentMaxTime);
      currentMaxTime = nextSlotDate; // update for next iteration
      
      const slotHour = nextSlotDate.getHours();
      const isPromoTime = (slotHour >= 5 && slotHour <= 8);
      
      console.log(`Processing ${targetFile} for scheduled time: ${nextSlotDate.toLocaleString()}`);
      
      const aiCaption = await generateAICaption(filePath, isVideo, isPromoTime);
      let finalCaption = aiCaption + '\n\n';
      if (isPromoTime) {
        finalCaption += `📍 พิกัด: ตลาดเช้า หน้าวัดบางวัว \n⏰ เปิดบริการ: 05:00 น. - 09:00 น.\n🏭 เติมพลังให้หนุ่มสาวโรงงานก่อนเข้ากะ แวะมารับความสดชื่นกันได้เลยครับ!\n#กาแฟสดหน้าวัดบางวัว #หนุ่มสาวโรงงาน #ตลาดเช้าวัดบางวัว #กาแฟสดท้ายรถ`;
      } else {
        finalCaption += `☕️ สาระน่ารู้ จากร้านกาแฟสดท้ายรถ เมืองตาก (สาขาวัดบางวัว)\n⏰ เปิดบริการทุกเช้า 05:00 - 09:00 น. พรุ่งนี้แวะมาเจอกันนะครับ!\n#กาแฟสดท้ายรถ #คอกาแฟ`;
      }

      const scheduledTimestamp = Math.floor(nextSlotDate.getTime() / 1000);

      try {
        if (isVideo) {
          const fileSize = fs.statSync(filePath).size;
          let startRes = await axios.post(`https://graph.facebook.com/v19.0/${env.FACEBOOK_PAGE_ID}/videos`, null, {
            params: { access_token: env.FACEBOOK_ACCESS_TOKEN, upload_phase: 'start', file_size: fileSize }
          });
          let { upload_session_id, start_offset, end_offset } = startRes.data;
          
          while (start_offset < fileSize) {
            const chunkStream = fs.createReadStream(filePath, { start: parseInt(start_offset), end: parseInt(end_offset) - 1 });
            const tForm = new FormData();
            tForm.append('access_token', env.FACEBOOK_ACCESS_TOKEN);
            tForm.append('upload_phase', 'transfer');
            tForm.append('upload_session_id', upload_session_id);
            tForm.append('start_offset', start_offset.toString());
            tForm.append('video_file_chunk', chunkStream);
            
            let tRes = await axios.post(`https://graph.facebook.com/v19.0/${env.FACEBOOK_PAGE_ID}/videos`, tForm, {
              headers: tForm.getHeaders(), maxContentLength: Infinity, maxBodyLength: Infinity
            });
            start_offset = tRes.data.start_offset;
            end_offset = tRes.data.end_offset;
          }
          await axios.post(`https://graph.facebook.com/v19.0/${env.FACEBOOK_PAGE_ID}/videos`, null, {
            params: { access_token: env.FACEBOOK_ACCESS_TOKEN, upload_phase: 'finish', upload_session_id: upload_session_id, description: finalCaption, published: false, scheduled_publish_time: scheduledTimestamp }
          });
        } else {
          const form = new FormData();
          form.append('access_token', env.FACEBOOK_ACCESS_TOKEN);
          form.append('message', finalCaption);
          form.append('published', 'false');
          form.append('scheduled_publish_time', scheduledTimestamp.toString());
          form.append('source', fs.createReadStream(filePath));
          await axios.post(`https://graph.facebook.com/v19.0/${env.FACEBOOK_PAGE_ID}/photos`, form, {
            headers: form.getHeaders(), maxContentLength: Infinity, maxBodyLength: Infinity
          });
        }
        
        fs.unlinkSync(filePath);
        console.log(`Successfully scheduled and deleted ${targetFile}`);
      } catch (e) {
        console.error(`ERROR uploading ${targetFile}:`, e.response ? JSON.stringify(e.response.data) : e.message);
        const FAILED_DIR = path.join(__dirname, 'Failed');
        if (!fs.existsSync(FAILED_DIR)) fs.mkdirSync(FAILED_DIR);
        fs.renameSync(filePath, path.join(FAILED_DIR, targetFile));
      }
    }
  } finally {
    isProcessing = false;
  }
}

// Removed cron schedule. processQueue will be triggered manually by server.cjs on upload.
module.exports = { processQueue };

