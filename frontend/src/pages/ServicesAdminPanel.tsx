import React, { useState, useEffect } from 'react';
import {
  Plus,
  Trash2,
  Edit2,
  Save,
  X,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  Loader2,
  AlertCircle,
  CheckCircle2,
  LogOut,
  RefreshCw,
  ExternalLink,
  Search
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { authApi, servicesApi, Service, ServiceItem } from '../services/api';

const SUGGESTED_ICONS = [
  'server', 'database', 'cloud', 'shield', 'shield-check', 'globe', 'wifi', 'zap',
  'activity', 'cpu', 'lock', 'users', 'mail', 'phone', 'map-pin', 'clock',
  'calendar', 'file-text', 'settings', 'search', 'monitor', 'smartphone',
  'hard-drive', 'network', 'layers', 'box', 'truck', 'credit-card', 'key',
  'anchor', 'archive', 'arrow-right', 'bar-chart', 'bell', 'bluetooth',
  'book', 'bookmark', 'briefcase', 'camera', 'check', 'check-circle',
  'chevron-right', 'clipboard', 'code', 'command', 'compass', 'copy',
  'credit-card', 'crop', 'crosshair', 'disc', 'download', 'edit',
  'external-link', 'eye', 'file', 'filter', 'flag', 'folder', 'gift',
  'grid', 'hash', 'heart', 'help-circle', 'home', 'image', 'inbox',
  'info', 'layout', 'life-buoy', 'link', 'list', 'loader', 'log-in',
  'log-out', 'menu', 'message-circle', 'message-square', 'mic',
  'minus', 'more-horizontal', 'more-vertical', 'mouse-pointer', 'move',
  'music', 'navigation', 'package', 'paperclip', 'pause', 'percent',
  'pie-chart', 'play', 'plus', 'plus-circle', 'power', 'printer',
  'radio', 'refresh-cw', 'repeat', 'save', 'scissors', 'send',
  'share', 'share-2', 'shopping-bag', 'shopping-cart', 'shuffle',
  'sidebar', 'skip-back', 'skip-forward', 'slash', 'sliders',
  'smartphone', 'smile', 'speaker', 'square', 'star', 'stop-circle',
  'sun', 'sunrise', 'sunset', 'tablet', 'tag', 'target', 'terminal',
  'thermometer', 'thumbs-down', 'thumbs-up', 'toggle-left',
  'toggle-right', 'tool', 'trash', 'trash-2', 'trello', 'trending-down',
  'trending-up', 'triangle', 'truck', 'tv', 'twitch', 'twitter',
  'type', 'umbrella', 'underline', 'unlock', 'upload', 'upload-cloud',
  'user', 'user-check', 'user-minus', 'user-plus', 'user-x', 'users',
  'video', 'voicemail', 'volume', 'volume-1', 'volume-2', 'volume-x',
  'watch', 'wifi', 'wifi-off', 'wind', 'x', 'x-circle', 'x-octagon',
  'x-square', 'youtube', 'zap', 'zap-off', 'zoom-in', 'zoom-out'
];

interface ServicesAdminPanelProps {
  embedded?: boolean;
  onBack?: () => void;
}

// Helper to get icon component dynamically
const getIconComponent = (iconName: string) => {
  if (!iconName) return null;
  const pascalCase = iconName.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
  return (LucideIcons as any)[pascalCase] || null;
};

const IconPicker: React.FC<{
  value: string;
  onChange: (value: string) => void;
}> = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filteredIcons = SUGGESTED_ICONS.filter(icon =>
    icon.toLowerCase().includes(search.toLowerCase())
  );

  const SelectedIcon = getIconComponent(value);

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-gray-300 mb-1">
        Icon (from <a href="https://lucide.dev/icons" target="_blank" rel="noopener noreferrer" className="text-[#F20732] hover:underline">Lucide</a>)
      </label>

      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#F20732] hover:bg-gray-650 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gray-600 rounded flex items-center justify-center text-gray-300">
            {SelectedIcon ? <SelectedIcon className="w-5 h-5" /> : <span className="text-xs">None</span>}
          </div>
          <span className="text-gray-200">{value || 'Select an icon...'}</span>
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-2 w-full bg-gray-800 border border-gray-600 rounded-lg shadow-xl max-h-80 flex flex-col">
          {/* Search */}
          <div className="p-3 border-b border-gray-700 sticky top-0 bg-gray-800 rounded-t-lg">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search icons..."
                className="w-full pl-9 pr-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#F20732]"
                autoFocus
              />
            </div>
            {/* Custom Input Option */}
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder="Or type custom name..."
                className="flex-1 px-2 py-1 bg-gray-900 border border-gray-700 rounded text-xs text-gray-300 focus:outline-none focus:border-[#F20732]"
              />
            </div>
          </div>

          {/* Grid */}
          <div className="flex-1 overflow-y-auto p-2">
            <div className="grid grid-cols-5 gap-2">
              {filteredIcons.map(iconName => {
                const Icon = getIconComponent(iconName);
                if (!Icon) return null;
                return (
                  <button
                    key={iconName}
                    type="button"
                    onClick={() => {
                      onChange(iconName);
                      setIsOpen(false);
                    }}
                    className={`
                      aspect-square flex flex-col items-center justify-center gap-1 rounded-lg hover:bg-gray-700 transition-all
                      ${value === iconName ? 'bg-[#F20732]/20 border border-[#F20732] text-[#F20732]' : 'text-gray-400 hover:text-white border border-transparent'}
                    `}
                    title={iconName}
                  >
                    <Icon className="w-5 h-5" />
                  </button>
                );
              })}
            </div>
            {filteredIcons.length === 0 && (
              <div className="text-center py-4 text-gray-500 text-sm">
                No icons found. <br /> Try typing a custom name above.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Backdrop to close */}
      {isOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}></div>
      )}
    </div>
  );
};

const ServicesAdminPanel: React.FC<ServicesAdminPanelProps> = ({ embedded = false, onBack }) => {
  // Auth state - skip if embedded (already logged in from dashboard)
  const [isLoggedIn, setIsLoggedIn] = useState(embedded);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Services state
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // UI state
  const [expandedService, setExpandedService] = useState<string | null>(null);
  const [editingService, setEditingService] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<{ serviceId: string; index: number } | null>(null);

  // New service form
  const [showNewService, setShowNewService] = useState(false);
  const [newService, setNewService] = useState({
    id: '',
    category: '',
    tagline: '',
    description: '',
  });

  // New item form
  const [showNewItem, setShowNewItem] = useState<string | null>(null);
  const [newItem, setNewItem] = useState({
    name: '',
    description: '',
    benefits: '',
    features: '',
    icon: '',
  });

  // Check auth on mount
  useEffect(() => {
    if (authApi.isLoggedIn()) {
      setIsLoggedIn(true);
      loadServices();
    } else {
      setLoading(false);
    }
  }, []);

  const loadServices = async () => {
    setLoading(true);
    setError('');
    const result = await servicesApi.getAll();
    if (result.success && result.data) {
      setServices(result.data);
    } else {
      setError(result.error || 'Failed to load services');
    }
    setLoading(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError('');

    const result = await authApi.login(email, password);
    if (result.success) {
      setIsLoggedIn(true);
      loadServices();
    } else {
      setLoginError(result.error || 'Login failed');
    }
    setLoginLoading(false);
  };

  const handleLogout = () => {
    authApi.logout();
    setIsLoggedIn(false);
    setServices([]);
  };

  const showSuccessMessage = (message: string) => {
    setSuccess(message);
    setTimeout(() => setSuccess(''), 3000);
  };

  // Create new service
  const handleCreateService = async () => {
    if (!newService.id || !newService.category || !newService.tagline || !newService.description) {
      setError('All fields are required');
      return;
    }

    const result = await servicesApi.create({
      ...newService,
      image: '',
      order: services.length,
      isActive: true,
      items: [],
    });

    if (result.success && result.data) {
      setServices([...services, result.data]);
      setNewService({ id: '', category: '', tagline: '', description: '' });
      setShowNewService(false);
      showSuccessMessage('Service created successfully!');
    } else {
      setError(result.error || 'Failed to create service');
    }
  };

  // Update service
  const handleUpdateService = async (serviceId: string, updates: Partial<Service>) => {
    const result = await servicesApi.update(serviceId, updates);
    if (result.success && result.data) {
      setServices(services.map(s => s.id === serviceId ? result.data! : s));
      setEditingService(null);
      showSuccessMessage('Service updated successfully!');
    } else {
      setError(result.error || 'Failed to update service');
    }
  };

  // Delete service
  const handleDeleteService = async (serviceId: string) => {
    const service = services.find(s => s.id === serviceId);
    const serviceName = service?.category || serviceId;

    const confirmed = window.confirm(
      `⚠️ Delete Service Category?\n\n` +
      `Are you sure you want to delete "${serviceName}"?\n\n` +
      `This will permanently remove:\n` +
      `• The service category\n` +
      `• All ${service?.items.length || 0} service item(s) under it\n\n` +
      `This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      const res = await servicesApi.delete(serviceId);

      if (res.success) {
        setServices(services.filter(s => s.id !== serviceId));
        showSuccessMessage(`✅ "${serviceName}" deleted successfully!`);
      } else {
        setError(res.error || 'Failed to delete service');
        alert(`❌ Failed to delete service: ${res.error}`);
      }
    } catch (err) {
      console.error('Delete service error:', err);
      setError('Failed to delete service');
      alert('❌ Error deleting service. Please try again.');
    }
  };

  // Add item to service
  const handleAddItem = async (serviceId: string) => {
    if (!newItem.name || !newItem.description) {
      setError('Name and description are required');
      return;
    }

    const result = await servicesApi.addItem(serviceId, {
      name: newItem.name,
      description: newItem.description,
      benefits: newItem.benefits.split('\n').filter(b => b.trim()),
      features: newItem.features.split('\n').filter(f => f.trim()),
      icon: newItem.icon,
      order: 0,
    });

    if (result.success) {
      loadServices();
      setNewItem({ name: '', description: '', benefits: '', features: '', icon: '' });
      setShowNewItem(null);
      showSuccessMessage('Item added successfully!');
    } else {
      setError(result.error || 'Failed to add item');
    }
  };

  // Update item
  const handleUpdateItem = async (serviceId: string, itemIndex: number, updates: Partial<ServiceItem>) => {
    const result = await servicesApi.updateItem(serviceId, itemIndex, updates);
    if (result.success) {
      loadServices();
      setEditingItem(null);
      showSuccessMessage('Item updated successfully!');
    } else {
      setError(result.error || 'Failed to update item');
    }
  };

  // Delete item from service
  const handleDeleteItem = async (serviceId: string, itemIndex: number) => {
    const service = services.find(s => s.id === serviceId);
    const item = service?.items[itemIndex];
    const itemName = item?.name || 'this item';

    const confirmed = window.confirm(
      `⚠️ Delete Service Item?\n\n` +
      `Are you sure you want to delete "${itemName}"?\n\n` +
      `This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      const result = await servicesApi.deleteItem(serviceId, itemIndex);

      if (result.success) {
        loadServices();
        showSuccessMessage(`✅ "${itemName}" deleted successfully!`);
      } else {
        setError(result.error || 'Failed to delete item');
        alert(`❌ Failed to delete item: ${result.error}`);
      }
    } catch (err) {
      console.error('Delete item error:', err);
      setError('Failed to delete item');
      alert('❌ Error deleting item. Please try again.');
    }
  };

  // Login form
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 rounded-xl p-8 w-full max-w-md border border-gray-700">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-[#F20732] rounded-xl flex items-center justify-center mx-auto mb-4">
              <span className="text-white text-2xl font-black">MX</span>
            </div>
            <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
            <p className="text-gray-400 mt-2">Sign in to manage services</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#F20732]"
                placeholder="admin@mx-ix.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#F20732]"
                placeholder="••••••••"
              />
            </div>

            {loginError && (
              <div className="flex items-center gap-2 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4" />
                {loginError}
              </div>
            )}

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-3 bg-[#F20732] text-white font-bold rounded-lg hover:bg-[#C00628] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loginLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Main admin panel
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            {embedded && onBack && (
              <button
                onClick={onBack}
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            {!embedded && (
              <div className="w-10 h-10 bg-[#F20732] rounded-lg flex items-center justify-center">
                <span className="text-white font-black">MX</span>
              </div>
            )}
            <div>
              <h1 className="text-xl font-bold">Services Admin</h1>
              <p className="text-gray-400 text-sm">Manage service categories and items</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={loadServices}
              className="p-2 text-gray-400 hover:text-white transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
            {!embedded && (
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Alerts */}
      {error && (
        <div className="max-w-7xl mx-auto px-6 mt-4">
          <div className="flex items-center gap-2 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400">
            <AlertCircle className="w-5 h-5" />
            {error}
            <button onClick={() => setError('')} className="ml-auto">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
      {success && (
        <div className="max-w-7xl mx-auto px-6 mt-4">
          <div className="flex items-center gap-2 p-4 bg-green-500/20 border border-green-500/50 rounded-lg text-green-400">
            <CheckCircle2 className="w-5 h-5" />
            {success}
          </div>
        </div>
      )}

      {/* Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Add New Service Button */}
        <div className="mb-6">
          <button
            onClick={() => setShowNewService(!showNewService)}
            className="flex items-center gap-2 px-4 py-2 bg-[#F20732] rounded-lg hover:bg-[#C00628] transition-colors font-medium"
          >
            <Plus className="w-5 h-5" />
            Add New Service Category
          </button>
        </div>

        {/* New Service Form */}
        {showNewService && (
          <div className="mb-6 p-6 bg-gray-800 rounded-xl border border-gray-700">
            <h3 className="text-lg font-bold mb-4">Create New Service Category</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">ID (url-friendly)</label>
                <input
                  type="text"
                  value={newService.id}
                  onChange={e => setNewService({ ...newService, id: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#F20732]"
                  placeholder="e.g., peering"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Category Name</label>
                <input
                  type="text"
                  value={newService.category}
                  onChange={e => setNewService({ ...newService, category: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#F20732]"
                  placeholder="e.g., Peering"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Tagline</label>
                <input
                  type="text"
                  value={newService.tagline}
                  onChange={e => setNewService({ ...newService, tagline: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#F20732]"
                  placeholder="e.g., Direct Interconnection at Scale"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
                <textarea
                  value={newService.description}
                  onChange={e => setNewService({ ...newService, description: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#F20732]"
                  placeholder="Service description..."
                />
              </div>
            </div>
            <div className="flex gap-4 mt-4">
              <button
                onClick={handleCreateService}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
              >
                <Save className="w-4 h-4" />
                Create Service
              </button>
              <button
                onClick={() => setShowNewService(false)}
                className="px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-[#F20732]" />
          </div>
        )}

        {/* Services List */}
        {!loading && (
          <div className="space-y-4">
            {services.length === 0 ? (
              <div className="text-center py-20 text-gray-400">
                <p className="text-lg">No services found</p>
                <p className="text-sm mt-2">Click "Add New Service Category" to create one</p>
              </div>
            ) : (
              services.map(service => (
                <div key={service.id} className="bg-gray-800 rounded-xl border border-gray-700">
                  {/* Service Header */}
                  <div className="p-4 flex items-center justify-between rounded-t-xl">
                    <button
                      onClick={() => setExpandedService(expandedService === service.id ? null : service.id)}
                      className="flex items-center gap-4 flex-1 text-left"
                    >
                      <div className="w-12 h-12 bg-[#F20732]/20 rounded-lg flex items-center justify-center">
                        <span className="text-[#F20732] font-bold">{service.order || 1}</span>
                      </div>
                      <div>
                        <h3 className="font-bold text-lg">{service.category}</h3>
                        <p className="text-gray-400 text-sm">{service.tagline}</p>
                      </div>
                      <span className="ml-auto mr-4 px-3 py-1 bg-gray-700 rounded-full text-sm">
                        {service.items.length} items
                      </span>
                      {expandedService === service.id ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </button>
                    <div className="flex items-center gap-2 relative z-10">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          setEditingService(editingService === service.id ? null : service.id);
                        }}
                        className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-all pointer-events-auto"
                        title="Edit"
                        type="button"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          handleDeleteService(service.id);
                        }}
                        className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-all pointer-events-auto"
                        title="Delete"
                        type="button"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Edit Service Form */}
                  {editingService === service.id && (
                    <div className="px-4 pb-4 border-t border-gray-700 pt-4">
                      <ServiceEditForm
                        service={service}
                        onSave={(updates) => handleUpdateService(service.id, updates)}
                        onCancel={() => setEditingService(null)}
                      />
                    </div>
                  )}

                  {/* Expanded Items */}
                  {expandedService === service.id && (
                    <div className="border-t border-gray-700 p-4">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-medium text-gray-300">Service Items</h4>
                        <button
                          onClick={() => setShowNewItem(showNewItem === service.id ? null : service.id)}
                          className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors text-sm"
                        >
                          <Plus className="w-4 h-4" />
                          Add Item
                        </button>
                      </div>

                      {/* New Item Form */}
                      {showNewItem === service.id && (
                        <div className="mb-4 p-4 bg-gray-700/50 rounded-lg">
                          <h5 className="font-medium mb-3">Add New Item</h5>
                          <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Name</label>
                                <input
                                  type="text"
                                  value={newItem.name}
                                  onChange={e => setNewItem({ ...newItem, name: e.target.value })}
                                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#F20732]"
                                  placeholder="e.g., Bilateral Peering"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
                                <input
                                  type="text"
                                  value={newItem.description}
                                  onChange={e => setNewItem({ ...newItem, description: e.target.value })}
                                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#F20732]"
                                  placeholder="Short description..."
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Benefits (one per line)</label>
                                <textarea
                                  value={newItem.benefits}
                                  onChange={e => setNewItem({ ...newItem, benefits: e.target.value })}
                                  rows={4}
                                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#F20732]"
                                  placeholder="Benefit 1&#10;Benefit 2&#10;Benefit 3"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Features (one per line)</label>
                                <textarea
                                  value={newItem.features}
                                  onChange={e => setNewItem({ ...newItem, features: e.target.value })}
                                  rows={4}
                                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#F20732]"
                                  placeholder="Feature 1&#10;Feature 2&#10;Feature 3"
                                />
                              </div>
                            </div>
                            <div className="mt-4">
                              <IconPicker
                                value={newItem.icon}
                                onChange={(val) => setNewItem({ ...newItem, icon: val })}
                              />
                            </div>
                          </div>
                          <div className="flex gap-2 mt-4">
                            <button
                              onClick={() => handleAddItem(service.id)}
                              className="px-4 py-2 bg-green-600 rounded-lg hover:bg-green-700 transition-colors text-sm"
                            >
                              Add Item
                            </button>
                            <button
                              onClick={() => setShowNewItem(null)}
                              className="px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-500 transition-colors text-sm"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Items List */}
                      <div className="space-y-3">
                        {service.items.length === 0 ? (
                          <p className="text-gray-500 text-sm text-center py-4">No items yet. Add one above.</p>
                        ) : (
                          service.items.map((item, index) => (
                            <div key={index} className="bg-gray-700/50 rounded-lg">
                              {/* Item row (collapsed or header when editing) */}
                              {editingItem?.serviceId === service.id && editingItem?.index === index ? (
                                <ItemEditForm
                                  item={item}
                                  onSave={(updates) => handleUpdateItem(service.id, index, updates)}
                                  onCancel={() => setEditingItem(null)}
                                />
                              ) : (
                                <div className="p-4">
                                  <div className="flex items-start gap-4">
                                    <div className="w-8 h-8 bg-gray-600 rounded flex items-center justify-center text-gray-400 text-sm flex-shrink-0">
                                      {index + 1}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <h5 className="font-medium text-white">{item.name}</h5>
                                      <p className="text-gray-400 text-sm mt-1">{item.description}</p>

                                      {/* Benefits & Features Preview */}
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                                        <div>
                                          <p className="text-xs font-medium text-[#F20732] uppercase tracking-wide mb-2">Benefits ({item.benefits.length})</p>
                                          <ul className="space-y-1">
                                            {item.benefits.slice(0, 3).map((b, i) => (
                                              <li key={i} className="text-xs text-gray-400 flex items-start gap-2">
                                                <span className="text-green-500 mt-0.5">✓</span>
                                                <span className="truncate">{b}</span>
                                              </li>
                                            ))}
                                            {item.benefits.length > 3 && (
                                              <li className="text-xs text-gray-500 pl-5">+{item.benefits.length - 3} more...</li>
                                            )}
                                          </ul>
                                        </div>
                                        <div>
                                          <p className="text-xs font-medium text-gray-300 uppercase tracking-wide mb-2">Features ({item.features.length})</p>
                                          <ul className="space-y-1">
                                            {item.features.slice(0, 3).map((f, i) => (
                                              <li key={i} className="text-xs text-gray-400 flex items-start gap-2">
                                                <span className="text-blue-400 mt-0.5">●</span>
                                                <span className="truncate">{f}</span>
                                              </li>
                                            ))}
                                            {item.features.length > 3 && (
                                              <li className="text-xs text-gray-500 pl-5">+{item.features.length - 3} more...</li>
                                            )}
                                          </ul>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0 relative z-10">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          e.preventDefault();
                                          setEditingItem({ serviceId: service.id, index });
                                        }}
                                        className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-all pointer-events-auto"
                                        title="Edit item"
                                        type="button"
                                      >
                                        <Edit2 className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          e.preventDefault();
                                          handleDeleteItem(service.id, index);
                                        }}
                                        className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-all pointer-events-auto"
                                        title="Delete item"
                                        type="button"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
};

// Service Edit Form Component (no image field)
const ServiceEditForm: React.FC<{
  service: Service;
  onSave: (updates: Partial<Service>) => void;
  onCancel: () => void;
}> = ({ service, onSave, onCancel }) => {
  const [category, setCategory] = useState(service.category);
  const [tagline, setTagline] = useState(service.tagline);
  const [description, setDescription] = useState(service.description);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Category Name</label>
        <input
          type="text"
          value={category}
          onChange={e => setCategory(e.target.value)}
          className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#F20732]"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Tagline</label>
        <input
          type="text"
          value={tagline}
          onChange={e => setTagline(e.target.value)}
          className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#F20732]"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
        <input
          type="text"
          value={description}
          onChange={e => setDescription(e.target.value)}
          className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#F20732]"
        />
      </div>
      <div className="md:col-span-3 flex gap-4">
        <button
          onClick={() => onSave({ category, tagline, description })}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
        >
          <Save className="w-4 h-4" />
          Save Changes
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

// Item Edit Form Component
const ItemEditForm: React.FC<{
  item: ServiceItem;
  onSave: (updates: Partial<ServiceItem>) => void;
  onCancel: () => void;
}> = ({ item, onSave, onCancel }) => {
  const [name, setName] = useState(item.name);
  const [description, setDescription] = useState(item.description);
  const [benefits, setBenefits] = useState(item.benefits.join('\n'));
  const [features, setFeatures] = useState(item.features.join('\n'));
  const [icon, setIcon] = useState(item.icon || '');

  return (
    <div className="p-4 bg-gray-600/50 rounded-lg">
      <h5 className="font-medium mb-4 flex items-center gap-2">
        <Edit2 className="w-4 h-4 text-[#F20732]" />
        Editing: {item.name}
      </h5>
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#F20732]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#F20732]"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Benefits (one per line)</label>
            <textarea
              value={benefits}
              onChange={e => setBenefits(e.target.value)}
              rows={5}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#F20732]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Features (one per line)</label>
            <textarea
              value={features}
              onChange={e => setFeatures(e.target.value)}
              rows={5}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#F20732]"
            />
          </div>
        </div>
        <div className="col-span-1 md:col-span-2">
          <IconPicker
            value={icon}
            onChange={setIcon}
          />
        </div>
      </div>
      <div className="flex gap-2 mt-4">
        <button
          onClick={() => onSave({
            name,
            description,
            benefits: benefits.split('\n').filter(b => b.trim()),
            features: features.split('\n').filter(f => f.trim()),
            icon,
          })}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 rounded-lg hover:bg-green-700 transition-colors text-sm"
        >
          <Save className="w-4 h-4" />
          Save Item
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 bg-gray-600 rounded-lg hover:bg-gray-500 transition-colors text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default ServicesAdminPanel;
