import React, { useState, useEffect } from 'react';
import { Save, RefreshCw, ChevronLeft } from 'lucide-react';
import api from '../services/api';

interface NetworkStatsData {
  locationsCount?: number;
  activeNodes: number;
  throughput: number;
}

interface HomepageAdminPanelProps {
  embedded?: boolean;
  onBack?: () => void;
}

const HomepageAdminPanel: React.FC<HomepageAdminPanelProps> = ({ embedded = false, onBack }) => {
  const [stats, setStats] = useState<NetworkStatsData>({
    locationsCount: 14,
    activeNodes: 4921,
    throughput: 124,
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
      const response = await api.networkStats.get();
      if (response.success && response.data) {
        setStats({
          locationsCount: response.data.locationsCount ?? 14,
          activeNodes: response.data.activeNodes,
          throughput: response.data.throughput,
        });
      }
    } catch (error) {
      console.error('Failed to fetch homepage stats:', error);
      setMessage('Failed to load homepage stats');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      setMessage('');
      const response = await api.networkStats.update(stats);
      if (response.success) {
        setMessage('Homepage stats updated successfully!');
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage(response.error || 'Failed to save stats');
      }
    } catch (error) {
      console.error('Failed to save homepage stats:', error);
      setMessage('Failed to save stats');
    } finally {
      setLoading(false);
    }
  };

  const updateStat = (field: keyof NetworkStatsData, value: number) => {
    setStats((prev) => ({
      ...prev,
      [field]: value,
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
              Homepage <span className="text-[#F20732]">Admin</span>
            </h1>
          </div>
          <p className=" text-gray-400">Manage key statistics displayed on the homepage hero section</p>
        </div>

        {message && (
          <div
            className={`mb-6 p-4 border ${
              message.includes('success')
                ? 'border-green-500/50 bg-green-500/10 text-green-400'
                : 'border-red-500/50 bg-red-500/10 text-red-400'
            }`}
          >
            {message}
          </div>
        )}

        <div className="space-y-6">
          {/* Locations */}
          <div className="bg-white/5 border border-white/10 p-6">
            <h3 className="text-xl font-bold mb-4 text-[#F20732]">Locations Displayed</h3>
            <p className="text-sm text-gray-400 mb-4">Number of locations shown on the homepage.</p>
            <div>
              <input
                type="number"
                value={stats.locationsCount ?? ''}
                onChange={(e) => updateStat('locationsCount', parseInt(e.target.value) || 0)}
                className="w-full bg-black border border-white/20 px-4 py-2 text-white"
              />
            </div>
          </div>

          {/* Connected Data Centers */}
          <div className="bg-white/5 border border-white/10 p-6">
            <h3 className="text-xl font-bold mb-4 text-[#F20732]">Connected Data Centers</h3>
            <p className="text-sm text-gray-400 mb-4">Number of active nodes/data centers shown.</p>
            <div>
              <input
                type="number"
                value={stats.activeNodes ?? ''}
                onChange={(e) => updateStat('activeNodes', parseInt(e.target.value) || 0)}
                className="w-full bg-black border border-white/20 px-4 py-2 text-white"
              />
            </div>
          </div>

          {/* Capacity */}
          <div className="bg-white/5 border border-white/10 p-6">
            <h3 className="text-xl font-bold mb-4 text-[#F20732]">Capacity (Tbps)</h3>
            <p className="text-sm text-gray-400 mb-4">Total network throughput displayed on the homepage.</p>
            <div>
              <input
                type="number"
                step="0.1"
                value={stats.throughput ?? ''}
                onChange={(e) => updateStat('throughput', parseFloat(e.target.value) || 0)}
                className="w-full bg-black border border-white/20 px-4 py-2 text-white"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 pt-4">
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

export default HomepageAdminPanel;
