// Add this to the end of grafana.controller.ts

// Debug endpoint - Comprehensive diagnostics
export const getDebugInfo = async (req: Request, res: Response) => {
  const diagnostics: any = {
    timestamp: new Date().toISOString(),
    configuration: {},
    grafanaHealth: {},
    datasource: {},
    trafficQueries: [],
    summary: {}
  };

  try {
    // Check configuration
    diagnostics.configuration = {
      grafanaUrl: config.grafanaUrl || 'NOT SET',
      hasApiKey: !!config.grafanaApiKey,
      datasourceUid: ZABBIX_DATASOURCE_UID,
      queryCount: TRAFFIC_QUERIES.length
    };

    if (!config.grafanaUrl || !config.grafanaApiKey) {
      diagnostics.summary.error = 'Grafana not configured';
      return res.json({ success: false, diagnostics });
    }

    // Test Grafana health
    try {
      const healthResponse = await fetch(`${config.grafanaUrl}/api/health`, {
        headers: { 'Authorization': `Bearer ${config.grafanaApiKey}` }
      });
      diagnostics.grafanaHealth = {
        status: healthResponse.status,
        ok: healthResponse.ok,
        data: healthResponse.ok ? await healthResponse.json() : await healthResponse.text()
      };
    } catch (error: any) {
      diagnostics.grafanaHealth = { error: error.message };
    }

    // Test Zabbix datasource
    try {
      const dsResponse = await fetch(
        `${config.grafanaUrl}/api/datasources/uid/${ZABBIX_DATASOURCE_UID}`,
        { headers: { 'Authorization': `Bearer ${config.grafanaApiKey}` } }
      );
      diagnostics.datasource = {
        status: dsResponse.status,
        ok: dsResponse.ok,
        data: dsResponse.ok ? await dsResponse.json() : await dsResponse.text()
      };
    } catch (error: any) {
      diagnostics.datasource = { error: error.message };
    }

    // Test each traffic query
    const timeRange = { from: 'now-5m', to: 'now' };
    for (const query of TRAFFIC_QUERIES) {
      try {
        const result = await queryZabbixData(query, timeRange);
        diagnostics.trafficQueries.push({
          query: `${query.host} - ${query.item}`,
          success: !!result,
          dataPoints: result?.[1]?.length || 0,
          latestValue: result?.[1]?.[result[1].length - 1] || 'No Data',
          latestValueGbps: result?.[1]?.[result[1].length - 1] 
            ? bitsToGbps(result[1][result[1].length - 1]) 
            : 0
        });
      } catch (error: any) {
        diagnostics.trafficQueries.push({
          query: `${query.host} - ${query.item}`,
          error: error.message
        });
      }
    }

    // Summary
    const successfulQueries = diagnostics.trafficQueries.filter((q: any) => q.success).length;
    diagnostics.summary = {
      grafanaConnected: diagnostics.grafanaHealth.ok,
      datasourceFound: diagnostics.datasource.ok,
      queriesSuccessful: `${successfulQueries}/${TRAFFIC_QUERIES.length}`,
      totalDataPoints: diagnostics.trafficQueries.reduce((sum: number, q: any) => sum + (q.dataPoints || 0), 0),
      status: successfulQueries === TRAFFIC_QUERIES.length ? 'HEALTHY' : 'DEGRADED'
    };

    return res.json({
      success: true,
      diagnostics
    });

  } catch (error) {
    console.error('Debug endpoint error:', error);
    diagnostics.summary.error = String(error);
    return res.status(500).json({
      success: false,
      diagnostics
    });
  }
};
