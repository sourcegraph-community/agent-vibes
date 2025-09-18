// Simple Node.js script to test API routes locally
const http = require('http');

function testEndpoint(path, description) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: 'GET',
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          console.log(`✅ ${description}`);
          console.log(`   Status: ${res.statusCode}`);
          console.log(`   Response keys: ${Object.keys(parsed).join(', ')}\n`);
          resolve({ status: res.statusCode, data: parsed });
        } catch (error) {
          console.log(`❌ ${description} - Parse error: ${error.message}\n`);
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      console.log(`❌ ${description} - Request error: ${error.message}\n`);
      reject(error);
    });

    req.end();
  });
}

async function runTests() {
  console.log('Testing API Routes...\n');

  const tests = [
    ['/api/entries', 'Entries endpoint'],
    ['/api/entries?limit=5', 'Entries with limit'],
    ['/api/entries?category=research', 'Entries filtered by category'],
    ['/api/metrics/sentiment', 'Sentiment metrics'],
    ['/api/highlights', 'Highlights endpoint'],
    ['/api/highlights?limit=3', 'Highlights with limit'],
  ];

  for (const [path, desc] of tests) {
    try {
      await testEndpoint(path, desc);
    } catch (error) {
      // Continue with next test
    }
  }
}

runTests().catch(console.error);
