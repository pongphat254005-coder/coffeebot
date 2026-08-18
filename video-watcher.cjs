const chokidar = require('chokidar');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const NEW_DIR = 'C:\\Users\\Asus\\Desktop\\ReadyToPost_Coffee\\New';
const POSTED_DIR = 'C:\\Users\\Asus\\Desktop\\ReadyToPost_Coffee\\Posted';
const CONFIG_PATH = 'C:\\Users\\Asus\\.gemini\\config\\mcp_config.json';

// Utility to get fresh tokens
function getConfig() {
  const configStr = fs.readFileSync(CONFIG_PATH, 'utf8');
  return JSON.parse(configStr).mcpServers['social-media-mcp'].env;
}

// Upload video function
async function uploadVideo(filePath) {
  console.log(`[${new Date().toISOString()}] Detected new file: ${filePath}`);
  if (!filePath.toLowerCase().endsWith('.mp4')) {
    console.log('Not an MP4 file, skipping.');
    return;
  }

  const env = getConfig();
  const fileName = path.basename(filePath, '.mp4');
  const caption = `${fileName}\n\n#กาแฟสดท้ายรถ #เมืองตาก #ร้านกาแฟเมืองตาก #คอกาแฟ`;
  
  const form = new FormData();
  form.append('access_token', env.FACEBOOK_ACCESS_TOKEN);
  form.append('description', caption);
  form.append('source', fs.createReadStream(filePath));

  console.log(`Uploading to Facebook Page: ${env.FACEBOOK_PAGE_ID}...`);
  
  try {
    const res = await axios.post(`https://graph.facebook.com/v19.0/${env.FACEBOOK_PAGE_ID}/videos`, form, {
      headers: form.getHeaders(),
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });
    
    console.log('SUCCESS:', res.data);
    
    // Move to Posted folder
    const targetPath = path.join(POSTED_DIR, path.basename(filePath));
    fs.renameSync(filePath, targetPath);
    console.log(`Moved to Posted: ${targetPath}`);
    
  } catch (e) {
    console.error('ERROR uploading video:', e.response ? e.response.data : e.message);
  }
}

// Watcher
const watcher = chokidar.watch(NEW_DIR, {
  ignored: /(^|[\/\\])\../, // ignore dotfiles
  persistent: true,
  awaitWriteFinish: {
    stabilityThreshold: 2000,
    pollInterval: 100
  }
});

watcher
  .on('add', filePath => {
    uploadVideo(filePath);
  })
  .on('error', error => console.log(`Watcher error: ${error}`));

console.log(`[Auto-Post Video System Started]`);
console.log(`Watching directory: ${NEW_DIR}`);
console.log(`Waiting for new videos...`);
