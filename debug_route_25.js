const http = require('http');

const routeId = 25;

// Test different scenarios
const tests = [
  { name: 'Route Start (no location)', url: `http://localhost:3001/api/routes/${routeId}/split-points?startLocation=Route%20Start` },
  { name: 'Location 21', url: `http://localhost:3001/api/routes/${routeId}/split-points?locationId=21` },
  { name: 'Default (no params)', url: `http://localhost:3001/api/routes/${routeId}/split-points` },
];

async function fetchData(name, url) {
  return new Promise((resolve) => {
    console.log(`\n=== ${name} ===`);
    console.log(`URL: ${url}`);
    
    http.get(url, res => {
      let rawData = '';
      res.on('data', chunk => rawData += chunk);
      res.on('end', () => {
        try {
          const data = JSON.parse(rawData);
          console.log('Response:');
          console.log('  GOLD:', data.splitPoints?.gold?.length || 0, 'points');
          console.log('  SILVER:', data.splitPoints?.silver?.length || 0, 'points');
          console.log('  BRONZE:', data.splitPoints?.bronze?.length || 0, 'points');
          
          if (data.splitPoints?.silver?.length > 0) {
            console.log('  SILVER Details:');
            data.splitPoints.silver.forEach((sp, i) => {
              console.log(`    [${i+1}] Stage ${sp.stageNumber}: [${sp.lng}, ${sp.lat}] - ${sp.distanceKm}km`);
            });
          }
          resolve(data);
        } catch (e) {
          console.error('Parse error:', e.message);
          resolve(null);
        }
      });
    }).on('error', e => {
      console.error('Fetch error:', e.message);
      resolve(null);
    });
  });
}

async function main() {
  console.log('Testing Route 25 Split Points...\n');
  
  for (const test of tests) {
    await fetchData(test.name, test.url);
  }
  
  console.log('\n=== COMPARISON SUMMARY ===');
  console.log('If Location 21 has fewer points than Route Start,');
  console.log('then the split points were saved for Route Start, not Location 21.');
}

main();
