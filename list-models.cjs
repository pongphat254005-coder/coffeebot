const { GoogleGenerativeAI } = require('@google/generative-ai');

async function run() {
  try {
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models?key=AQ.Ab8RN6JpYz5sVy2HsqvzSEczRTA0vrPD93IyYha630Ssk_C-0g');
    const data = await res.json();
    const names = data.models.map(m => m.name);
    console.log(names.filter(n => n.includes('flash') || n.includes('pro')).join('\n'));
  } catch(e) {
    console.error(e);
  }
}
run();
