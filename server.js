const http = require('http');
const url = require('url');
const admin = require('firebase-admin');

// Inisialisasi Firebase Admin SDK
const serviceAccount = require('./serviceAccountKey.json'); // Ganti dengan path ke file service account Anda
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// Array untuk menyimpan token (ganti dengan database di produksi)
let deviceTokens = [];

// Fungsi untuk mengirim notifikasi ke setiap token
const sendNotification = async (title, body, tokens) => {
  const results = {
    successCount: 0,
    failureCount: 0,
    errors: [],
  };

  // Loop untuk setiap token
  for (const token of tokens) {
    const message = {
      notification: {
        title: title || 'Pesan Baru',
        body: body || 'Ini adalah notifikasi dari server!',
      },
      token: token, // Kirim ke satu token spesifik
      android: { priority: 'high' }, // Prioritas tinggi untuk Android
      apns: { headers: { 'apns-priority': '10' } }, // Prioritas tinggi untuk iOS
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

// Buat server HTTP
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // Set header untuk semua respons (CORS)
  res.setHeader('Access-Control-Allow-Origin', '*'); // Izinkan semua domain
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Tangani preflight request (OPTIONS)
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  // Endpoint untuk menyimpan token: /save-token?token=DEVICE_TOKEN
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

  // Endpoint untuk menampilkan token: /list-tokens
  else if (pathname === '/list-tokens' && req.method === 'GET') {
    res.statusCode = 200;
    if (deviceTokens.length === 0) {
      res.end('Belum ada token yang disimpan');
    } else {
      res.end('Daftar token:\n' + deviceTokens.join('\n'));
    }
  }

  // Endpoint untuk mengirim notifikasi: /send-notification?title=Judul&body=Isi
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

  // Jika endpoint tidak ditemukan
  else {
    res.statusCode = 404;
    res.end('Endpoint tidak ditemukan. Gunakan: /save-token, /list-tokens, /send-notification');
  }
});

// Jalankan server di port 3000, mendengarkan semua antarmuka jaringan
const PORT = 3000;
const HOST = '0.0.0.0'; // Mendengarkan semua IP jaringan
server.listen(PORT, HOST, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
  console.log(`Juga tersedia di alamat jaringan lokal (cek IP Anda)`);
});