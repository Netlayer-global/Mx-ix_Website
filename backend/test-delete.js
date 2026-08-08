// Quick test to verify delete endpoint works
const axios = require('axios');

async function testDelete() {
    try {
        // First, login to get token
        console.log('1. Logging in...');
        const loginRes = await axios.post('http://localhost:5000/api/auth/login', {
            email: 'admin@mx-ix.com',
            password: 'admin123'
        });

        const token = loginRes.data.token;
        console.log('✅ Login successful, got token');

        // Get all locations
        console.log('\n2. Getting locations...');
        const locsRes = await axios.get('http://localhost:5000/api/locations');
        console.log(`✅ Found ${locsRes.data.data.length} locations`);

        // Try to delete a test location (if it exists)
        const testLoc = locsRes.data.data.find(l => l.id.startsWith('new-'));

        if (testLoc) {
            console.log(`\n3. Attempting to delete location: ${testLoc.name} (${testLoc.id})`);
            const deleteRes = await axios.delete(`http://localhost:5000/api/locations/${testLoc.id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            console.log('✅ Delete successful!', deleteRes.data);
        } else {
            console.log('\n3. No test locations found to delete');
        }

    } catch (error) {
        console.error('❌ Error:', error.response?.data || error.message);
    }
}

testDelete();
