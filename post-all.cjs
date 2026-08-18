const fs = require('fs');
const scheduler = require('./scheduler.cjs');
const NEW_DIR = 'C:\\Users\\Asus\\Desktop\\ReadyToPost_Coffee\\New';

async function postAll() {
  console.log('เริ่มโพสต์รูปที่ค้างอยู่ในโฟลเดอร์ New ทั้งหมด...');
  while (true) {
    if (!fs.existsSync(NEW_DIR)) break;
    const files = fs.readdirSync(NEW_DIR);
    if (files.length === 0) break;
    
    console.log(`เหลือไฟล์ในคิว ${files.length} ไฟล์... กำลังโพสต์ไฟล์แรกสุด`);
    // Pass true for promo time to use the promo captions
    await scheduler.processQueue(true);
    
    // Wait 5 seconds between posts to avoid spamming the API
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  console.log('โพสต์รูปที่ค้างอยู่สำเร็จทั้งหมดแล้ว!');
}

postAll();
