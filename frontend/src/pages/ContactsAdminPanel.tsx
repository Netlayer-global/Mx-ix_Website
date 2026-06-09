import React, { useState, useEffect } from 'react';
import { 
  ChevronLeft, 
  Save,
  Phone,
  Mail,
  Briefcase,
  Headphones,
  CheckCircle,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { contactsApi } from '../services/api';

interface ContactsAdminPanelProps {
  embedded?: boolean;
  onBack?: () => void;
}

interface SimpleContact {
  phone: string;
  email: string;
}

const ContactsAdminPanel: React.FC<ContactsAdminPanelProps> = ({ embedded = false, onBack }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  
  // Simple state: just Sales and Support contacts
  const [contacts, setContacts] = useState<{
    sales: SimpleContact;
    support: SimpleContact;
  }>({
    sales: { phone: '+1 (555) 100-2000', email: 'sales@mx-ix.com' },
    support: { phone: '+1 (555) 100-3000', email: 'support@mx-ix.com' }
  });

  useEffect(() => {
    fetchContacts();
  }, []);

  const fetchContacts = async () => {
    setLoading(true);
    try {
      const response = await contactsApi.getAll();
      if (response.success && response.data) {
        // Backend now guarantees lowercase department names
        const salesContact = response.data.find(c => c.department === 'sales');
        const supportContact = response.data.find(c => c.department === 'support');
        
        setContacts({
          sales: salesContact 
            ? { phone: salesContact.phone, email: salesContact.email }
            : { phone: '+1 (555) 100-2000', email: 'sales@mx-ix.com' },
          support: supportContact 
            ? { phone: supportContact.phone, email: supportContact.email }
            : { phone: '+1 (555) 100-3000', email: 'support@mx-ix.com' }
        });
      }
    } catch (error) {
      console.error('Failed to fetch contacts:', error);
    }
    setLoading(false);
  };

  const showAlert = (type: 'success' | 'error', message: string) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 3000);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Save both contacts - use lowercase department names to match backend
      const [salesRes, supportRes] = await Promise.all([
        contactsApi.upsert('sales', 'global', { phone: contacts.sales.phone, email: contacts.sales.email }),
        contactsApi.upsert('support', 'global', { phone: contacts.support.phone, email: contacts.support.email })
      ]);
      
      if (salesRes.success && supportRes.success) {
        showAlert('success', 'Contacts saved successfully!');
      } else {
        showAlert('error', 'Failed to save some contacts');
      }
    } catch (error) {
      showAlert('error', 'Failed to save contacts');
    }
    setSaving(false);
  };

  const updateContact = (type: 'sales' | 'support', field: 'phone' | 'email', value: string) => {
    setContacts(prev => ({
      ...prev,
      [type]: { ...prev[type], [field]: value }
    }));
  };

  return (
    <div className={`min-h-screen ${embedded ? '' : 'bg-[#0a1628]'}`}>
      {/* Header */}
      <div className="bg-[#0d1e36] border-b border-white/10">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {embedded && onBack && (
                <button
                  onClick={onBack}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <ChevronLeft className="w-5 h-5 text-white" />
                </button>
              )}
              <div>
                <h1 className="text-2xl font-bold text-white">Contact Information</h1>
                <p className="text-gray-400 text-sm">Edit Sales and Support contact details</p>
              </div>
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-[#F20732] hover:bg-[#d4062b] text-white rounded-lg transition-colors font-medium disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Changes
            </button>
          </div>
        </div>
      </div>

      {/* Alert */}
      {alert && (
        <div className={`max-w-4xl mx-auto px-6 mt-4`}>
          <div className={`p-4 rounded-lg flex items-center gap-3 ${
            alert.type === 'success' ? 'bg-green-500/20 border border-green-500/30' : 'bg-red-500/20 border border-red-500/30'
          }`}>
            {alert.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-green-400" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-400" />
            )}
            <span className={alert.type === 'success' ? 'text-green-400' : 'text-red-400'}>
              {alert.message}
            </span>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-[#F20732] animate-spin" />
          </div>
        ) : (
          <div className="grid gap-6">
            {/* Sales Contact Card */}
            <div className="bg-[#0d1e36] border border-white/10 rounded-xl overflow-hidden">
              <div className="bg-gradient-to-r from-blue-500/20 to-blue-600/10 px-6 py-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
                    <Briefcase className="w-6 h-6 text-blue-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Sales</h2>
                    <p className="text-sm text-gray-400">For new business inquiries and quotes</p>
                  </div>
                </div>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="flex items-center gap-2 text-sm text-gray-400 mb-2 font-medium">
                      <Phone className="w-4 h-4" />
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={contacts.sales.phone}
                      onChange={(e) => updateContact('sales', 'phone', e.target.value)}
                      placeholder="+1 (555) 100-2000"
                      className="w-full px-4 py-3 bg-[#1a2d47] border border-white/10 rounded-lg text-white text-lg focus:border-[#F20732] focus:outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-sm text-gray-400 mb-2 font-medium">
                      <Mail className="w-4 h-4" />
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={contacts.sales.email}
                      onChange={(e) => updateContact('sales', 'email', e.target.value)}
                      placeholder="sales@mx-ix.com"
                      className="w-full px-4 py-3 bg-[#1a2d47] border border-white/10 rounded-lg text-white text-lg focus:border-[#F20732] focus:outline-none transition-colors"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Support Contact Card */}
            <div className="bg-[#0d1e36] border border-white/10 rounded-xl overflow-hidden">
              <div className="bg-gradient-to-r from-green-500/20 to-green-600/10 px-6 py-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center">
                    <Headphones className="w-6 h-6 text-green-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Technical Support</h2>
                    <p className="text-sm text-gray-400">For existing customers needing help</p>
                  </div>
                </div>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="flex items-center gap-2 text-sm text-gray-400 mb-2 font-medium">
                      <Phone className="w-4 h-4" />
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={contacts.support.phone}
                      onChange={(e) => updateContact('support', 'phone', e.target.value)}
                      placeholder="+1 (555) 100-3000"
                      className="w-full px-4 py-3 bg-[#1a2d47] border border-white/10 rounded-lg text-white text-lg focus:border-[#F20732] focus:outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-sm text-gray-400 mb-2 font-medium">
                      <Mail className="w-4 h-4" />
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={contacts.support.email}
                      onChange={(e) => updateContact('support', 'email', e.target.value)}
                      placeholder="support@mx-ix.com"
                      className="w-full px-4 py-3 bg-[#1a2d47] border border-white/10 rounded-lg text-white text-lg focus:border-[#F20732] focus:outline-none transition-colors"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Info Note */}
            <div className="bg-[#F20732]/10 border border-[#F20732]/20 rounded-lg p-4">
              <p className="text-sm text-gray-300">
                <span className="font-bold text-[#F20732]">Note:</span> These contact details will be displayed on the public Contact page. 
                Changes are saved to the database and will reflect immediately on the website.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ContactsAdminPanel;
