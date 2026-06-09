import React, { useState } from 'react';

interface AppData {
  latency: number;
  peers: number;
  capacity: number;
  locations: any[];
}

const AdminPanel = ({ data, onUpdate }: { data: AppData, onUpdate: (d: AppData) => void }) => {
  const [formData, setFormData] = useState(data);

  const handleChange = (field: keyof AppData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    onUpdate(formData);
    alert('System Parameters Updated');
  };

  return (
    <section className="pt-32 pb-20 min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-6 bg-white border border-gray-200 p-12 shadow-sm">
        <span className="text-[#F20732] font-mono text-xs tracking-[0.25em] uppercase block mb-6">:: SYSTEM ADMINISTRATION</span>
        <h1 className="text-4xl font-black mb-12 text-black">CONTROL PANEL</h1>
        
        <div className="space-y-8">
          <div className="space-y-2">
            <label className="font-mono text-xs uppercase font-bold text-gray-500">Current Latency (ms)</label>
            <input 
              type="number" 
              step="0.1"
              value={formData.latency}
              onChange={(e) => handleChange('latency', parseFloat(e.target.value))}
              className="w-full border p-3 font-mono hover-trigger" 
            />
          </div>
          <div className="space-y-2">
            <label className="font-mono text-xs uppercase font-bold text-gray-500">Active Peers</label>
            <input 
              type="number" 
              value={formData.peers}
              onChange={(e) => handleChange('peers', parseInt(e.target.value))}
              className="w-full border p-3 font-mono hover-trigger" 
            />
          </div>
          <div className="space-y-2">
            <label className="font-mono text-xs uppercase font-bold text-gray-500">Global Capacity (Tbps)</label>
            <input 
              type="number" 
              value={formData.capacity}
              onChange={(e) => handleChange('capacity', parseInt(e.target.value))}
              className="w-full border p-3 font-mono hover-trigger" 
            />
          </div>
          
          <div className="pt-6 border-t border-gray-100">
             <button onClick={handleSave} className="bg-[#F20732] text-white w-full py-4 font-bold tracking-widest text-sm uppercase hover:bg-black transition-colors hover-trigger">
               Update System Data
             </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AdminPanel;
