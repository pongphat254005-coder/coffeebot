const { google } = require('googleapis');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

async function uploadToYouTube(filePath, title, description, oauthToken) {
  try {
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: oauthToken });
    
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
    
    const fileSize = fs.statSync(filePath).size;
    const res = await youtube.videos.insert({
      part: 'id,snippet,status',
      notifySubscribers: false,
      requestBody: {
        snippet: {
          title: title,
          description: description,
          categoryId: '22' // People & Blogs
        },
        status: {
          privacyStatus: 'public',
          selfDeclaredMadeForKids: false
        }
      },
      media: {
        body: fs.createReadStream(filePath)
      }
    }, {
      onUploadProgress: evt => {
        const progress = (evt.bytesRead / fileSize) * 100;
        console.log(`YouTube Upload Progress: ${Math.round(progress)}%`);
      }
    });
    
    console.log('Successfully uploaded to YouTube Shorts. Video ID:', res.data.id);
    return res.data;
  } catch (error) {
    console.error('Error uploading to YouTube:', error.message);
    throw error;
  }
}

async function uploadToTikTok(filePath, caption, accessToken) {
  try {
    const fileSize = fs.statSync(filePath).size;
    
    // 1. Initialize Post
    const initRes = await axios.post('https://open.tiktokapis.com/v2/post/publish/video/init/', {
      source_info: {
        source: "FILE_UPLOAD",
        video_size: fileSize,
        chunk_size: fileSize,
        total_chunk_count: 1
      }
    }, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    const uploadUrl = initRes.data.data.upload_url;
    const publishId = initRes.data.data.publish_id;

    // 2. Upload Video chunk
    await axios.put(uploadUrl, fs.createReadStream(filePath), {
      headers: {
        'Content-Range': `bytes 0-${fileSize - 1}/${fileSize}`,
        'Content-Type': 'video/mp4'
      }
    });

    console.log('Successfully uploaded to TikTok. Publish ID:', publishId);
    return publishId;
  } catch (error) {
    console.error('Error uploading to TikTok:', error.response ? JSON.stringify(error.response.data) : error.message);
    throw error;
  }
}

module.exports = { uploadToYouTube, uploadToTikTok };
