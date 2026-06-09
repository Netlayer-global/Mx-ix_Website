// Diagnostic Script for Grafana/Zabbix Traffic Data Issue
// Run this with: node test-grafana-diagnostics.js

const config = {
    grafanaUrl: process.env.GRAFANA_URL || 'http://103.139.191.165:3000',
    grafanaApiKey: process.env.GRAFANA_API_KEY || 'YOUR_API_KEY_HERE',
    backendUrl: 'http://localhost:5000',
    zabbixDatasourceUid: 'bezy0nzf8ykg0c'
};

const TRAFFIC_QUERIES = [
    {
        group: 'Applications',
        host: 'LVSB SW-01',
        item: 'Interface Eth-Trunk1(): Bits received',
        itemTag: 'interface: Eth-Trunk1'
    },
    {
        group: 'Applications',
        host: 'LVSB SW-01',
        item: 'Interface Eth-Trunk1(): Bits sent',
        itemTag: 'interface: Eth-Trunk1'
    },
    {
        group: 'Applications',
        host: 'MB2 SW-01',
        item: 'Interface Eth-Trunk1(EQX MB2 to NTT TRUNK): Bits received',
        itemTag: 'description: EQX MB2 to NTT TRUNK'
    },
    {
        group: 'Applications',
        host: 'MB2 SW-01',
        item: 'Interface Eth-Trunk1(EQX MB2 to NTT TRUNK): Bits sent',
        itemTag: 'description: EQX MB2 to NTT TRUNK'
    }
];

// Test results
const results = {
    grafanaHealth: null,
    datasourceConnection: null,
    trafficQueries: [],
    backendStatus: null,
    backendTraffic: null,
    errors: []
};

// Helper to make HTTP requests
async function makeRequest(url, options = {}) {
    try {
        const response = await fetch(url, options);
        const text = await response.text();

        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            data = text;
        }

        return {
            status: response.status,
            ok: response.ok,
            data,
            headers: Object.fromEntries(response.headers.entries())
        };
    } catch (error) {
        return {
            status: 0,
            ok: false,
            error: error.message
        };
    }
}

// Test 1: Grafana Health Check
async function testGrafanaHealth() {
    console.log('\n🔍 TEST 1: Grafana Health Check');
    console.log('━'.repeat(60));

    const result = await makeRequest(`${config.grafanaUrl}/api/health`, {
        headers: {
            'Authorization': `Bearer ${config.grafanaApiKey}`
        }
    });

    results.grafanaHealth = result;

    if (result.ok) {
        console.log('✅ Grafana is accessible');
        console.log(`   Version: ${result.data.version || 'unknown'}`);
        console.log(`   Database: ${result.data.database || 'unknown'}`);
    } else {
        console.log('❌ Grafana is NOT accessible');
        console.log(`   Status: ${result.status}`);
        console.log(`   Error: ${result.error || JSON.stringify(result.data)}`);
        results.errors.push(`Grafana health check failed: ${result.error || result.status}`);
    }

    return result.ok;
}

// Test 2: Zabbix Datasource Connection
async function testZabbixDatasource() {
    console.log('\n🔍 TEST 2: Zabbix Datasource Connection');
    console.log('━'.repeat(60));

    const result = await makeRequest(`${config.grafanaUrl}/api/datasources/uid/${config.zabbixDatasourceUid}`, {
        headers: {
            'Authorization': `Bearer ${config.grafanaApiKey}`
        }
    });

    results.datasourceConnection = result;

    if (result.ok) {
        console.log('✅ Zabbix datasource found');
        console.log(`   Name: ${result.data.name || 'unknown'}`);
        console.log(`   Type: ${result.data.type || 'unknown'}`);
        console.log(`   URL: ${result.data.url || 'unknown'}`);
    } else {
        console.log('❌ Zabbix datasource NOT found');
        console.log(`   Status: ${result.status}`);
        console.log(`   Error: ${result.error || JSON.stringify(result.data)}`);
        results.errors.push(`Zabbix datasource not found: ${result.error || result.status}`);
    }

    return result.ok;
}

// Test 3: Individual Traffic Queries
async function testTrafficQueries() {
    console.log('\n🔍 TEST 3: Individual Traffic Queries');
    console.log('━'.repeat(60));

    for (let i = 0; i < TRAFFIC_QUERIES.length; i++) {
        const query = TRAFFIC_QUERIES[i];
        console.log(`\nQuery ${i + 1}: ${query.host} - ${query.item}`);

        const result = await makeRequest(`${config.grafanaUrl}/api/ds/query`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${config.grafanaApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                queries: [{
                    refId: 'A',
                    datasource: {
                        type: 'alexanderzobnin-zabbix-datasource',
                        uid: config.zabbixDatasourceUid
                    },
                    queryType: '0',
                    group: { filter: query.group },
                    host: { filter: query.host },
                    item: { filter: query.item },
                    itemTag: { filter: query.itemTag || '' },
                    options: {
                        showDisabledItems: false,
                        skipEmptyValues: false,
                        useTrends: 'default'
                    }
                }],
                from: 'now-5m',
                to: 'now'
            })
        });

        results.trafficQueries.push({ query, result });

        if (result.ok) {
            const values = result.data?.results?.A?.frames?.[0]?.data?.values;
            if (values && values[1] && values[1].length > 0) {
                const dataPoints = values[1].length;
                const latestValue = values[1][values[1].length - 1];
                const maxValue = Math.max(...values[1].filter(v => typeof v === 'number'));

                console.log(`✅ Query successful - ${dataPoints} data points`);
                console.log(`   Latest value: ${latestValue} bits/sec`);
                console.log(`   Latest (Gbps): ${(latestValue / 1_000_000_000).toFixed(2)} Gbps`);
                console.log(`   Max (Gbps): ${(maxValue / 1_000_000_000).toFixed(2)} Gbps`);
            } else {
                console.log('⚠️  Query returned no data');
                console.log(`   Response structure: ${JSON.stringify(result.data).substring(0, 500)}`);
                results.errors.push(`Query ${i + 1} returned no data: ${query.host} - ${query.item}`);
            }
        } else {
            console.log('❌ Query failed');
            console.log(`   Status: ${result.status}`);
            console.log(`   Error: ${result.error || JSON.stringify(result.data).substring(0, 500)}`);
            results.errors.push(`Query ${i + 1} failed: ${result.error || result.status}`);
        }
    }
}

// Test 4: Backend Status
async function testBackendStatus() {
    console.log('\n🔍 TEST 4: Backend Status Endpoint');
    console.log('━'.repeat(60));

    const result = await makeRequest(`${config.backendUrl}/api/grafana/status`);
    results.backendStatus = result;

    if (result.ok) {
        console.log('✅ Backend API is accessible');
        console.log(`   Connected: ${result.data?.data?.connected}`);
        console.log(`   Message: ${result.data?.data?.message}`);
    } else {
        console.log('❌ Backend API is NOT accessible');
        console.log(`   Status: ${result.status}`);
        console.log(`   Error: ${result.error || 'Connection failed'}`);
        results.errors.push(`Backend not accessible: ${result.error || result.status}`);
    }

    return result.ok;
}

// Test 5: Backend Traffic Endpoint
async function testBackendTraffic() {
    console.log('\n🔍 TEST 5: Backend Traffic Endpoint');
    console.log('━'.repeat(60));

    const result = await makeRequest(`${config.backendUrl}/api/grafana/traffic`);
    results.backendTraffic = result;

    if (result.ok) {
        const data = result.data?.data;
        console.log('✅ Backend traffic endpoint is accessible');
        console.log(`   Current Traffic: ${data?.currentTraffic} ${data?.unit}`);
        console.log(`   Peak Traffic: ${data?.peakTraffic} ${data?.unit}`);
        console.log(`   Inbound: ${data?.details?.inbound} ${data?.unit}`);
        console.log(`   Outbound: ${data?.details?.outbound} ${data?.unit}`);
        console.log(`   Source: ${data?.source}`);

        if (data?.source !== 'grafana') {
            console.log('\n⚠️  WARNING: Using mock/fallback data, not real Grafana data!');
            results.errors.push('Backend is returning mock data instead of Grafana data');
        }

        if (data?.details?.inbound === 0 && data?.details?.outbound === 0) {
            console.log('\n❌ PROBLEM: Inbound and Outbound are both 0!');
            results.errors.push('Inbound/Outbound showing 0.00 - no real data');
        }
    } else {
        console.log('❌ Backend traffic endpoint failed');
        console.log(`   Status: ${result.status}`);
        console.log(`   Error: ${result.error || JSON.stringify(result.data)}`);
        results.errors.push(`Backend traffic endpoint failed: ${result.error || result.status}`);
    }
}

// Summary Report
function printSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 DIAGNOSTIC SUMMARY');
    console.log('='.repeat(60));

    console.log('\n✓ Tests Passed:');
    let passCount = 0;
    if (results.grafanaHealth?.ok) { console.log('  • Grafana Health'); passCount++; }
    if (results.datasourceConnection?.ok) { console.log('  • Zabbix Datasource'); passCount++; }
    if (results.backendStatus?.ok) { console.log('  • Backend Status'); passCount++; }
    if (results.backendTraffic?.ok) { console.log('  • Backend Traffic'); passCount++; }

    const successfulQueries = results.trafficQueries.filter(q => q.result.ok && q.result.data?.results?.A?.frames?.[0]?.data?.values?.[1]?.length > 0).length;
    if (successfulQueries > 0) {
        console.log(`  • Traffic Queries: ${successfulQueries}/${TRAFFIC_QUERIES.length}`);
        passCount++;
    }

    if (results.errors.length > 0) {
        console.log('\n❌ Errors Detected:');
        results.errors.forEach((error, idx) => {
            console.log(`  ${idx + 1}. ${error}`);
        });
    } else {
        console.log('\n✅ No errors detected - system appears healthy!');
    }

    console.log('\n🔍 Root Cause Analysis:');
    if (!results.grafanaHealth?.ok) {
        console.log('  ❌ CRITICAL: Cannot connect to Grafana server');
        console.log('     → Check if Grafana is running on 103.139.191.165:3000');
        console.log('     → Verify network connectivity');
        console.log('     → Check firewall rules');
    } else if (!results.datasourceConnection?.ok) {
        console.log('  ❌ CRITICAL: Zabbix datasource not found in Grafana');
        console.log('     → Verify datasource UID: bezy0nzf8ykg0c');
        console.log('     → Check Grafana datasource configuration');
    } else if (results.trafficQueries.some(q => !q.result.ok)) {
        console.log('  ❌ CRITICAL: Some traffic queries are failing');
        console.log('     → Check Zabbix host names (LVSB SW-01, MB2 SW-01)');
        console.log('     → Verify item names in Zabbix');
        console.log('     → Check item tags configuration');
    } else if (results.backendTraffic?.data?.data?.source !== 'grafana') {
        console.log('  ⚠️  Backend is using fallback/mock data');
        console.log('     → Backend can\'t get real data from Grafana');
        console.log('     → Check backend logs for errors');
    } else if (results.backendTraffic?.data?.data?.details?.inbound === 0) {
        console.log('  ⚠️  Queries succeed but return zero values');
        console.log('     → Zabbix items may not be collecting data');
        console.log('     → Check Zabbix host/item configuration');
        console.log('     → Verify data is being collected in Zabbix');
    } else {
        console.log('  ✅ All systems appear healthy!');
    }

    console.log('\n' + '='.repeat(60));
}

// Run all tests
async function runDiagnostics() {
    console.log('🚀 Starting Grafana/Zabbix Diagnostics...');
    console.log('Target: ' + config.grafanaUrl);
    console.log('Backend: ' + config.backendUrl);

    await testGrafanaHealth();
    await testZabbixDatasource();
    await testTrafficQueries();
    await testBackendStatus();
    await testBackendTraffic();

    printSummary();

    // Exit with error code if there are errors
    process.exit(results.errors.length > 0 ? 1 : 0);
}

// Run diagnostics
runDiagnostics().catch(error => {
    console.error('\n💥 Diagnostic script crashed:', error);
    process.exit(1);
});
