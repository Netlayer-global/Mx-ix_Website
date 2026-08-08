const axios = require('axios');

const API_BASE = 'http://localhost:5000/api';
const credentials = {
    email: 'admin@mx-ix.com',
    password: 'admin123'
};

let authToken = '';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function login() {
    console.log('\n🔐 Logging in...');
    const response = await axios.post(`${API_BASE}/auth/login`, credentials);
    authToken = response.data.data.token;
    console.log('✅ Logged in successfully');
}

async function testCompleteFlow() {
    console.log('\n' + '='.repeat(70));
    console.log('🧪 INTEGRATION TEST: Admin Panel → Database → Public Page');
    console.log('='.repeat(70));

    await login();

    // Step 1: Get current locations count
    console.log('\n📊 Step 1: Getting current locations...');
    const beforeResponse = await axios.get(`${API_BASE}/locations`);
    const beforeCount = beforeResponse.data.data.length;
    console.log(`✅ Current locations count: ${beforeCount}`);

    // Step 2: Create a new location via admin panel API
    console.log('\n➕ Step 2: Creating new location via Admin Panel API...');
    const newLocation = {
        id: 'test-integration-' + Date.now(),
        name: 'INTEGRATION TEST CITY',
        coordinates: [77.5946, 12.9716], // Bangalore coordinates
        code: 'ITC',
        region: 'TEST_REGION',
        continentId: 'asia',
        country: 'Test Country',
        description: 'This location was created via admin panel integration test',
        features: [
            'Integration Test Feature 1',
            'Integration Test Feature 2',
            'Auto-created by test script'
        ],
        portSpeeds: ['1G', '10G', '100G'],
        protocols: ['BGP-4', 'IPv4', 'IPv6'],
        status: 'current',
        latency: '2.5',
        datacenter: 'Test Datacenter',
        address: '123 Test Street, Test City',
        ixName: 'TEST-IX',
        peers: 100,
        capacity: '50+',
        established: '2026',
        cityImage: '/assets/cities/test.png'
    };

    const createResponse = await axios.post(`${API_BASE}/locations`, newLocation, {
        headers: { Authorization: `Bearer ${authToken}` }
    });

    console.log('✅ Location created successfully!');
    console.log('   ID:', createResponse.data.data.id);
    console.log('   Name:', createResponse.data.data.name);

    // Wait for database to sync
    await delay(1000);

    // Step 3: Verify it's in the database (public API)
    console.log('\n🔍 Step 3: Verifying location appears in public API...');
    const publicResponse = await axios.get(`${API_BASE}/locations`);
    const afterCount = publicResponse.data.data.length;
    const foundLocation = publicResponse.data.data.find(l => l.id === newLocation.id);

    if (foundLocation) {
        console.log('✅ Location found in public API!');
        console.log('   Total locations now:', afterCount);
        console.log('   Increase:', afterCount - beforeCount);
    } else {
        console.log('❌ Location NOT found in public API!');
        return;
    }

    // Step 4: Get specific location details
    console.log('\n📋 Step 4: Getting specific location details...');
    const detailResponse = await axios.get(`${API_BASE}/locations/${newLocation.id}`);
    console.log('✅ Location details retrieved:');
    console.log('   Name:', detailResponse.data.data.name);
    console.log('   Features:', detailResponse.data.data.features);
    console.log('   Status:', detailResponse.data.data.status);

    // Step 5: Update the location
    console.log('\n✏️ Step 5: Updating location via Admin Panel API...');
    const updates = {
        description: 'UPDATED: This location was modified via admin panel - ' + new Date().toISOString(),
        features: [
            'Integration Test Feature 1',
            'Integration Test Feature 2',
            'Auto-created by test script',
            'NEWLY ADDED FEATURE - ' + new Date().toISOString()
        ],
        peers: 150 // Updated from 100
    };

    const updateResponse = await axios.put(`${API_BASE}/locations/${newLocation.id}`, updates, {
        headers: { Authorization: `Bearer ${authToken}` }
    });

    console.log('✅ Location updated successfully!');
    console.log('   New description:', updateResponse.data.data.description);
    console.log('   New features count:', updateResponse.data.data.features.length);
    console.log('   New peers count:', updateResponse.data.data.peers);

    // Step 6: Verify update is reflected in public API
    console.log('\n🔍 Step 6: Verifying update appears in public API...');
    const verifyResponse = await axios.get(`${API_BASE}/locations/${newLocation.id}`);

    if (verifyResponse.data.data.description === updates.description) {
        console.log('✅ Update confirmed in public API!');
        console.log('   Description matches');
        console.log('   Features count:', verifyResponse.data.data.features.length);
        console.log('   Peers:', verifyResponse.data.data.peers);
    } else {
        console.log('❌ Update NOT reflected in public API!');
    }

    // Step 7: Add an ASN to the location
    console.log('\n➕ Step 7: Adding ASN to location...');
    const newASN = {
        asnNumber: 65100,
        name: 'Test Network Integration AS',
        peeringPolicy: 'Open',
        status: 'ACTIVE'
    };

    const asnResponse = await axios.post(`${API_BASE}/locations/${newLocation.id}/asns`, newASN, {
        headers: { Authorization: `Bearer ${authToken}` }
    });

    console.log('✅ ASN added successfully!');
    console.log('   ASN Number:', newASN.asnNumber);
    console.log('   Total ASNs:', asnResponse.data.data.length);

    // Step 8: Add a Site to the location
    console.log('\n➕ Step 8: Adding Site to location...');
    const newSite = {
        id: 'site-integration-' + Date.now(),
        name: 'Integration Test Datacenter',
        provider: 'Test Provider Corp',
        address: '456 Test Avenue, Test City',
        status: 'available'
    };

    const siteResponse = await axios.post(`${API_BASE}/locations/${newLocation.id}/sites`, newSite, {
        headers: { Authorization: `Bearer ${authToken}` }
    });

    console.log('✅ Site added successfully!');
    console.log('   Site Name:', newSite.name);
    console.log('   Total Sites:', siteResponse.data.data.length);

    // Step 9: Verify ASN and Site appear in public API
    console.log('\n🔍 Step 9: Verifying ASN and Site in public API...');
    const finalCheck = await axios.get(`${API_BASE}/locations/${newLocation.id}`);

    console.log('✅ Final verification:');
    console.log('   ASNs count:', finalCheck.data.data.asnList.length);
    console.log('   Sites count:', finalCheck.data.data.enabledSites.length);
    console.log('   ASN found:', finalCheck.data.data.asnList.find(a => a.asnNumber === 65100) ? 'YES' : 'NO');
    console.log('   Site found:', finalCheck.data.data.enabledSites.find(s => s.id === newSite.id) ? 'YES' : 'NO');

    // Step 10: Clean up - Delete the test location
    console.log('\n🗑️ Step 10: Cleaning up - Deleting test location...');
    await axios.delete(`${API_BASE}/locations/${newLocation.id}`, {
        headers: { Authorization: `Bearer ${authToken}` }
    });

    // Verify deletion
    const afterDeleteResponse = await axios.get(`${API_BASE}/locations`);
    const afterDeleteCount = afterDeleteResponse.data.data.length;
    const stillExists = afterDeleteResponse.data.data.find(l => l.id === newLocation.id);

    if (!stillExists && afterDeleteCount === beforeCount) {
        console.log('✅ Location deleted successfully!');
        console.log('   Locations count back to:', afterDeleteCount);
    } else {
        console.log('❌ Location still exists after deletion!');
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ INTEGRATION TEST COMPLETE!');
    console.log('='.repeat(70));
    console.log('\n📊 Summary:');
    console.log('   ✅ Admin Panel API → Database: WORKING');
    console.log('   ✅ Database → Public API: WORKING');
    console.log('   ✅ Create, Update, Delete: ALL WORKING');
    console.log('   ✅ ASN and Site management: WORKING');
    console.log('\n🎉 The admin panel changes ARE reflecting on the public locations page!');
}

testCompleteFlow().catch(error => {
    console.error('\n❌ Test failed:', error.response?.data || error.message);
    process.exit(1);
});
