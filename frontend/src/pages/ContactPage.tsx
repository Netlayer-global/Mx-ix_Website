import React, { useState, useEffect } from 'react';
import { 
  Briefcase, 
  Wrench, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  ArrowRight,
  BarChart3,
  Settings,
  ChevronDown
} from 'lucide-react';
import { useAdmin } from '../contexts/AdminContext';
import { contactsApi } from '../services/api';

interface ContactPageProps {
  preSelectedCity?: string;
}

// Contact information structure
interface ContactInfo {
  phone: string;
  email: string;
}

interface DepartmentContacts {
  [language: string]: ContactInfo;
}

interface AllContacts {
  sales: DepartmentContacts;
  services: DepartmentContacts;
}

// Cloud Provider Icons - Real SVG brand icons
const CloudProviderIcon: React.FC<{ provider: string; size?: number }> = ({ provider, size = 20 }) => {
  const icons: { [key: string]: JSX.Element } = {
    aws: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path d="M6.763 10.036c0 .296.032.535.088.71.064.176.144.368.256.576.04.063.056.127.056.183 0 .08-.048.16-.152.24l-.503.335a.383.383 0 0 1-.208.072c-.08 0-.16-.04-.239-.112a2.47 2.47 0 0 1-.287-.375 6.18 6.18 0 0 1-.248-.471c-.622.734-1.405 1.101-2.347 1.101-.67 0-1.205-.191-1.596-.574-.391-.384-.59-.894-.59-1.533 0-.678.239-1.23.726-1.644.487-.415 1.133-.623 1.955-.623.271 0 .55.024.846.064.296.04.6.104.918.176v-.583c0-.607-.127-1.03-.375-1.277-.255-.248-.686-.367-1.3-.367-.279 0-.567.032-.863.104a6.37 6.37 0 0 0-.862.289c-.128.055-.223.088-.286.104a.508.508 0 0 1-.123.024c-.111 0-.167-.08-.167-.247V5.69a.56.56 0 0 1 .072-.263.61.61 0 0 1 .255-.185 6.93 6.93 0 0 1 1.053-.359c.367-.087.758-.136 1.174-.136.894 0 1.548.199 1.963.615.41.407.614 1.03.614 1.867v2.454h.012zm-3.24 1.214c.263 0 .534-.048.822-.144.287-.096.542-.271.758-.503.128-.152.224-.32.272-.512.047-.191.08-.423.08-.694v-.335a6.66 6.66 0 0 0-.735-.136 6.02 6.02 0 0 0-.75-.048c-.535 0-.926.104-1.19.32-.263.215-.39.518-.39.917 0 .375.096.655.295.846.192.2.479.295.838.295zm6.41.863c-.144 0-.24-.024-.304-.08-.064-.048-.12-.16-.168-.311L7.586 5.55a1.398 1.398 0 0 1-.072-.32c0-.127.063-.199.191-.199h.783c.151 0 .255.024.31.08.065.048.113.16.16.311l1.342 5.284 1.245-5.284c.04-.16.088-.263.152-.311.064-.048.175-.08.318-.08h.639c.151 0 .255.024.318.08.064.048.12.16.152.311l1.261 5.348 1.381-5.348c.048-.16.104-.263.16-.311.063-.048.167-.08.31-.08h.743c.128 0 .2.064.2.199 0 .04-.009.08-.017.128a1.137 1.137 0 0 1-.056.2l-1.923 6.17c-.048.16-.104.264-.168.312a.498.498 0 0 1-.303.08h-.687c-.151 0-.255-.024-.31-.08-.064-.048-.12-.16-.16-.32l-1.238-5.147-1.23 5.14c-.04.16-.096.263-.16.319-.064.048-.175.072-.318.072h-.687l.016-.007zm10.256.215c-.415 0-.83-.048-1.229-.143-.399-.096-.71-.2-.918-.32a.56.56 0 0 1-.24-.215.611.611 0 0 1-.055-.247v-.335c0-.167.063-.247.183-.247.048 0 .096.008.144.024.056.016.136.056.231.104.24.12.503.215.79.279.296.064.583.096.878.096.463 0 .822-.08 1.07-.247.247-.167.375-.4.375-.702 0-.2-.064-.366-.191-.502-.128-.136-.367-.263-.71-.383l-1.021-.32c-.511-.16-.894-.4-1.134-.718a1.66 1.66 0 0 1-.358-1.037c0-.27.056-.51.167-.726.112-.215.263-.399.455-.551.191-.16.415-.279.67-.359.256-.08.527-.12.814-.12.144 0 .295.008.454.024.16.024.311.056.455.088.136.032.271.072.399.12.128.048.223.096.287.144.08.048.144.104.183.168.04.056.056.128.056.224v.31c0 .168-.064.256-.183.256-.064 0-.168-.032-.31-.096-.48-.215-1.023-.327-1.62-.327-.422 0-.758.065-.999.2-.24.136-.367.344-.367.63 0 .207.072.382.215.51.144.128.407.256.789.368l1 .312c.503.16.878.384 1.11.67.232.287.35.615.35.985 0 .279-.055.535-.168.766-.112.231-.271.438-.47.607-.2.176-.439.303-.718.39-.296.096-.614.143-.942.143h.024z" fill="#FF9900"/>
        <path d="M21.725 16.166c-2.39 1.685-5.852 2.586-8.836 2.586-4.184 0-7.949-1.532-10.8-4.083-.225-.2-.025-.48.243-.321 3.075 1.774 6.87 2.845 10.8 2.845 2.647 0 5.558-.551 8.235-1.684.4-.175.742.262.358.657z" fill="#FF9900"/>
        <path d="M22.634 15.135c-.305-.391-2.022-.19-2.794-.096-.233.032-.27-.175-.058-.327 1.37-.952 3.613-.678 3.872-.359.26.327-.072 2.558-1.353 3.623-.199.168-.391.08-.303-.144.294-.73.947-2.302.646-2.697h-.01z" fill="#FF9900"/>
      </svg>
    ),
    azure: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path d="M13.05 4.24L6.56 18.05c-.18.39-.52.67-.94.77L3.77 19.2c-.44.1-.78-.32-.6-.74L9.7 4.24c.17-.39.55-.65.98-.65h1.38c.41 0 .77.26.92.65h.07z" fill="#0078D4"/>
        <path d="M20.23 17.02l-5.17-9.1c-.13-.24-.39-.39-.67-.39h-1.3c-.15 0-.29.06-.4.15l-4.26 7.49 5.76 4.25c.28.2.65.23.96.08l4.78-2.07c.18-.08.31-.24.36-.43l.02-.09c.01-.01.01-.02.01-.03-.04.06-.08.11-.09.14z" fill="#0078D4"/>
        <path d="M14.39 7.53l-.11-.2a.67.67 0 0 0-.59-.35h-1.3c-.15 0-.29.06-.4.15L8.44 15.17l5.76 4.25c.28.2.65.23.96.08l-.05-.02L9.35 15.4l5.04-7.87z" fill="url(#azure-gradient)"/>
        <defs>
          <linearGradient id="azure-gradient" x1="9.39" y1="8.96" x2="13.61" y2="18.36" gradientUnits="userSpaceOnUse">
            <stop stopColor="#114A8B"/>
            <stop offset="1" stopColor="#0669BC"/>
          </linearGradient>
        </defs>
      </svg>
    ),
    gcp: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path d="M12.67 5.09l2.45-2.45.13-.28c-3.09-2.17-7.33-1.82-10.02 1.05-1.06 1.14-1.77 2.53-2.09 4l.23-.03 4.89-.81s.25-.4.38-.38c1.05-1.16 2.61-1.71 4.03-1.1z" fill="#EA4335"/>
        <path d="M19.76 7.41c-.52-1.93-1.6-3.66-3.08-4.97l-3.56 3.56c1.39.78 2.38 2.14 2.62 3.73l4.02-2.32z" fill="#4285F4"/>
        <path d="M5.19 15.63l-2.32 4.03c2.47 2.16 5.77 3.11 9.02 2.56 1.21-.21 2.38-.6 3.45-1.18l-3.56-3.57c-1.13.48-2.41.52-3.57.12-.81-.28-1.55-.75-2.17-1.37l-.85-.59z" fill="#34A853"/>
        <path d="M5.19 15.63c-1.11-1.57-1.48-3.55-.96-5.41l-4.05 2.34c-.86 2.85-.33 5.99 1.45 8.36l3.56-3.56v-1.73z" fill="#FBBC05"/>
        <path d="M15.74 9.73c.43 1.61.1 3.35-.91 4.71l3.56 3.57c1.99-2.34 2.77-5.5 2.12-8.53l-4.77.25z" fill="#4285F4"/>
      </svg>
    ),
    oracle: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path d="M7.5 7.5C5.01 7.5 3 9.51 3 12s2.01 4.5 4.5 4.5h9c2.49 0 4.5-2.01 4.5-4.5s-2.01-4.5-4.5-4.5h-9zm9 7.2h-9c-1.49 0-2.7-1.21-2.7-2.7s1.21-2.7 2.7-2.7h9c1.49 0 2.7 1.21 2.7 2.7s-1.21 2.7-2.7 2.7z" fill="#F80000"/>
      </svg>
    ),
    alibaba: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path d="M21.96 12.73c-.11.35-.36.63-.69.78l-7.54 3.43a2.9 2.9 0 0 1-2.46 0l-7.54-3.43a1.26 1.26 0 0 1-.69-.78c-.1-.35-.05-.73.15-1.03l3.23-4.93c.46-.71 1.25-1.13 2.1-1.13h7.97c.84 0 1.63.42 2.1 1.13l3.22 4.93c.2.3.26.68.15 1.03z" fill="#FF6A00"/>
        <path d="M12 17.37a2.9 2.9 0 0 1-1.23-.27l-7.54-3.43a1.26 1.26 0 0 1-.69-.78c-.1-.35-.05-.73.15-1.03l.35-.54v5.7c0 .49.4.89.89.89h16.14c.49 0 .89-.4.89-.89v-5.7l.35.54c.2.3.26.68.15 1.03-.11.35-.36.63-.69.78l-7.54 3.43c-.39.18-.82.27-1.23.27z" fill="#FF6A00" opacity="0.8"/>
      </svg>
    )
  };

  return icons[provider] || null;
};

const ContactPage: React.FC<ContactPageProps> = ({ preSelectedCity }) => {
  const { locations: adminLocations } = useAdmin();
  
  const [cloudDropdownOpen, setCloudDropdownOpen] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    phone: '',
    location: preSelectedCity || '',
    portSpeed: '',
    bandwidth: '',
    serviceType: 'ip-transit',
    department: 'sales' as 'sales' | 'services',
    language: 'english',
    message: '',
    privacyConsent: false,
    marketingConsent: false,
    // New fields for dynamic sales form
    cloudProvider: '',
    cloudRegion: '',
    datacenterFrom: '',
    datacenterTo: '',
    rackSize: '',
    powerRequirement: '',
    asn: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });

  // Contact information - fetched from API
  const [contactInfo, setContactInfo] = useState<{
    sales: ContactInfo;
    services: ContactInfo;
  }>({
    sales: { phone: '+1 (555) 100-2000', email: 'sales@mx-ix.com' },
    services: { phone: '+1 (555) 100-3000', email: 'support@mx-ix.com' }
  });

  // Fetch contacts from API on mount
  useEffect(() => {
    document.body.classList.add('dark-nav');
    return () => document.body.classList.remove('dark-nav');
  }, []);

  useEffect(() => {
    const fetchContacts = async () => {
      try {
        const response = await contactsApi.getAll();
        if (response.success && response.data) {
          // Backend now guarantees lowercase department names
          const salesContact = response.data.find(c => c.department === 'sales');
          const supportContact = response.data.find(c => c.department === 'support');
          
          setContactInfo({
            sales: salesContact 
              ? { phone: salesContact.phone, email: salesContact.email }
              : { phone: '+1 (555) 100-2000', email: 'sales@mx-ix.com' },
            services: supportContact 
              ? { phone: supportContact.phone, email: supportContact.email }
              : { phone: '+1 (555) 100-3000', email: 'support@mx-ix.com' }
          });
        }
      } catch (error) {
        console.error('Failed to fetch contacts:', error);
      }
    };
    fetchContacts();
  }, []);

  // Get current contact info based on selection
  const getCurrentContact = () => {
    return contactInfo[formData.department];
  };

  // Service types for Sales form
  const serviceTypes = [
    { value: 'ip-transit', label: 'IP Transit' },
    { value: 'cloud', label: 'Cloud Connect' },
    { value: 'dci', label: 'Data Center Interconnect (DCI)' },
    { value: 'colocation', label: 'Colocation' },
    { value: 'peering', label: 'Network Peering' }
  ];

  const cloudProviders = [
    { value: 'aws', label: 'Amazon Web Services' },
    { value: 'azure', label: 'Microsoft Azure' },
    { value: 'gcp', label: 'Google Cloud' },
    { value: 'oracle', label: 'Oracle Cloud' },
    { value: 'alibaba', label: 'Alibaba Cloud' }
  ];

  const cloudRegions = [
    { value: 'ap-south-1', label: 'Asia Pacific (Mumbai)' },
    { value: 'ap-southeast-1', label: 'Asia Pacific (Singapore)' },
    { value: 'ap-northeast-1', label: 'Asia Pacific (Tokyo)' },
    { value: 'eu-west-1', label: 'Europe (Ireland)' },
    { value: 'eu-central-1', label: 'Europe (Frankfurt)' },
    { value: 'us-east-1', label: 'US East (Virginia)' },
    { value: 'me-south-1', label: 'Middle East (UAE)' }
  ];

  // Get port speeds from selected location (dynamic based on admin panel)
  const getPortSpeedsForLocation = (locationId: string) => {
    const location = adminLocations.find(l => l.id === locationId);
    return location?.portSpeeds || ['1G', '10G', '40G', '100G', '400G']; // Fallback to default
  };
  
  const rackSizes = ['Quarter Rack', 'Half Rack', 'Full Rack', 'Multiple Racks'];
  
  const powerOptions = ['2 kW', '4 kW', '8 kW', '12 kW', '20 kW', 'Custom'];

  // Get datacenters for selected location - for DCI "From" and "To" dropdowns
  const getDatacentersForLocation = (locationId: string) => {
    const location = adminLocations.find(l => l.id === locationId);
    return location?.enabledSites || [];
  };


  useEffect(() => {
    if (preSelectedCity) {
      setFormData(prev => ({ ...prev, location: preSelectedCity }));
    }
  }, [preSelectedCity]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus({ type: null, message: '' });

    try {
      const res = await contactsApi.submit(formData);
      if (!res.success) throw new Error(res.error || 'Submission failed');

      setSubmitStatus({
        type: 'success',
        message: 'Thank you! Your request has been submitted successfully. Our team will contact you within 24 hours.'
      });

      setFormData({
        name: '',
        email: '',
        company: '',
        phone: '',
        location: '',
        portSpeed: '',
        bandwidth: '',
        serviceType: 'ip-transit',
        department: 'sales' as 'sales' | 'services',
        language: 'english',
        message: '',
        privacyConsent: false,
        marketingConsent: false,
        cloudProvider: '',
        cloudRegion: '',
        datacenterFrom: '',
        datacenterTo: '',
        rackSize: '',
        powerRequirement: '',
        asn: ''
      });

      setTimeout(() => {
        setSubmitStatus({ type: null, message: '' });
      }, 10000);

    } catch (error: any) {
      console.error('Contact submission failed:', error);

      setSubmitStatus({
        type: 'error',
        message: `Failed to send your request. Please try again or contact us directly at ${getCurrentContact().email}.`
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.checked
    });
  };

  return (
    <div className="min-h-screen bg-white text-ink">
      {/* Hero */}
      <section className="relative bg-ink text-white overflow-hidden pt-36 md:pt-44 pb-16">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-[#F20732]/15 blur-[120px]" />
        <div className="max-w-[1400px] mx-auto px-6 md:px-12 relative z-10">
          <span className="eyebrow">Get Started</span>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter leading-[0.95] mt-4 mb-6">
            REQUEST A <span className="text-[#F20732]">PORT</span>
          </h1>
          <p className="text-gray-500 text-base md:text-lg leading-relaxed max-w-2xl border-l-2 border-white/10 pl-6">
            Join the MX-IX peering ecosystem. Tell us about your network and our team will follow up
            within 24 hours with port availability, pricing and the details you need to get connected.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-white/10 border border-white/10 mt-12">
            {[
              { v: '24h', l: 'Response time' },
              { v: '1G–400G', l: 'Port speeds' },
              { v: 'AS141539', l: 'Our ASN' },
              { v: '$0', l: 'Traffic fees' },
            ].map((s) => (
              <div key={s.l} className="bg-ink p-5">
                <div className="text-2xl md:text-3xl font-light tracking-tighter">{s.v}</div>
                <div className="font-mono text-label-sm tracking-label uppercase text-gray-500 mt-1">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="max-w-[1400px] mx-auto px-6 md:px-12 py-12 md:py-16 relative z-10">
        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Form - Takes 2 columns */}
          <div className="lg:col-span-2">
            <div className="bg-white border border-gray-200 p-6 md:p-8 lg:p-12 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-[#F20732]"></div>

              <span className="eyebrow">Port Request</span>
              <h2 className="text-2xl md:text-3xl font-black tracking-tighter mt-2 mb-2 text-ink">
                Tell us about your network
              </h2>
              <p className="text-sm text-gray-500 mb-8">Fill in the details below and our team will get back to you within 24 hours.</p>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Contact Preferences */}
                <div>
                  <label className="block font-mono text-label-sm tracking-label uppercase text-gray-500 mb-2">I want to talk to *</label>
                  <div className="grid grid-cols-2 gap-px bg-gray-200 border border-gray-200">
                    {([['sales', 'Sales'], ['services', 'Tech Support']] as const).map(([v, lbl]) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setFormData({ ...formData, department: v })}
                        className={`flex items-center justify-center gap-2 px-4 py-3.5 font-mono text-label-sm font-bold tracking-mono uppercase transition-colors hover-trigger ${formData.department === v ? 'bg-ink text-white' : 'bg-white text-gray-500 hover:text-ink'}`}
                      >
                        {v === 'sales' ? <Briefcase className="w-4 h-4" /> : <Wrench className="w-4 h-4" />}
                        {lbl}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Personal Information - Always Shown */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="name" className="block font-mono text-label-sm tracking-label uppercase text-gray-500 mb-2">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-3 bg-white border border-gray-300 focus:border-[#F20732] outline-none transition-colors font-mono text-sm text-ink"
                      placeholder="John Doe"
                    />
                  </div>

                  <div>
                    <label htmlFor="email" className="block font-mono text-label-sm tracking-label uppercase text-gray-500 mb-2">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-3 bg-white border border-gray-300 focus:border-[#F20732] outline-none transition-colors font-mono text-sm text-ink"
                      placeholder="john@company.com"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="company" className="block font-mono text-label-sm tracking-label uppercase text-gray-500 mb-2">
                      Company *
                    </label>
                    <input
                      type="text"
                      id="company"
                      name="company"
                      value={formData.company}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-3 bg-white border border-gray-300 focus:border-[#F20732] outline-none transition-colors font-mono text-sm text-ink"
                      placeholder="Your Company"
                    />
                  </div>

                  <div>
                    <label htmlFor="phone" className="block font-mono text-label-sm tracking-label uppercase text-gray-500 mb-2">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      className="w-full px-4 py-3 bg-white border border-gray-300 focus:border-[#F20732] outline-none transition-colors font-mono text-sm text-ink"
                      placeholder="+91 98765 43210"
                    />
                  </div>
                </div>


                {/* Additional Requirements / Message */}
                <div>
                  <label htmlFor="message" className="block font-mono text-label-sm tracking-label uppercase text-gray-500 mb-2">
                    Additional Requirements
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    rows={5}
                    className="w-full px-4 py-3 bg-white border border-gray-300 focus:border-[#F20732] outline-none transition-colors font-mono text-sm resize-none text-ink"
                    placeholder="Tell us about your specific network requirements, redundancy needs, or any other details..."
                  />
                </div>

                {/* Privacy Consent Checkboxes */}
                <div className="border-t-2 border-gray-100 pt-6 space-y-4">
                  {/* Required Privacy Policy Consent */}
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      id="privacyConsent"
                      name="privacyConsent"
                      checked={formData.privacyConsent}
                      onChange={handleCheckboxChange}
                      required
                      className="mt-1 w-4 h-4 text-black border-2 border-gray-300 rounded focus:ring-black focus:ring-2"
                    />
                    <label htmlFor="privacyConsent" className="text-xs text-gray-700 leading-relaxed">
                      <span className="font-bold text-black">I consent to MX-IX retaining my personal contact data</span> for the purpose of processing my enquiry according to the{' '}
                      <a
                        href="/privacy"
                        onClick={(e) => { e.preventDefault(); window.history.pushState({}, '', '/privacy'); window.dispatchEvent(new PopStateEvent('popstate')); }}
                        className="text-[#F20732] hover:text-black underline font-medium hover-trigger"
                      >Privacy Policy</a> for MX-IX Members and Prospective Members. *
                    </label>
                  </div>

                  {/* Optional Marketing Consent */}
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      id="marketingConsent"
                      name="marketingConsent"
                      checked={formData.marketingConsent}
                      onChange={handleCheckboxChange}
                      className="mt-1 w-4 h-4 text-black border-2 border-gray-300 rounded focus:ring-black focus:ring-2"
                    />
                    <label htmlFor="marketingConsent" className="text-xs text-gray-700 leading-relaxed">
                      I consent to MX-IX retaining my personal contact data for the purpose of sending me other information it believes may be relevant and of interest to me.
                    </label>
                  </div>
                </div>

                {submitStatus.type && (
                  <div className={`p-4 border-2 ${
                    submitStatus.type === 'success' 
                      ? 'bg-green-50 border-green-500 text-green-800' 
                      : 'bg-red-50 border-red-500 text-red-800'
                  } animate-fadeIn`}>
                    <div className="flex items-start gap-3">
                      {submitStatus.type === 'success' ? (
                        <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" strokeWidth={2.5} />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" strokeWidth={2.5} />
                      )}
                      <div>
                        <p className="font-bold text-sm mb-1">
                          {submitStatus.type === 'success' ? 'Success!' : 'Error'}
                        </p>
                        <p className="text-sm leading-relaxed">{submitStatus.message}</p>
                      </div>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`w-full px-8 py-5 font-mono text-xs font-bold uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-3 group shadow-lg ${
                    isSubmitting
                      ? 'bg-gray-400 cursor-wait'
                      : 'bg-[#F20732] hover:bg-ink cursor-pointer'
                  } text-white`}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2.5} />
                      Sending...
                    </>
                  ) : (
                    <>
                      Submit Request
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" strokeWidth={2.5} />
                    </>
                  )}
                </button>

                <p className="text-xs text-gray-500 font-mono text-center">
                  * Required field. By submitting this form, you confirm your consent to our data processing practices.
                </p>
              </form>
            </div>
          </div>

          {/* Sidebar Info - Takes 1 column */}
          <div className="space-y-6">
            {/* Quick Response Badge */}
            <div className="bg-ink text-white p-8 relative overflow-hidden">
              <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-[#F20732]/15 blur-[90px] pointer-events-none"></div>
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="relative flex items-center">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <div className="w-2 h-2 bg-green-500 rounded-full absolute animate-ping"></div>
                  </div>
                  <span className="font-mono text-xs font-bold tracking-wider text-green-400 uppercase">
                    Fast Response
                  </span>
                </div>
                <h3 className="text-2xl font-black tracking-tighter mb-3">24 Hour SLA</h3>
                <p className="text-gray-300 leading-relaxed text-sm">
                  Our team responds to all port requests within 24 hours. Urgent requests? Call us directly.
                </p>
              </div>
            </div>

            {/* What Happens Next */}
            <div className="bg-white border border-gray-200 p-8">
              <h3 className="text-xl font-black tracking-tighter mb-6 text-black">What Happens Next?</h3>
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-[#F20732] text-white flex items-center justify-center font-mono text-sm font-bold">
                    1
                  </div>
                  <div>
                    <p className="text-sm font-bold text-black mb-1">Initial Review</p>
                    <p className="text-xs text-gray-600">We review your requirements within 24 hours</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-[#F20732] text-white flex items-center justify-center font-mono text-sm font-bold">
                    2
                  </div>
                  <div>
                    <p className="text-sm font-bold text-black mb-1">Technical Consultation</p>
                    <p className="text-xs text-gray-600">Our engineers discuss your setup</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-[#F20732] text-white flex items-center justify-center font-mono text-sm font-bold">
                    3
                  </div>
                  <div>
                    <p className="text-sm font-bold text-black mb-1">Custom Quote</p>
                    <p className="text-xs text-gray-600">Receive detailed pricing and terms</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-[#F20732] text-white flex items-center justify-center font-mono text-sm font-bold">
                    4
                  </div>
                  <div>
                    <p className="text-sm font-bold text-black mb-1">Deployment</p>
                    <p className="text-xs text-gray-600">Go live in as little as 48 hours</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Contact Info - Dynamic based on selection */}
            <div className="bg-ink text-white p-8 relative overflow-hidden">
              <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-[#F20732]/15 blur-[90px] pointer-events-none"></div>
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-black tracking-tighter">Need Help?</h3>
                  <div className="flex items-center gap-2">
                    <div className="relative flex items-center">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <div className="w-2 h-2 bg-green-500 rounded-full absolute animate-ping"></div>
                    </div>
                  </div>
                </div>

                {/* Both departments shown together */}
                <div className="space-y-6">
                  {([
                    { key: 'sales', label: 'Sales Team', info: contactInfo.sales, Icon: Briefcase },
                    { key: 'services', label: 'Tech Support', info: contactInfo.services, Icon: Wrench },
                  ] as const).map(({ key, label, info, Icon }) => (
                    <div key={key} className="pb-5 border-b border-white/10 last:border-b-0 last:pb-0">
                      <div className="inline-flex items-center gap-2 bg-[#F20732]/10 border border-[#F20732]/30 px-3 py-1.5 rounded-full mb-4">
                        <Icon className="w-4 h-4 text-[#F20732]" strokeWidth={2.5} />
                        <span className="font-mono text-xs font-bold tracking-widest uppercase text-[#F20732]">{label}</span>
                      </div>
                      <div className="space-y-3 text-sm">
                        <div>
                          <p className="font-mono text-[10px] text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-2">
                            <span className="w-1 h-1 bg-[#F20732] rounded-full"></span>Email
                          </p>
                          <a href={`mailto:${info.email}`} className="text-white hover:text-[#F20732] transition-colors font-medium block pl-3 border-l-2 border-white/10 hover:border-[#F20732] break-all">
                            {info.email}
                          </a>
                        </div>
                        <div>
                          <p className="font-mono text-[10px] text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-2">
                            <span className="w-1 h-1 bg-[#F20732] rounded-full"></span>Phone
                          </p>
                          <a href={`tel:${info.phone.replace(/[^+\d]/g, '')}`} className="text-white hover:text-[#F20732] transition-colors font-medium block pl-3 border-l-2 border-white/10 hover:border-[#F20732] font-mono text-lg">
                            {info.phone}
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactPage;
