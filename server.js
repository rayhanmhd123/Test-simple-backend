const http = require('http');
const url = require('url');
const admin = require('firebase-admin');

// http://localhost:3000/list-tokens
// http://localhost:3000/send-notification?title=YAHYA&body=Hy

// Initialize Firebase Admin SDK
const serviceAccount = require('./serviceAccountKey.json'); // Replace with the path to your service account file
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// Array to store tokens (replace with a database in production)
let deviceTokens = [];

// Function to send notifications to each token
const sendNotification = async (title, body, tokens) => {
  const results = {
    successCount: 0,
    failureCount: 0,
    errors: [],
  };

  // Loop through each token
  for (const token of tokens) {
    const message = {
      notification: {
        title: title || 'Pesan Baru',
        body: body || 'Ini adalah notifikasi dari server!',
      },
      token: token, // Send to a specific token
      android: { priority: 'high' }, // High priority for Android
      apns: { headers: { 'apns-priority': '10' } }, // High priority for iOS
    };

    try {
      await admin.messaging().send(message);
      results.successCount++;
    } catch (error) {
      results.failureCount++;
      results.errors.push(`Gagal mengirim ke ${token}: ${error.message}`);
    }
  }

  return `Notifikasi selesai: ${results.successCount} berhasil, ${results.failureCount} gagal. ${
    results.errors.length > 0 ? 'Error: ' + results.errors.join('; ') : ''
  }`;
};

// Create HTTP server
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // Set headers for all responses (CORS)
  res.setHeader('Access-Control-Allow-Origin', '*'); // Allow all domains
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight request (OPTIONS)
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  // Endpoint to save token: /save-token?token=DEVICE_TOKEN
  if (pathname === '/save-token' && req.method === 'GET') {
    console.log('Request URL:', req.url);
    const token = parsedUrl.query.token;
    console.log('token:', token);
    if (token && !deviceTokens.includes(token)) {
      deviceTokens.push(token);
      res.statusCode = 200;
      res.end(`Token ${token} berhasil disimpan`);
    } else {
      res.statusCode = 400;
      res.end('Token tidak valid atau sudah ada');
    }
  }

  // Endpoint to list tokens: /list-tokens
  else if (pathname === '/list-tokens' && req.method === 'GET') {
    res.statusCode = 200;
    if (deviceTokens.length === 0) {
      res.end('Belum ada token yang disimpan');
    } else {
      res.end('Daftar token:\n' + deviceTokens.join('\n'));
    }
  }

  // Endpoint to send notification: /send-notification?title=Title&body=Content
  else if (pathname === '/send-notification' && req.method === 'GET') {
    const { title, body } = parsedUrl.query;
    if (deviceTokens.length === 0) {
      res.statusCode = 400;
      res.end('Belum ada token yang disimpan');
    } else {
      sendNotification(title, body, deviceTokens).then((result) => {
        res.statusCode = 200;
        res.end(result);
      });
    }
  }

  // If endpoint not found
  else {
    res.statusCode = 404;
    res.end('Endpoint tidak ditemukan. Gunakan: /save-token, /list-tokens, /send-notification');
  }
});

// Start server on port 3000, listening on all network interfaces
const PORT = 3000;
const HOST = '0.0.0.0'; // Listen on all network IPs
server.listen(PORT, HOST, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
  console.log(`Juga tersedia di alamat jaringan lokal (cek IP Anda)`);
});