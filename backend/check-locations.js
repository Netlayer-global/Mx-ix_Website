const axios = require('axios');

async function checkLocations() {
    const response = await axios.get('http://localhost:5000/api/locations');
    const locations = response.data.data;

    console.log(`\n📊 Total locations in database: ${locations.length}\n`);

    // Check for test locations
    const testLocs = locations.filter(l => l.id.includes('test'));
    if (testLocs.length > 0) {
        console.log('🧪 Test locations found:');
        testLocs.forEach(l => {
            console.log(`   - ${l.name} (${l.id})`);
            console.log(`     Features: ${l.features?.length || 0}`);
            console.log(`     ASNs: ${l.asnList?.length || 0}`);
            console.log(`     Sites: ${l.enabledSites?.length || 0}`);
        });
    } else {
        console.log('✅ No test locations (clean database)');
    }

    console.log('\n📍 All locations:');
    locations.forEach((l, i) => {
        console.log(`   ${i + 1}. ${l.name} (${l.id}) - ${l.status}`);
    });
}

checkLocations().catch(console.error);
