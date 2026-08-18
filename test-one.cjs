const scheduler = require('./scheduler.cjs');
scheduler.processQueue(false).then(() => console.log('Done test post.'));
