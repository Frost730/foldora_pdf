import React from 'react';

export const TermsPage: React.FC = () => {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
      <div className="space-y-2 border-b border-[#e3e3dc] pb-6">
        <h1 className="text-3xl font-black text-[#12151c] tracking-tight">Terms of Service</h1>
        <p className="text-xs text-[#64748b]">Last updated: October 2026</p>
      </div>

      <div className="space-y-6 text-xs sm:text-sm text-[#475569] leading-relaxed">
        <section className="space-y-2">
          <h2 className="text-base font-bold text-[#12151c]">1. Service Description</h2>
          <p>
            Foldora PDF provides automated document manipulation, conversion, and organization utilities. The service is provided "as is" for lawful, personal, and professional document processing tasks.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-[#12151c]">2. Fair Use Limits</h2>
          <p>
            To ensure reliable availability for all users on our shared cloud infrastructure, uploads are bounded to 50 MB per file and 20 files per operation. Automated scraping, malicious payload injection, and denial-of-service attempts will result in automated IP rate-limiting.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-[#12151c]">3. Electronic Signatures Disclaimer</h2>
          <p>
            The visual signature tool adds an electronic visual mark to your documents. It does not constitute a certificate-backed cryptographic digital signature under eIDAS or ESIGN regulations unless combined with your organization's compliance key infrastructure.
          </p>
        </section>
      </div>
    </div>
  );
};
