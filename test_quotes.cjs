const https = require('https');

const data = new URLSearchParams();
data.append('upload_preset', 'unsigned_preset');
data.append('file', 'data:image/png;base64,...');

const postData = data.toString();

const options = {
  hostname: 'api.cloudinary.com',
  port: 443,
  path: `/v1_1/%22dsct7klih%22/image/upload`,
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': Buffer.byteLength(postData)
  }
};

const req = https.request(options, (res) => {
  let chunks = '';
  res.on('data', (d) => {
    chunks += d;
  });
  res.on('end', () => {
    console.log("Status:", res.statusCode);
    console.log("Response:", chunks);
  });
});

req.on('error', (e) => {
  console.error(e);
});

req.write(postData);
req.end();
