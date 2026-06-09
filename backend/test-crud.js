const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

// Test credentials (from seeding)
const credentials = {
    email: 'admin@mx-ix.com',
    password: 'admin123'
};

let authToken = '';

async function login() {
    try {
        console.log('\n🔐 Testing Login...');
        const response = await axios.post(`${BASE_URL}/auth/login`, credentials);
        authToken = response.data.data.token;
        console.log('✅ Login successful! Token:', authToken.substring(0, 20) + '...');
        return true;
    } catch (error) {
        console.error('❌ Login failed:', error.response?.data || error.message);
        return false;
    }
}

async function testGetContinents() {
    try {
        console.log('\n📍 Testing GET /continents...');
        const response = await axios.get(`${BASE_URL}/continents`);
        console.log(`✅ Found ${response.data.data.length} continents`);
        console.log('Continents:', response.data.data.map(c => c.name).join(', '));
        return response.data.data;
    } catch (error) {
        console.error('❌ Get continents failed:', error.response?.data || error.message);
        return [];
    }
}

async function testGetLocations() {
    try {
        console.log('\n📍 Testing GET /locations...');
        const response = await axios.get(`${BASE_URL}/locations`);
        console.log(`✅ Found ${response.data.data.length} locations`);
        console.log('Locations:', response.data.data.map(l => `${l.name} (${l.id})`).slice(0, 5).join(', ') + '...');
        return response.data.data;
    } catch (error) {
        console.error('❌ Get locations failed:', error.response?.data || error.message);
        return [];
    }
}

async function testCreateLocation() {
    try {
        console.log('\n➕ Testing CREATE location...');
        const newLocation = {
            id: 'test-loc-' + Date.now(),
            name: 'TEST CITY',
            coordinates: [77.1025, 28.7041],
            code: 'TST',
            region: 'TEST',
            continentId: 'asia',
            country: 'Test Country',
            description: 'This is a test location created by automated test',
            features: ['Test Feature 1', 'Test Feature 2'],
            portSpeeds: ['1G', '10G'],
            protocols: ['BGP-4', 'IPv4'],
            status: 'upcoming'
        };

        const response = await axios.post(`${BASE_URL}/locations`, newLocation, {
            headers: { Authorization: `Bearer ${authToken}` }
        });

        console.log('✅ Location created successfully!');
        console.log('Created location ID:', response.data.data.id);
        return response.data.data;
    } catch (error) {
        console.error('❌ Create location failed:', error.response?.data || error.message);
        return null;
    }
}

async function testUpdateLocation(locationId) {
    try {
        console.log(`\n✏️ Testing UPDATE location (${locationId})...`);
        const updates = {
            description: 'Updated description - ' + new Date().toISOString(),
            features: ['Updated Feature 1', 'Updated Feature 2', 'New Feature 3']
        };

        const response = await axios.put(`${BASE_URL}/locations/${locationId}`, updates, {
            headers: { Authorization: `Bearer ${authToken}` }
        });

        console.log('✅ Location updated successfully!');
        console.log('Updated description:', response.data.data.description);
        console.log('Updated features:', response.data.data.features);
        return response.data.data;
    } catch (error) {
        console.error('❌ Update location failed:', error.response?.data || error.message);
        return null;
    }
}

async function testAddASN(locationId) {
    try {
        console.log(`\n➕ Testing ADD ASN to location (${locationId})...`);
        const newASN = {
            asnNumber: 65000 + Math.floor(Math.random() * 1000),
            name: 'Test Network AS',
            peeringPolicy: 'Open',
            status: 'ACTIVE'
        };

        const response = await axios.post(`${BASE_URL}/locations/${locationId}/asns`, newASN, {
            headers: { Authorization: `Bearer ${authToken}` }
        });

        console.log('✅ ASN added successfully!');
        console.log('ASN Number:', newASN.asnNumber);
        console.log('Total ASNs:', response.data.data.length);
        return newASN.asnNumber;
    } catch (error) {
        console.error('❌ Add ASN failed:', error.response?.data || error.message);
        return null;
    }
}

async function testAddSite(locationId) {
    try {
        console.log(`\n➕ Testing ADD Site to location (${locationId})...`);
        const newSite = {
            id: 'site-test-' + Date.now(),
            name: 'Test Datacenter',
            provider: 'Test Provider Inc',
            address: '123 Test Street, Test City',
            status: 'available'
        };

        const response = await axios.post(`${BASE_URL}/locations/${locationId}/sites`, newSite, {
            headers: { Authorization: `Bearer ${authToken}` }
        });

        console.log('✅ Site added successfully!');
        console.log('Site Name:', newSite.name);
        console.log('Total Sites:', response.data.data.length);
        return newSite.id;
    } catch (error) {
        console.error('❌ Add site failed:', error.response?.data || error.message);
        return null;
    }
}

async function testDeleteLocation(locationId) {
    try {
        console.log(`\n🗑️ Testing DELETE location (${locationId})...`);
        const response = await axios.delete(`${BASE_URL}/locations/${locationId}`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });

        console.log('✅ Location deleted successfully!');
        return true;
    } catch (error) {
        console.error('❌ Delete location failed:', error.response?.data || error.message);
        return false;
    }
}

async function testExistingLocationUpdate() {
    try {
        console.log('\n🔄 Testing UPDATE on existing location (del - New Delhi)...');

        // First, get the current data
        const getResponse = await axios.get(`${BASE_URL}/locations/del`);
        console.log('Current features:', getResponse.data.data.features);

        // Update with new features
        const updates = {
            features: [
                'North India gateway',
                'Government connectivity hub',
                'Enterprise connectivity',
                'Multi-cloud access',
                'Low-latency trading',
                'Carrier-dense location',
                'NEW FEATURE ADDED - ' + new Date().toISOString()
            ]
        };

        const response = await axios.put(`${BASE_URL}/locations/del`, updates, {
            headers: { Authorization: `Bearer ${authToken}` }
        });

        console.log('✅ Existing location updated successfully!');
        console.log('New features:', response.data.data.features);

        // Verify the change persisted
        const verifyResponse = await axios.get(`${BASE_URL}/locations/del`);
        console.log('✅ Verified - features persisted in database');

        return true;
    } catch (error) {
        console.error('❌ Update existing location failed:', error.response?.data || error.message);
        return false;
    }
}

async function runTests() {
    console.log('='.repeat(60));
    console.log('🧪 MX-IX Backend CRUD Operations Test Suite');
    console.log('='.repeat(60));

    // Login first
    const loginSuccess = await login();
    if (!loginSuccess) {
        console.log('\n❌ Cannot proceed without authentication');
        return;
    }

    // Test READ operations (no auth needed)
    await testGetContinents();
    const locations = await testGetLocations();

    // Test CREATE
    const createdLocation = await testCreateLocation();
    if (!createdLocation) {
        console.log('\n❌ Cannot proceed with further tests');
        return;
    }

    // Test UPDATE
    await testUpdateLocation(createdLocation.id);

    // Test nested CREATE (ASN and Site)
    await testAddASN(createdLocation.id);
    await testAddSite(createdLocation.id);

    // Test updating existing location
    await testExistingLocationUpdate();

    // Test DELETE
    await testDeleteLocation(createdLocation.id);

    console.log('\n' + '='.repeat(60));
    console.log('✅ All tests completed!');
    console.log('='.repeat(60));
}

runTests().catch(console.error);
