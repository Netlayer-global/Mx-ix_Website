import React, { useState, useEffect } from 'react';
import { Save, RefreshCw, ChevronLeft } from 'lucide-react';
import api from '../services/api';

interface StatValue {
  value: number;
  unit: string;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: string;
}

interface GlobalStatsData {
  totalCapacity: StatValue;
  peakTraffic: StatValue;
  connectedNetworks: StatValue;
  ipv4Prefixes: StatValue;
}

interface StatsAdminPanelProps {
  embedded?: boolean;
  onBack?: () => void;
}

const StatsAdminPanel: React.FC<StatsAdminPanelProps> = ({ embedded = false, onBack }) => {
  const [stats, setStats] = useState<GlobalStatsData>({
    totalCapacity: { value: 450, unit: 'Tbps' },
    peakTraffic: { value: 156.2, unit: 'Tbps', trend: 'up', trendValue: '+8.1%' },
    connectedNetworks: { value: 4921, unit: 'Peers', trend: 'up', trendValue: '+47' },
    ipv4Prefixes: { value: 892345, unit: 'Routes', trend: 'stable' },
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    document.body.classList.add('dark-nav');
    fetchStats();
    return () => {
      document.body.classList.remove('dark-nav');
    };
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await api.stats.get();
      if (response.success && response.data) {
        setStats(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
      setMessage('Failed to load stats');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      setMessage('');
      const response = await api.stats.update(stats);
      if (response.success) {
        setMessage('Stats updated successfully!');
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage(response.error || 'Failed to save stats');
      }
    } catch (error) {
      console.error('Failed to save stats:', error);
      setMessage('Failed to save stats');
    } finally {
      setLoading(false);
    }
  };

  const updateStat = (key: keyof GlobalStatsData, field: keyof StatValue, value: any) => {
    setStats(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: value
      }
    }));
  };

  return (
    <div className="min-h-screen bg-black text-white pt-32 pb-20">
      <div className="max-w-5xl mx-auto px-6">
        <div className="mb-12">
          <div className="flex items-center gap-4 mb-4">
            {embedded && onBack && (
              <button 
                onClick={onBack}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                title="Back to Dashboard"
              >
                <ChevronLeft size={32} />
              </button>
            )}
            <h1 className="text-5xl font-black tracking-tighter">
              Global <span className="text-[#F20732]">Stats</span> Admin
            </h1>
          </div>
          <p className=" text-gray-400">Manage global network statistics displayed on the stats page</p>
        </div>

        {message && (
          <div className={`mb-6 p-4 border ${message.includes('success') ? 'border-green-500/50 bg-green-500/10 text-green-400' : 'border-red-500/50 bg-red-500/10 text-red-400'}`}>
            {message}
          </div>
        )}

        <div className="space-y-6">
          {/* Total Capacity */}
          <div className="bg-white/5 border border-white/10 p-6">
            <h3 className="text-xl font-bold mb-4 text-[#F20732]">Total Capacity</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Value</label>
                <input
                  type="number"
                  value={stats.totalCapacity.value}
                  onChange={(e) => updateStat('totalCapacity', 'value', parseFloat(e.target.value))}
                  className="w-full bg-black border border-white/20 px-4 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Unit</label>
                <input
                  type="text"
                  value={stats.totalCapacity.unit}
                  onChange={(e) => updateStat('totalCapacity', 'unit', e.target.value)}
                  className="w-full bg-black border border-white/20 px-4 py-2 text-white"
                />
              </div>
            </div>
          </div>

          {/* Peak Traffic */}
          <div className="bg-white/5 border border-white/10 p-6">
            <h3 className="text-xl font-bold mb-4 text-[#F20732]">Peak Traffic (24h)</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Value</label>
                <input
                  type="number"
                  step="0.1"
                  value={stats.peakTraffic.value}
                  onChange={(e) => updateStat('peakTraffic', 'value', parseFloat(e.target.value))}
                  className="w-full bg-black border border-white/20 px-4 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Unit</label>
                <input
                  type="text"
                  value={stats.peakTraffic.unit}
                  onChange={(e) => updateStat('peakTraffic', 'unit', e.target.value)}
                  className="w-full bg-black border border-white/20 px-4 py-2 text-white"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Trend</label>
                <select
                  value={stats.peakTraffic.trend || ''}
                  onChange={(e) => updateStat('peakTraffic', 'trend', e.target.value as any)}
                  className="w-full bg-black border border-white/20 px-4 py-2 text-white"
                >
                  <option value="">None</option>
                  <option value="up">Up</option>
                  <option value="down">Down</option>
                  <option value="stable">Stable</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Trend Value</label>
                <input
                  type="text"
                  value={stats.peakTraffic.trendValue || ''}
                  onChange={(e) => updateStat('peakTraffic', 'trendValue', e.target.value)}
                  placeholder="+8.1%"
                  className="w-full bg-black border border-white/20 px-4 py-2 text-white"
                />
              </div>
            </div>
          </div>

          {/* Connected Networks */}
          <div className="bg-white/5 border border-white/10 p-6">
            <h3 className="text-xl font-bold mb-4 text-[#F20732]">Connected Networks</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Value</label>
                <input
                  type="number"
                  value={stats.connectedNetworks.value}
                  onChange={(e) => updateStat('connectedNetworks', 'value', parseInt(e.target.value))}
                  className="w-full bg-black border border-white/20 px-4 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Unit</label>
                <input
                  type="text"
                  value={stats.connectedNetworks.unit}
                  onChange={(e) => updateStat('connectedNetworks', 'unit', e.target.value)}
                  className="w-full bg-black border border-white/20 px-4 py-2 text-white"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Trend</label>
                <select
                  value={stats.connectedNetworks.trend || ''}
                  onChange={(e) => updateStat('connectedNetworks', 'trend', e.target.value as any)}
                  className="w-full bg-black border border-white/20 px-4 py-2 text-white"
                >
                  <option value="">None</option>
                  <option value="up">Up</option>
                  <option value="down">Down</option>
                  <option value="stable">Stable</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Trend Value</label>
                <input
                  type="text"
                  value={stats.connectedNetworks.trendValue || ''}
                  onChange={(e) => updateStat('connectedNetworks', 'trendValue', e.target.value)}
                  placeholder="+47"
                  className="w-full bg-black border border-white/20 px-4 py-2 text-white"
                />
              </div>
            </div>
          </div>

          {/* IPv4 Prefixes */}
          <div className="bg-white/5 border border-white/10 p-6">
            <h3 className="text-xl font-bold mb-4 text-[#F20732]">IPv4 Prefixes</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Value</label>
                <input
                  type="number"
                  value={stats.ipv4Prefixes.value}
                  onChange={(e) => updateStat('ipv4Prefixes', 'value', parseInt(e.target.value))}
                  className="w-full bg-black border border-white/20 px-4 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Unit</label>
                <input
                  type="text"
                  value={stats.ipv4Prefixes.unit}
                  onChange={(e) => updateStat('ipv4Prefixes', 'unit', e.target.value)}
                  className="w-full bg-black border border-white/20 px-4 py-2 text-white"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Trend</label>
                <select
                  value={stats.ipv4Prefixes.trend || ''}
                  onChange={(e) => updateStat('ipv4Prefixes', 'trend', e.target.value as any)}
                  className="w-full bg-black border border-white/20 px-4 py-2 text-white"
                >
                  <option value="">None</option>
                  <option value="up">Up</option>
                  <option value="down">Down</option>
                  <option value="stable">Stable</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">Trend Value</label>
                <input
                  type="text"
                  value={stats.ipv4Prefixes.trendValue || ''}
                  onChange={(e) => updateStat('ipv4Prefixes', 'trendValue', e.target.value)}
                  className="w-full bg-black border border-white/20 px-4 py-2 text-white"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4">
            <button
              onClick={handleSave}
              disabled={loading}
              className="px-8 py-4 bg-[#F20732] text-white font-bold uppercase tracking-wider hover:bg-[#F20732]/80 disabled:opacity-50 flex items-center gap-2"
            >
              <Save size={20} />
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              onClick={fetchStats}
              disabled={loading}
              className="px-8 py-4 border-2 border-white/20 text-white font-bold uppercase tracking-wider hover:border-white/40 disabled:opacity-50 flex items-center gap-2"
            >
              <RefreshCw size={20} />
              Reload
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatsAdminPanel;
