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

        console.log('Login response structure:', Object.keys(loginRes.data));
        const token = loginRes.data.data?.token || loginRes.data.token;

        if (!token) {
            console.error('❌ No token in response!', loginRes.data);
            return;
        }

        console.log('✅ Login successful');
        console.log('Token (first 50 chars):', token.substring(0, 50) + '...');

        // Get all locations
        console.log('\n2. Getting locations...');
        const locsRes = await axios.get('http://localhost:5000/api/locations');
        console.log(`✅ Found ${locsRes.data.data.length} locations`);

        // Try to delete a test location (if it exists)
        const testLoc = locsRes.data.data.find(l => l.id.startsWith('new-'));

        if (testLoc) {
            console.log(`\n3. Attempting to delete location: ${testLoc.name} (${testLoc.id})`);
            console.log('Sending Authorization header...');

            const deleteRes = await axios.delete(`http://localhost:5000/api/locations/${testLoc.id}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            console.log('✅ Delete successful!', deleteRes.data);
        } else {
            console.log('\n3. No test locations found to delete');
            console.log('Available location IDs:', locsRes.data.data.map(l => l.id).slice(0, 5));
        }

    } catch (error) {
        console.error('❌ Error:', error.response?.data || error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
        }
    }
}

testDelete();
