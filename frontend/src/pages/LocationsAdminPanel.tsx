import React, { useState, useEffect } from 'react';
import { useAdmin, Location, Continent, PricingTier, ASN, EnabledSite } from '../contexts/AdminContext';
import { continentsApi, locationsApi } from '../services/api';
import {
  Plus, Edit2, Trash2, Save, X, ChevronDown, ChevronRight, ChevronLeft,
  Globe, Server, Activity, DollarSign, MapPin, Network, Shield
} from 'lucide-react';


interface LocationsAdminPanelProps {
  embedded?: boolean;
  onBack?: () => void;
}

const LocationsAdminPanel: React.FC<LocationsAdminPanelProps> = ({ embedded = false, onBack }) => {
  const {
    locations, continents,
    addLocation, updateLocation, removeLocation,
    addContinent, updateContinent, removeContinent,
    refreshData, loading
  } = useAdmin();

  const [activeContinentId, setActiveContinentId] = useState<string>('');
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditingContinent, setIsEditingContinent] = useState<Continent | null>(null);
  const [isCreatingContinent, setIsCreatingContinent] = useState(false);
  const [editingContinentName, setEditingContinentName] = useState<string>('');

  useEffect(() => {
    if (continents.length > 0 && !activeContinentId) {
      setActiveContinentId(continents[0].id);
    }
  }, [continents]);

  const handleCreateContinent = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);

    const newContinent = {
      id: formData.get('id') as string,
      name: formData.get('name') as string,
      description: formData.get('description') as string,
      order: parseInt(formData.get('order') as string) || 0,
      isActive: true
    };

    const res = await continentsApi.create(newContinent);
    if (res.success && res.data) {
      addContinent(res.data);
      setIsCreatingContinent(false);
      setActiveContinentId(res.data.id);
    }
  };

  const handleDeleteContinent = async (id: string) => {
    const continent = continents.find(c => c.id === id);
    const continentName = continent?.name || id;
    const locationsInContinent = locations.filter(l => l.continentId === id);

    if (locationsInContinent.length > 0) {
      alert(`❌ Cannot delete "${continentName}"!\n\nThis continent has ${locationsInContinent.length} location(s).\nPlease delete or move all locations first.`);
      return;
    }

    if (window.confirm(`Are you sure you want to delete the continent "${continentName}"?\n\nThis action cannot be undone.`)) {
      try {
        const res = await continentsApi.delete(id);
        if (res.success) {
          removeContinent(id);
          if (activeContinentId === id && continents.length > 0) {
            setActiveContinentId(continents[0].id);
          }
          alert(`✅ Continent "${continentName}" deleted successfully!`);
        } else {
          alert(`❌ Failed to delete continent: ${res.error}`);
        }
      } catch (err) {
        console.error('Delete continent error:', err);
        alert('❌ Error deleting continent. Please try again.');
      }
    }
  };

  const handleUpdateContinent = async (continent: Continent) => {
    try {
      const res = await continentsApi.update(continent.id, { name: editingContinentName });
      if (res.success && res.data) {
        updateContinent(continent.id, res.data);
        setIsEditingContinent(null);
        setEditingContinentName('');
        alert(`✅ Continent renamed to "${editingContinentName}" successfully!`);
      } else {
        alert(`❌ Failed to update continent: ${res.error}`);
      }
    } catch (err) {
      console.error('Update continent error:', err);
      alert('❌ Error updating continent. Please try again.');
    }
  };

  const handleCreateLocation = async () => {
    const newLoc: Partial<Location> = {
      id: `new-${Date.now()}`,
      name: 'New Location',
      coordinates: [0, 0],
      code: 'NEW_LOC',
      region: activeContinentId.toUpperCase(),
      continentId: activeContinentId,
      status: 'upcoming',
      pricing: [],
      asnList: [],
      enabledSites: [],
      portSpeeds: ['1G', '10G', '100G'],
      protocols: ['BGP-4', 'IPv4', 'IPv6'],
      features: []
    };

    // We don't save to backend immediately, just open editor
    // @ts-ignore
    setEditingLocation(newLoc);
    setIsCreating(true);
  };

  const handleSaveLocation = async () => {
    if (!editingLocation) return;

    try {
      if (isCreating) {
        const res = await locationsApi.create(editingLocation);
        if (res.success && res.data) {
          addLocation(res.data);
          setEditingLocation(null);
          setIsCreating(false);
        } else {
          alert('Failed to create location: ' + res.error);
        }
      } else {
        const res = await locationsApi.update(editingLocation.id, editingLocation);
        if (res.success && res.data) {
          updateLocation(editingLocation.id, res.data);
          setEditingLocation(null);
        } else {
          alert('Failed to update location: ' + res.error);
        }
      }
    } catch (err) {
      console.error(err);
      alert('Error saving location');
    }
  };

  const handleDeleteLocation = async (id: string) => {
    const locationName = locations.find(l => l.id === id)?.name || id;

    // Check if user is logged in
    const token = localStorage.getItem('mx-ix-admin-token');
    if (!token) {
      alert('❌ You must be logged in to delete locations.\n\nPlease log in first.');
      return;
    }

    if (window.confirm(`Are you sure you want to delete "${locationName}"?\n\nThis action cannot be undone.`)) {
      try {
        const res = await locationsApi.delete(id);
        if (res.success) {
          removeLocation(id);
          if (editingLocation?.id === id) setEditingLocation(null);
          alert(`✅ Location "${locationName}" deleted successfully!`);
        } else {
          if (res.error?.includes('Network error')) {
            alert(`❌ Cannot connect to server!\n\nPlease make sure the backend is running on http://localhost:5000`);
          } else if (res.error?.includes('Unauthorized') || res.error?.includes('401')) {
            alert(`❌ Authentication failed!\n\nPlease log in again.`);
            localStorage.removeItem('mx-ix-admin-token');
          } else {
            alert(`❌ Failed to delete location: ${res.error}`);
          }
        }
      } catch (err: any) {
        console.error('Delete error:', err);
        if (err.message?.includes('Failed to fetch')) {
          alert('❌ Cannot connect to backend server!\n\nPlease check:\n1. Backend is running (npm run dev in backend folder)\n2. Backend is on http://localhost:5000\n3. No firewall blocking the connection');
        } else {
          alert('❌ Error deleting location. Please try again.');
        }
      }
    }
  };

  if (loading) return <div className="p-8 text-center text-white">Loading...</div>;

  const activeLocations = locations.filter(l =>
    l.continentId === activeContinentId ||
    (!l.continentId && l.region.toLowerCase().includes(activeContinentId)) ||
    (!l.continentId && activeContinentId === 'asia' && l.region === 'ASIA') // Fallback
  );

  return (
    <div className="admin-panel min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
      <div className="max-w-[1800px] mx-auto space-y-6">
        {/* Header & Continents Tabs */}
        <div className="flex flex-col space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-3xl font-black text-white flex items-center gap-3">
              {embedded && onBack && (
                <button
                  onClick={onBack}
                  className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
                  title="Back to Dashboard"
                >
                  <ChevronLeft size={24} />
                </button>
              )}
              <Globe className="text-blue-500" size={32} /> Locations Management
            </h2>
            <button
              onClick={() => setIsCreatingContinent(true)}
              className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-5 py-2.5 rounded-lg font-semibold shadow-lg shadow-blue-500/20 transition-all"
            >
              <Plus size={18} /> Add Continent
            </button>
          </div>

          {/* Create Continent Form */}
          {isCreatingContinent && (
            <form onSubmit={handleCreateContinent} className="bg-slate-800 p-4 rounded-lg border border-slate-700 flex gap-4 items-end">
              <div>
                <label className="block text-sm text-slate-400 mb-1">ID (e.g. europe)</label>
                <input name="id" required className="bg-slate-950 border border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 transition-all text-sm" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Name</label>
                <input name="name" required className="bg-slate-950 border border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 transition-all text-sm" />
              </div>
              <div className="flex-1">
                <label className="block text-sm text-slate-400 mb-1">Description</label>
                <input name="description" className="w-full bg-slate-950 border border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 transition-all text-sm" />
              </div>
              <div className="w-20">
                <label className="block text-sm text-slate-400 mb-1">Order</label>
                <input name="order" type="number" defaultValue="99" className="w-full bg-slate-950 border border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 transition-all text-sm" />
              </div>
              <div className="flex gap-2">
                <button type="submit" className="bg-green-600 hover:bg-green-700 text-white p-2 rounded">
                  <Save size={18} />
                </button>
                <button type="button" onClick={() => setIsCreatingContinent(false)} className="bg-slate-600 hover:bg-slate-500 text-white p-2 rounded">
                  <X size={18} />
                </button>
              </div>
            </form>
          )}

          {/* Continents Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-2 border-b border-slate-700">
            {continents.map(c => (
              <div key={c.id} className="group relative">
                {isEditingContinent?.id === c.id ? (
                  // Edit Mode - Inline editing
                  <div className="flex items-center gap-2 px-3 py-2 bg-slate-800 rounded-t-lg border-b-3 border-blue-500">
                    <input
                      type="text"
                      value={editingContinentName}
                      onChange={(e) => setEditingContinentName(e.target.value)}
                      className="px-2 py-1 bg-slate-950 border border-slate-600 rounded text-white text-sm focus:border-blue-500 focus:outline-none min-w-[120px]"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleUpdateContinent(c);
                        if (e.key === 'Escape') {
                          setIsEditingContinent(null);
                          setEditingContinentName('');
                        }
                      }}
                    />
                    <button
                      onClick={() => handleUpdateContinent(c)}
                      className="p-1 rounded bg-green-600 hover:bg-green-700 text-white transition-all"
                      title="Save"
                    >
                      <Save size={14} />
                    </button>
                    <button
                      onClick={() => {
                        setIsEditingContinent(null);
                        setEditingContinentName('');
                      }}
                      className="p-1 rounded bg-slate-600 hover:bg-slate-500 text-white transition-all"
                      title="Cancel"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  // View Mode - Normal tab
                  <>
                    <button
                      onClick={() => setActiveContinentId(c.id)}
                      className={`px-5 py-2.5 rounded-t-lg whitespace-nowrap transition-all font-medium ${activeContinentId === c.id
                        ? 'bg-gradient-to-b from-slate-800 to-slate-900 text-blue-400 border-b-3 border-blue-500 shadow-lg'
                        : 'bg-transparent text-slate-400 hover:text-white hover:bg-slate-800/50'
                        }`}
                    >
                      {c.name}
                    </button>
                    <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsEditingContinent(c);
                          setEditingContinentName(c.name);
                        }}
                        className="p-0.5 rounded-full bg-blue-500/20 hover:bg-blue-500 text-blue-200 transition-all"
                        title="Edit Continent Name"
                      >
                        <Edit2 size={10} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteContinent(c.id); }}
                        className="p-0.5 rounded-full bg-red-500/20 hover:bg-red-500 text-red-200 transition-all"
                        title="Delete Continent"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Locations List */}
          <div className="lg:col-span-1 space-y-4">
            <div className="flex justify-between items-center bg-slate-800 p-3 rounded-lg">
              <h3 className="text-white font-medium">Locations in {continents.find(c => c.id === activeContinentId)?.name}</h3>
              <button
                onClick={handleCreateLocation}
                className="bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 p-2 rounded-lg transition-all shadow-md hover:shadow-lg"
              >
                <Plus size={18} />
              </button>
            </div>

            <div className="space-y-2 max-h-[calc(100vh-300px)] overflow-y-auto pr-2">
              {activeLocations.map(loc => (
                <div
                  key={loc.id}
                  className={`group p-4 rounded-xl border-2 transition-all hover:shadow-lg ${editingLocation?.id === loc.id
                    ? 'bg-blue-900/20 border-blue-500/50'
                    : 'bg-slate-800 border-slate-700 hover:border-slate-600'
                    }`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div
                      onClick={() => { setEditingLocation(loc); setIsCreating(false); }}
                      className="flex-1 cursor-pointer"
                    >
                      <h4 className="text-white font-medium">{loc.name}</h4>
                      <p className="text-xs text-slate-400">{loc.code} • {loc.region}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${loc.status === 'current' ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'
                        }`}>
                        {loc.status}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteLocation(loc.id);
                        }}
                        className="p-1 text-red-400 hover:bg-red-400/10 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Delete location"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {activeLocations.length === 0 && (
                <div className="text-center py-8 text-slate-500">
                  No locations found in this continent.
                </div>
              )}
            </div>
          </div>

          {/* Location Editor */}
          <div className="lg:col-span-2">
            {editingLocation ? (
              <div className="bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800 rounded-xl border border-slate-700 p-8 space-y-6 shadow-2xl">
                <div className="flex justify-between items-center border-b border-slate-700/50 pb-5">
                  <div>
                    <h3 className="text-2xl font-black text-white tracking-tight">
                      {isCreating ? '✨ New Location' : `📍 Editing ${editingLocation.name}`}
                    </h3>
                    <p className="text-sm text-slate-500 font-mono mt-1">ID: {editingLocation.id}</p>
                  </div>
                  <div className="flex gap-2">
                    {!isCreating && (
                      <button onClick={() => handleDeleteLocation(editingLocation.id)} className="p-2 text-red-400 hover:bg-red-400/10 rounded">
                        <Trash2 size={20} />
                      </button>
                    )}
                    <button onClick={() => setEditingLocation(null)} className="p-2.5 text-slate-400 hover:bg-slate-700 rounded-lg transition-colors">
                      <X size={20} />
                    </button>
                    <button onClick={handleSaveLocation} className="flex items-center gap-2 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white px-6 py-2.5 rounded-lg font-semibold shadow-lg shadow-green-500/20 transition-all">
                      <Save size={18} /> Save Changes
                    </button>
                  </div>
                </div>

                {/* Main Fields */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-400 mb-2 font-semibold uppercase tracking-wider">Name</label>
                    <input
                      value={editingLocation.name}
                      onChange={e => setEditingLocation({ ...editingLocation, name: e.target.value })}

                      className="w-full bg-slate-950 border border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">ID (Unique)</label>
                    <input
                      value={editingLocation.id}
                      disabled={!isCreating}
                      onChange={e => setEditingLocation({ ...editingLocation, id: e.target.value })}

                      className="w-full bg-slate-950 border border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 transition-all disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Code</label>
                    <input
                      value={editingLocation.code}
                      onChange={e => setEditingLocation({ ...editingLocation, code: e.target.value })}

                      className="w-full bg-slate-950 border border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Status</label>
                    <select
                      value={editingLocation.status}
                      onChange={e => setEditingLocation({ ...editingLocation, status: e.target.value as any })}

                      className="w-full bg-slate-950 border border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 transition-all"
                    >
                      <option value="current">Current (Live)</option>
                      <option value="upcoming">Upcoming</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Continent</label>
                    <select
                      value={editingLocation.continentId}
                      onChange={e => setEditingLocation({ ...editingLocation, continentId: e.target.value })}

                      className="w-full bg-slate-950 border border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 transition-all"
                    >
                      {continents.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Country</label>
                    <input
                      value={editingLocation.country || ''}
                      onChange={e => setEditingLocation({ ...editingLocation, country: e.target.value })}

                      className="w-full bg-slate-950 border border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Coordinates (Lat, Lng)</label>
                    <div className="flex gap-2">
                      <input
                        type="number" step="any"
                        value={editingLocation.coordinates[1] || ''}
                        onChange={e => {
                          const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                          setEditingLocation({ ...editingLocation, coordinates: [editingLocation.coordinates[0], isNaN(val) ? 0 : val] });
                        }}
                        placeholder="Lat"

                        className="w-full bg-slate-950 border border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 transition-all"
                      />
                      <input
                        type="number" step="any"
                        value={editingLocation.coordinates[0] || ''}
                        onChange={e => {
                          const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                          setEditingLocation({ ...editingLocation, coordinates: [isNaN(val) ? 0 : val, editingLocation.coordinates[1]] });
                        }}
                        placeholder="Lng"

                        className="w-full bg-slate-950 border border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 transition-all"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Map Image URL</label>
                    <input
                      value={editingLocation.cityImage || ''}
                      onChange={e => setEditingLocation({ ...editingLocation, cityImage: e.target.value })}

                      className="w-full bg-slate-950 border border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 transition-all"
                    />
                  </div>
                </div>

                {/* Extended Info Accordion/Sections */}
                <div className="space-y-4">
                  <h4 className="text-white font-medium border-b border-slate-700 pb-2">Details</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <input
                      placeholder="Latency (e.g. 1.2ms)"
                      value={editingLocation.latency || ''}
                      onChange={e => setEditingLocation({ ...editingLocation, latency: e.target.value })}

                      className="bg-slate-950 border border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 transition-all text-sm"
                    />
                    <input
                      placeholder="Capacity (e.g. 100G+)"
                      value={editingLocation.capacity || ''}
                      onChange={e => setEditingLocation({ ...editingLocation, capacity: e.target.value })}

                      className="bg-slate-950 border border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 transition-all text-sm"
                    />
                    <input
                      placeholder="Datacenter"
                      value={editingLocation.datacenter || ''}
                      onChange={e => setEditingLocation({ ...editingLocation, datacenter: e.target.value })}

                      className="bg-slate-950 border border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 transition-all text-sm"
                    />
                    <input
                      placeholder="IX Name"
                      value={editingLocation.ixName || ''}
                      onChange={e => setEditingLocation({ ...editingLocation, ixName: e.target.value })}

                      className="bg-slate-950 border border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 transition-all text-sm"
                    />
                    <textarea
                      placeholder="Address"
                      value={editingLocation.address || ''}
                      onChange={e => setEditingLocation({ ...editingLocation, address: e.target.value })}

                      className="col-span-2 bg-slate-950 border border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 transition-all text-sm h-20"
                    />
                    <textarea
                      placeholder="Description"
                      value={editingLocation.description || ''}
                      onChange={e => setEditingLocation({ ...editingLocation, description: e.target.value })}

                      className="col-span-2 bg-slate-950 border border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 transition-all text-sm h-20"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <input
                      type="number"
                      placeholder="Peers Count"
                      value={editingLocation.peers || ''}
                      onChange={e => setEditingLocation({ ...editingLocation, peers: parseInt(e.target.value) || 0 })}

                      className="bg-slate-950 border border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 transition-all text-sm"
                    />
                    <input
                      placeholder="Established Year (e.g., 2020)"
                      value={editingLocation.established || ''}
                      onChange={e => setEditingLocation({ ...editingLocation, established: e.target.value })}

                      className="bg-slate-950 border border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 transition-all text-sm"
                    />
                    <input
                      placeholder="Uptime (e.g., 99.99%)"
                      value={editingLocation.uptime || ''}
                      onChange={e => setEditingLocation({ ...editingLocation, uptime: e.target.value })}

                      className="bg-slate-950 border border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 transition-all text-sm"
                    />
                    <input
                      placeholder="IPv4 Routes (e.g., 2K)"
                      value={editingLocation.ipv4Routes || ''}
                      onChange={e => setEditingLocation({ ...editingLocation, ipv4Routes: e.target.value })}

                      className="bg-slate-950 border border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 transition-all text-sm"
                    />
                    <input
                      placeholder="IPv6 Routes (e.g., 1K)"
                      value={editingLocation.ipv6Routes || ''}
                      onChange={e => setEditingLocation({ ...editingLocation, ipv6Routes: e.target.value })}

                      className="bg-slate-950 border border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 transition-all text-sm"
                    />
                  </div>
                </div>

                {/* Protocols & Port Speeds */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Protocols (comma-separated)</label>
                    <input
                      placeholder="e.g., BGP-4, IPv4, IPv6"
                      value={editingLocation.protocols?.join(', ') || ''}
                      onChange={e => setEditingLocation({
                        ...editingLocation,
                        protocols: e.target.value.split(',').map(p => p.trim()).filter(p => p)
                      })}

                      className="w-full bg-slate-950 border border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 transition-all text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Port Speeds (comma-separated)</label>
                    <input
                      placeholder="e.g., 1G, 10G, 40G, 100G"
                      value={editingLocation.portSpeeds?.join(', ') || ''}
                      onChange={e => setEditingLocation({
                        ...editingLocation,
                        portSpeeds: e.target.value.split(',').map(p => p.trim()).filter(p => p)
                      })}

                      className="w-full bg-slate-950 border border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 transition-all text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Features (comma-separated)</label>
                    <textarea
                      placeholder="e.g., Low-latency trading, Enterprise connectivity, Multi-cloud access"
                      value={editingLocation.features?.join(', ') || ''}
                      onChange={e => setEditingLocation({
                        ...editingLocation,
                        features: e.target.value.split(',').map(f => f.trim()).filter(f => f)
                      })}

                      className="w-full bg-slate-950 border border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 transition-all text-sm h-24"
                    />
                  </div>
                </div>

                {/* Lists Management */}
                {/* ASNs */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center bg-slate-700/50 p-2 rounded">
                    <h4 className="text-white font-medium flex items-center gap-2"><Network size={16} /> ASNs</h4>
                    <button
                      onClick={() => setEditingLocation({ ...editingLocation, asnList: [...(editingLocation.asnList || []), { asnNumber: 0, name: 'New ASN', macro: '', peeringPolicy: 'Open', status: 'ACTIVE' }] })}
                      className="text-xs bg-slate-700 hover:bg-slate-600 text-white px-2 py-1 rounded"
                    >+ Add ASN</button>
                  </div>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {editingLocation.asnList?.map((asn, idx) => (
                      <div key={idx} className="flex gap-2 items-center bg-slate-900 p-2 rounded text-sm">
                        <input
                          type="number"
                          value={asn.asnNumber || ''}
                          onChange={e => {
                            const newAsns = [...editingLocation.asnList];
                            const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                            newAsns[idx].asnNumber = isNaN(val) ? 0 : val;
                            setEditingLocation({ ...editingLocation, asnList: newAsns });
                          }}
                          className="w-20 bg-transparent border border-slate-700 rounded px-1"
                        />
                        <input
                          value={asn.name}
                          onChange={e => {
                            const newAsns = [...editingLocation.asnList];
                            newAsns[idx].name = e.target.value;
                            setEditingLocation({ ...editingLocation, asnList: newAsns });
                          }}
                          className="flex-1 bg-transparent border border-slate-700 rounded px-1"
                        />
                        <button onClick={() => {
                          const newAsns = editingLocation.asnList.filter((_, i) => i !== idx);
                          setEditingLocation({ ...editingLocation, asnList: newAsns });
                        }} className="text-red-400"><X size={14} /></button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Sites */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center bg-slate-700/50 p-2 rounded">
                    <h4 className="text-white font-medium flex items-center gap-2"><Server size={16} /> Sites & Datacenters</h4>
                    <button
                      onClick={() => setEditingLocation({ ...editingLocation, enabledSites: [...(editingLocation.enabledSites || []), { id: `site-${Date.now()}`, name: 'New Site', provider: '', address: '', status: 'available' }] })}
                      className="text-xs bg-slate-700 hover:bg-slate-600 text-white px-2 py-1 rounded"
                    >+ Add Site</button>
                  </div>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {editingLocation.enabledSites?.map((site, idx) => (
                      <div key={idx} className="bg-slate-900 p-3 rounded text-sm space-y-2">
                        <div className="flex gap-2">
                          <input
                            value={site.name}
                            placeholder="Name"
                            onChange={e => {
                              const newSites = [...(editingLocation.enabledSites || [])];
                              newSites[idx].name = e.target.value;
                              setEditingLocation({ ...editingLocation, enabledSites: newSites });
                            }}
                            className="flex-1 bg-transparent border border-slate-700 rounded px-2 py-1 text-slate-300 placeholder:text-slate-600 focus:border-blue-500 focus:outline-none"
                          />
                          <input
                            value={site.provider}
                            placeholder="Provider"
                            onChange={e => {
                              const newSites = [...(editingLocation.enabledSites || [])];
                              newSites[idx].provider = e.target.value;
                              setEditingLocation({ ...editingLocation, enabledSites: newSites });
                            }}
                            className="w-1/3 bg-transparent border border-slate-700 rounded px-2 py-1 text-slate-300 placeholder:text-slate-600 focus:border-blue-500 focus:outline-none"
                          />
                        </div>
                        <div className="flex gap-2 items-center">
                          <input
                            value={site.address || ''}
                            placeholder="Address"
                            onChange={e => {
                              const newSites = [...(editingLocation.enabledSites || [])];
                              newSites[idx] = { ...newSites[idx], address: e.target.value };
                              setEditingLocation({ ...editingLocation, enabledSites: newSites });
                            }}
                            className="flex-1 bg-transparent border border-slate-700 rounded px-2 py-1 text-slate-300 placeholder:text-slate-600 focus:border-blue-500 focus:outline-none"
                          />
                          <select
                            value={site.status || 'available'}
                            onChange={e => {
                              const newSites = [...(editingLocation.enabledSites || [])];
                              newSites[idx] = { ...newSites[idx], status: e.target.value as 'available' | 'coming-soon' };
                              setEditingLocation({ ...editingLocation, enabledSites: newSites });
                            }}
                            className="w-32 bg-transparent border border-slate-700 rounded px-2 py-1 text-slate-300 focus:border-blue-500 focus:outline-none"
                          >
                            <option value="available">Available</option>
                            <option value="coming-soon">Coming Soon</option>
                          </select>
                          <button onClick={() => {
                            const newSites = editingLocation.enabledSites?.filter((_, i) => i !== idx);
                            setEditingLocation({ ...editingLocation, enabledSites: newSites });
                          }} className="text-red-400 hover:text-red-300 p-1"><X size={14} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Pricing */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center bg-slate-700/50 p-2 rounded">
                    <h4 className="text-white font-medium flex items-center gap-2"><DollarSign size={16} /> Pricing Tiers</h4>
                    <button
                      onClick={() => setEditingLocation({ ...editingLocation, pricing: [...(editingLocation.pricing || []), { portSpeed: '10G', monthlyPrice: 0, setupFee: 0, currency: 'USD' }] })}
                      className="text-xs bg-slate-700 hover:bg-slate-600 text-white px-2 py-1 rounded"
                    >+ Add Price</button>
                  </div>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {editingLocation.pricing?.map((price, idx) => (
                      <div key={idx} className="grid grid-cols-5 gap-2 items-center bg-slate-900 p-3 rounded text-sm">
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Port Speed</label>
                          <input
                            type="text"
                            value={price.portSpeed}
                            placeholder="e.g. 10G"
                            onChange={e => {
                              const newPricing = [...(editingLocation.pricing || [])];
                              newPricing[idx].portSpeed = e.target.value;
                              setEditingLocation({ ...editingLocation, pricing: newPricing });
                            }}
                            className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Setup Fee</label>
                          <input
                            type="number"
                            value={price.setupFee || 0}
                            placeholder="0"
                            onChange={e => {
                              const newPricing = [...(editingLocation.pricing || [])];
                              const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                              newPricing[idx].setupFee = isNaN(val) ? 0 : val;
                              setEditingLocation({ ...editingLocation, pricing: newPricing });
                            }}
                            className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Monthly</label>
                          <input
                            type="number"
                            value={price.monthlyPrice || ''}
                            placeholder="0"
                            onChange={e => {
                              const newPricing = [...(editingLocation.pricing || [])];
                              const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                              newPricing[idx].monthlyPrice = isNaN(val) ? 0 : val;
                              setEditingLocation({ ...editingLocation, pricing: newPricing });
                            }}
                            className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Currency</label>
                          <input
                            value={price.currency || 'USD'}
                            placeholder="USD"
                            onChange={e => {
                              const newPricing = [...(editingLocation.pricing || [])];
                              newPricing[idx].currency = e.target.value;
                              setEditingLocation({ ...editingLocation, pricing: newPricing });
                            }}
                            className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white"
                          />
                        </div>
                        <button onClick={() => {
                          const newPricing = editingLocation.pricing?.filter((_, i) => i !== idx);
                          setEditingLocation({ ...editingLocation, pricing: newPricing });
                        }} className="text-red-400 hover:bg-red-400/10 p-2 rounded mt-5"><X size={16} /></button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Route Servers */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center bg-slate-700/50 p-2 rounded">
                    <h4 className="text-white font-medium flex items-center gap-2"><Shield size={16} /> Route Servers</h4>
                    <button
                      onClick={() => setEditingLocation({ ...editingLocation, routeServers: [...(editingLocation.routeServers || []), { name: `RS${(editingLocation.routeServers?.length || 0) + 1}`, asn: '49378', ipv4: '', ipv6: '' }] })}
                      className="text-xs bg-slate-700 hover:bg-slate-600 text-white px-2 py-1 rounded"
                    >+ Add Route Server</button>
                  </div>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {editingLocation.routeServers?.map((rs, idx) => (
                      <div key={idx} className="grid grid-cols-5 gap-2 items-center bg-slate-900 p-3 rounded text-sm">
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Name</label>
                          <input
                            value={rs.name}
                            placeholder="RS1"
                            onChange={e => {
                              const newRS = [...(editingLocation.routeServers || [])];
                              newRS[idx].name = e.target.value;
                              setEditingLocation({ ...editingLocation, routeServers: newRS });
                            }}
                            className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">ASN</label>
                          <input
                            value={rs.asn}
                            placeholder="49378"
                            onChange={e => {
                              const newRS = [...(editingLocation.routeServers || [])];
                              newRS[idx].asn = e.target.value;
                              setEditingLocation({ ...editingLocation, routeServers: newRS });
                            }}
                            className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white"
                          />
                        </div>
                        <div className="col-span-2 grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs text-slate-500 mb-1">IPv4</label>
                            <input
                              value={rs.ipv4 || ''}
                              placeholder="192.168.1.1"
                              onChange={e => {
                                const newRS = [...(editingLocation.routeServers || [])];
                                newRS[idx].ipv4 = e.target.value;
                                setEditingLocation({ ...editingLocation, routeServers: newRS });
                              }}
                              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white font-mono text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-slate-500 mb-1">IPv6</label>
                            <input
                              value={rs.ipv6 || ''}
                              placeholder="2001:db8::1"
                              onChange={e => {
                                const newRS = [...(editingLocation.routeServers || [])];
                                newRS[idx].ipv6 = e.target.value;
                                setEditingLocation({ ...editingLocation, routeServers: newRS });
                              }}
                              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white font-mono text-xs"
                            />
                          </div>
                        </div>
                        <button onClick={() => {
                          const newRS = editingLocation.routeServers?.filter((_, i) => i !== idx);
                          setEditingLocation({ ...editingLocation, routeServers: newRS });
                        }} className="text-red-400 hover:bg-red-400/10 p-2 rounded mt-5"><X size={16} /></button>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 bg-slate-800/30 rounded-lg border-2 border-dashed border-slate-700 p-12">
                <Globe size={48} className="mb-4 opacity-50" />
                <p>Select a location to edit or add a new one.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LocationsAdminPanel;
