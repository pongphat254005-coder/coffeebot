const cron = require('node-cron');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { GoogleAIFileManager } = require('@google/generative-ai/server');

const NEW_DIR = path.join(__dirname, 'New');
const POSTED_DIR = path.join(__dirname, 'Posted');
const CONFIG_PATH = 'C:\\Users\\Asus\\.gemini\\config\\mcp_config.json'; // We will leave config path as is for now since the cloud server will use env vars later

// Helper: Get config
function getConfig() {
  if (fs.existsSync(CONFIG_PATH)) {
    const configStr = fs.readFileSync(CONFIG_PATH, 'utf8');
    return JSON.parse(configStr).mcpServers['social-media-mcp'].env;
  }
  // Fallback to process.env for Cloud Hosting (Render)
  return {
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    FACEBOOK_ACCESS_TOKEN: process.env.FACEBOOK_ACCESS_TOKEN,
    FACEBOOK_PAGE_ID: process.env.FACEBOOK_PAGE_ID
  };
}

// Generate AI Caption
async function generateAICaption(filePath, isVideo, isPromoTime) {
  const env = getConfig();
  if (!env.GEMINI_API_KEY) {
    throw new Error('No GEMINI_API_KEY found in config.');
  }

  const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
  const fileManager = new GoogleAIFileManager(env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });

  const prompt = isPromoTime 
    ? "คุณคือแอดมินเพจเฟซบุ๊ก 'กาแฟสดท้ายรถ เมืองตาก' สาขาหน้าวัดบางวัว จงดูรูปภาพหรือวีดีโอนี้ แล้วแต่งแคปชั่นสั้นๆ 2-3 บรรทัดให้ดึงดูดใจวัยรุ่นหนุ่มสาวโรงงานเพื่อชวนให้มาซื้อกาแฟหรือเครื่องดื่มก่อนเข้ากะตอนเช้า ใช้ภาษาเป็นกันเอง ตลก สนุกสนาน มีอีโมจิ (ห้ามใส่แฮชแท็กเพราะจะมีระบบใส่ให้อัตโนมัติ)" 
    : "คุณคือแอดมินเพจเฟซบุ๊ก 'กาแฟสดท้ายรถ เมืองตาก' จงดูรูปภาพหรือวีดีโอนี้ แล้วแต่งแคปชั่นสั้นๆ ให้ความรู้เกี่ยวกับกาแฟ เครื่องดื่ม หรือมุกตลกที่เกี่ยวกับรูปนี้ เพื่อสร้างปฏิสัมพันธ์กับลูกเพจ ใช้ภาษาเป็นกันเอง (ห้ามใส่แฮชแท็ก)";

  let result;
  
  try {
    if (isVideo) {
      console.log('Uploading video to Google AI File Manager...');
      const uploadResponse = await fileManager.uploadFile(filePath, {
        mimeType: 'video/mp4',
        displayName: path.basename(filePath),
      });
      console.log(`Video uploaded: ${uploadResponse.file.uri}`);
      
      // Wait for processing
      let fileState = await fileManager.getFile(uploadResponse.file.name);
      while (fileState.state === 'PROCESSING') {
        console.log('Waiting for video processing...');
        await new Promise((resolve) => setTimeout(resolve, 5000));
        fileState = await fileManager.getFile(uploadResponse.file.name);
      }
      
      if (fileState.state === 'FAILED') {
        throw new Error('Video processing failed.');
      }
      
      console.log('Generating content for video...');
      result = await model.generateContent([
        prompt,
        {
          fileData: {
            mimeType: uploadResponse.file.mimeType,
            fileUri: uploadResponse.file.uri
          }
        }
      ]);
    } else {
      console.log('Generating content for image...');
      const ext = path.extname(filePath).toLowerCase();
      let mimeType = 'image/jpeg';
      if (ext === '.png') mimeType = 'image/png';
      else if (ext === '.webp') mimeType = 'image/webp';
      
      result = await model.generateContent([
        prompt,
        {
          inlineData: {
            data: Buffer.from(fs.readFileSync(filePath)).toString("base64"),
            mimeType: mimeType
          }
        }
      ]);
    }
    
    return result.response.text().trim();
  } catch (error) {
    console.error('Error in AI Caption generation:', error.message);
    // Fallback if API key is invalid or fails
    return "เมนูเด็ดโดนใจคอกาแฟและสายชา! แวะมาเติมความอร่อยกันได้เลยครับ 🥤✨";
  }
}

// Upload function
async function processQueue(isPromoTime) {
  console.log(`[${new Date().toISOString()}] Checking queue... (PromoTime=${isPromoTime})`);
  if (!fs.existsSync(NEW_DIR)) return;

  const files = fs.readdirSync(NEW_DIR);
  if (files.length === 0) return;

  let targetFile = null;
  let isVideo = false;
  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (ext === '.mp4') {
      targetFile = file; isVideo = true; break;
    } else if (['.jpg', '.jpeg', '.png'].includes(ext)) {
      targetFile = file; isVideo = false; break;
    }
  }

  if (!targetFile) return;

  const filePath = path.join(NEW_DIR, targetFile);
  
  console.log(`Requesting AI to analyze ${targetFile}...`);
  const aiCaption = await generateAICaption(filePath, isVideo, isPromoTime);
  
  let finalCaption = aiCaption + '\n\n';
  if (isPromoTime) {
    finalCaption += `📍 พิกัด: ตลาดเช้า หน้าวัดบางวัว \n⏰ เปิดบริการ: 05:00 น. - 09:00 น.\n🏭 เติมพลังให้หนุ่มสาวโรงงานก่อนเข้ากะ แวะมารับความสดชื่นกันได้เลยครับ!\n#กาแฟสดหน้าวัดบางวัว #หนุ่มสาวโรงงาน #ตลาดเช้าวัดบางวัว #กาแฟสดท้ายรถ`;
  } else {
    finalCaption += `☕️ สาระน่ารู้ จากร้านกาแฟสดท้ายรถ เมืองตาก (สาขาวัดบางวัว)\n⏰ เปิดบริการทุกเช้า 05:00 - 09:00 น. พรุ่งนี้แวะมาเจอกันนะครับ!\n#กาแฟสดท้ายรถ #คอกาแฟ`;
  }

  const env = getConfig();
  try {
    let resData;
    if (isVideo) {
      console.log(`Starting Resumable Video Upload for ${targetFile}...`);
      const fileSize = fs.statSync(filePath).size;
      let startRes = await axios.post(`https://graph.facebook.com/v19.0/${env.FACEBOOK_PAGE_ID}/videos`, null, {
        params: { access_token: env.FACEBOOK_ACCESS_TOKEN, upload_phase: 'start', file_size: fileSize }
      });
      
      let { upload_session_id, start_offset, end_offset } = startRes.data;
      
      while (start_offset < fileSize) {
        console.log(`Uploading chunk: ${start_offset} to ${end_offset}...`);
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
      
      console.log('Finishing video upload...');
      let finishRes = await axios.post(`https://graph.facebook.com/v19.0/${env.FACEBOOK_PAGE_ID}/videos`, null, {
        params: { access_token: env.FACEBOOK_ACCESS_TOKEN, upload_phase: 'finish', upload_session_id: upload_session_id, description: finalCaption }
      });
      resData = finishRes.data;
    } else {
      console.log(`Uploading Photo to Facebook Page...`);
      const form = new FormData();
      form.append('access_token', env.FACEBOOK_ACCESS_TOKEN);
      form.append('message', finalCaption);
      form.append('source', fs.createReadStream(filePath));
      const pRes = await axios.post(`https://graph.facebook.com/v19.0/${env.FACEBOOK_PAGE_ID}/photos`, form, {
        headers: form.getHeaders(), maxContentLength: Infinity, maxBodyLength: Infinity
      });
      resData = pRes.data;
    }

    console.log('SUCCESS:', resData);
    fs.renameSync(filePath, path.join(POSTED_DIR, targetFile));
    console.log(`Moved to Posted.`);
  } catch (e) {
    console.error('ERROR uploading file:', e.response ? JSON.stringify(e.response.data) : e.message);
    const FAILED_DIR = path.join(__dirname, 'Failed');
    if (!fs.existsSync(FAILED_DIR)) fs.mkdirSync(FAILED_DIR);
    fs.renameSync(filePath, path.join(FAILED_DIR, targetFile));
    console.log(`Moved failed file to Failed directory to prevent queue blocking.`);
  }
}

// Schedule
cron.schedule('0 5,6,7,8 * * *', () => processQueue(true));
cron.schedule('0 10,12,14,16,18,20 * * *', () => processQueue(false));

module.exports = { processQueue };
