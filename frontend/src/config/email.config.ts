// EmailJS Configuration
// Update these values when client provides their email addresses

export const emailConfig = {
  // EmailJS credentials - Configured from EmailJS dashboard
  serviceId: 'service_f07wt5t',
  templateId: 'template_52hmv39',
  publicKey: 'kEYj9uhpMzOhM8NGy',
  
  // Recipient email addresses - Update these when client provides them
  recipients: {
    sales: 'sales@mx-ix.com',
    services: 'support@mx-ix.com',
  },
  
  // Email template configuration
  fromName: 'MX-IX Contact Form',
  replyTo: '', // This will be set to the user's email dynamically
};

// Email template parameter builder
export const buildEmailParams = (formData: any, recipientEmail?: string) => {
  return {
    // Sender Info
    from_name: formData.name,
    from_email: formData.email,
    from_company: formData.company,
    from_phone: formData.phone || 'Not provided',
    
    // Department & Language
    department: formData.department === 'sales' ? 'Sales Team' : 'Tech Support',
    language: formData.language,
    
    // Service Details (if applicable)
    location: formData.location || 'Not specified',
    service_type: formData.serviceType || 'N/A',
    port_speed: formData.portSpeed || 'Not specified',
    bandwidth: formData.bandwidth || 'Not specified',
    
    // Message
    message: formData.message || 'No additional requirements specified',
    
    // Consents
    privacy_consent: formData.privacyConsent ? 'Yes' : 'No',
    marketing_consent: formData.marketingConsent ? 'Yes' : 'No',
    
    // Recipient (dynamic: use provided email, otherwise fallback to config)
    to_email: recipientEmail || (formData.department === 'sales' 
      ? emailConfig.recipients.sales 
      : emailConfig.recipients.services),
    
    // Submission timestamp
    submission_date: new Date().toLocaleString('en-US', {
      dateStyle: 'full',
      timeStyle: 'long'
    }),
  };
};
