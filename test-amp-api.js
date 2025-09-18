// Quick test script for Amp API endpoint
const testAmpAPI = async () => {
  try {
    console.log('Testing Amp API endpoint...');

    const response = await fetch('http://localhost:3001/api/amp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'What are the latest trends?' }],
      }),
    });

    console.log('Response status:', response.status, response.statusText);

    if (response.ok) {
      const reader = response.body?.getReader();
      if (reader) {
        console.log('Streaming response:');
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = new TextDecoder().decode(value);
          process.stdout.write(chunk);
        }
        console.log('\n✅ API test completed successfully');
      } else {
        const text = await response.text();
        console.log('Response body:', text);
      }
    } else {
      const errorText = await response.text();
      console.error('❌ API error:', errorText);
    }
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
};

// Only run if this is the main module
if (require.main === module) {
  testAmpAPI();
}

module.exports = { testAmpAPI };
