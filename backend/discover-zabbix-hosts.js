// Script to discover what hosts and items actually exist in Zabbix
// This will help us find the correct names to use in our queries

const config = {
    grafanaUrl: process.env.GRAFANA_URL || 'http://103.139.191.165:3000',
    grafanaApiKey: process.env.GRAFANA_API_KEY || 'YOUR_API_KEY_HERE',
    zabbixDatasourceUid: 'bezy0nzf8ykg0c'
};

async function makeRequest(url, options = {}) {
    try {
        const response = await fetch(url, options);
        const data = await response.json();
        return { status: response.status, ok: response.ok, data };
    } catch (error) {
        return { status: 0, ok: false, error: error.message };
    }
}

// Query Grafana to get available host groups
async function getHostGroups() {
    console.log('\n🔍 Discovering Host Groups...');
    console.log('━'.repeat(60));

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
                mode: 2, // Get groups
                group: { filter: '*' }
            }]
        })
    });

    if (result.ok && result.data?.results?.A) {
        const frames = result.data.results.A.frames || [];
        console.log(`Found ${frames.length} host groups`);

        frames.forEach((frame, idx) => {
            console.log(`  ${idx + 1}. ${frame.schema?.name || 'Unknown'}`);
        });

        return frames.map(f => f.schema?.name).filter(Boolean);
    }

    console.log('❌ Could not retrieve host groups');
    return [];
}

// Query for hosts in a specific group
async function getHostsInGroup(groupName = '*') {
    console.log(`\n🔍 Discovering Hosts in group: ${groupName}...`);
    console.log('━'.repeat(60));

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
                mode: 1, // Get hosts
                group: { filter: groupName },
                host: { filter: '*' }
            }]
        })
    });

    if (result.ok && result.data?.results?.A) {
        const frames = result.data.results.A.frames || [];
        console.log(`Found ${frames.length} hosts`);

        const hosts = [];
        frames.forEach((frame, idx) => {
            const hostName = frame.schema?.name || frame.name || 'Unknown';
            console.log(`  ${idx + 1}. ${hostName}`);
            hosts.push(hostName);
        });

        return hosts;
    }

    console.log('❌ Could not retrieve hosts');
    console.log('Response:', JSON.stringify(result.data).substring(0, 500));
    return [];
}

// Alternative: Try to get hosts using metric query
async function getHostsViaMetrics() {
    console.log(`\n🔍 Discovering Hosts via Metrics Query...`);
    console.log('━'.repeat(60));

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
                group: { filter: '*' },
                host: { filter: '*' },
                item: { filter: '*' }
            }],
            from: 'now-1h',
            to: 'now'
        })
    });

    if (result.ok) {
        console.log('✅ Query successful');
        console.log('Response structure:', JSON.stringify(result.data, null, 2));

        const frames = result.data?.results?.A?.frames || [];
        console.log(`\nFound ${frames.length} metric frames`);

        const uniqueHosts = new Set();
        frames.forEach((frame) => {
            if (frame.schema?.fields) {
                frame.schema.fields.forEach(field => {
                    if (field.labels?.host) {
                        uniqueHosts.add(field.labels.host);
                    }
                });
            }
            // Also check frame name
            if (frame.name) {
                uniqueHosts.add(frame.name.split(':')[0].trim());
            }
        });

        if (uniqueHosts.size > 0) {
            console.log('\n📋 Unique hosts found:');
            Array.from(uniqueHosts).forEach((host, idx) => {
                console.log(`  ${idx + 1}. ${host}`);
            });
            return Array.from(uniqueHosts);
        }
    }

    console.log('Response:', JSON.stringify(result.data).substring(0, 1000));
    return [];
}

// Get items for a specific host
async function getItemsForHost(groupName, hostName) {
    console.log(`\n🔍 Discovering Items for host: ${hostName}...`);
    console.log('━'.repeat(60));

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
                group: { filter: groupName },
                host: { filter: hostName },
                item: { filter: '*bit*' }, // Looking for items with 'bit' in the name
                options: {
                    showDisabledItems: false
                }
            }],
            from: 'now-1h',
            to: 'now'
        })
    });

    if (result.ok) {
        const frames = result.data?.results?.A?.frames || [];
        console.log(`Found ${frames.length} items with 'bit' in the name`);

        frames.forEach((frame, idx) => {
            const itemName = frame.schema?.name || frame.name || 'Unknown';
            const hasData = frame.data?.values?.[1]?.length > 0;
            console.log(`  ${idx + 1}. ${itemName} ${hasData ? '✅ HAS DATA' : '⚠️  NO DATA'}`);
        });

        return frames;
    }

    console.log('❌ Could not retrieve items');
    console.log('Response:', JSON.stringify(result.data).substring(0, 500));
    return [];
}

// Main discovery process
async function runDiscovery() {
    console.log('🚀 Starting Zabbix Host/Item Discovery...');
    console.log('Target Grafana: ' + config.grafanaUrl);
    console.log('Datasource UID: ' + config.zabbixDatasourceUid);

    // Try to get hosts via metrics (most reliable)
    const hosts = await getHostsViaMetrics();

    if (hosts.length === 0) {
        console.log('\n⚠️  No hosts found via metrics query');
        console.log('This might mean:');
        console.log('  • Zabbix has no data in the last hour');
        console.log('  • Host/group naming is very specific');
        console.log('  • Zabbix integration needs configuration');
    } else {
        console.log(`\n✅ Found ${hosts.length} hosts!`);
        console.log('\n📝 SUGGESTED FIX:');
        console.log('Update your TRAFFIC_QUERIES in grafana.controller.ts to use these host names:');
        hosts.forEach((host, idx) => {
            console.log(`  ${idx + 1}. Replace "LVSB SW-01" or "MB2 SW-01" with: "${host}"`);
        });

        // Try to get items for the first host
        if (hosts[0]) {
            await getItemsForHost('*', hosts[0]);
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log('🔍 NEXT STEPS:');
    console.log('1. Check if any of the discovered host names match your network devices');
    console.log('2. Update TRAFFIC_QUERIES in grafana.controller.ts with correct names');
    console.log('3. Or manually check Grafana dashboard to see what names work there');
    console.log('='.repeat(60));
}

runDiscovery().catch(console.error);
