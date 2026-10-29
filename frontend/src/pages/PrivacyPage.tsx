import React from 'react';
import { ShieldCheck, Lock, Trash2, Key } from 'lucide-react';

export const PrivacyPage: React.FC = () => {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
      <div className="space-y-2 border-b border-[#e3e3dc] pb-6">
        <h1 className="text-3xl font-black text-[#12151c] tracking-tight">Privacy Policy</h1>
        <p className="text-xs text-[#64748b]">Last updated: October 2026 · Foldora Zero-Storage Principle</p>
      </div>

      <div className="space-y-6 text-xs sm:text-sm text-[#475569] leading-relaxed">
        <section className="space-y-2">
          <h2 className="text-base font-bold text-[#12151c]">1. Zero Document Retention Guarantee</h2>
          <p>
            Foldora PDF is designed with a strict ephemeral processing model. When you upload a document, it is saved solely in an isolated temporary directory within our ephemeral container filesystem. We do not store, inspect, sell, or index your documents.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-[#12151c]">2. Automated 5-Minute File Purging</h2>
          <p>
            Uploaded files and generated output documents exist only for the duration of the active processing job plus an automated 5-minute grace window allowing you to download the result. Our background scheduler scrubs and deletes expired folders every 30 seconds.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-[#12151c]">3. No Password or Credential Logging</h2>
          <p>
            When utilizing security tools such as <strong>Protect PDF</strong> or <strong>Unlock PDF</strong>, passwords are passed exclusively in-memory to the cryptographic subroutines (AES-256) and are never written to disk, telemetry logs, or application metrics.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-[#12151c]">4. AI Provider Transparency</h2>
          <p>
            For AI-powered tools (PDF Summarizer, Ask Questions, Translate), document text is analyzed using our built-in local extractive engine by default. If an external AI provider is configured via environment variables, data transmission occurs directly via encrypted TLS requests without intermediate third-party broker storage.
          </p>
        </section>
      </div>
    </div>
  );
};
