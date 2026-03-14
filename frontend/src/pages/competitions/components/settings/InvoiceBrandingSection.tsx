import { useState, useRef, useEffect } from 'react';
import { Competition, InvoiceBranding } from '../../../../types';
import Section from './Section';

interface InvoiceBrandingSectionProps {
  comp: Competition;
  savedMap: Record<string, boolean>;
  saveField: (field: string, value: unknown, section: string) => void;
}

const LOGO_MAX_WIDTH = 400;
const LOGO_MAX_HEIGHT = 120;

function resizeImage(file: File, maxW: number, maxH: number): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxW || height > maxH) {
          const ratio = Math.min(maxW / width, maxH / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, width, height);
        const mimeType = file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png';
        const dataUrl = canvas.toDataURL(mimeType, 0.9);
        const base64 = dataUrl.split(',')[1];
        resolve({ base64, mimeType });
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

const InvoiceBrandingSection = ({ comp, savedMap, saveField }: InvoiceBrandingSectionProps) => {
  const serverBranding = comp.invoiceBranding || {};
  const [draft, setDraft] = useState<InvoiceBranding>(serverBranding);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  // Sync draft when server data changes (e.g. after save)
  useEffect(() => {
    setDraft(comp.invoiceBranding || {});
  }, [comp.invoiceBranding]);

  const isDirty = JSON.stringify(draft) !== JSON.stringify(serverBranding);

  const handleSave = () => {
    saveField('invoiceBranding', draft, 'branding');
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setUploadError('Please upload a PNG, JPEG, or WebP image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Image must be under 5MB.');
      return;
    }

    setUploading(true);
    setUploadError('');
    try {
      const { base64, mimeType } = await resizeImage(file, LOGO_MAX_WIDTH, LOGO_MAX_HEIGHT);
      setDraft(prev => ({ ...prev, logoBase64: base64, logoMimeType: mimeType }));
    } catch {
      setUploadError('Failed to process image.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeLogo = () => {
    const updated = { ...draft };
    delete updated.logoBase64;
    delete updated.logoMimeType;
    setDraft(updated);
  };

  const logoSrc = draft.logoBase64 && draft.logoMimeType
    ? `data:${draft.logoMimeType};base64,${draft.logoBase64}`
    : null;

  const inputCls = "w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500";

  return (
    <Section title="Invoice Branding" defaultOpen={false} savedKey="branding" savedMap={savedMap}>
      <p className="text-sm text-gray-500 mb-4">
        Customize the header of generated invoice PDFs with your business name, logo, and contact information.
      </p>

      {/* Logo Upload */}
      <div className="mb-5">
        <label className="block text-sm font-semibold text-gray-600 mb-2">Logo</label>
        {logoSrc ? (
          <div className="flex items-start gap-4 mb-2">
            <div className="border border-gray-200 rounded p-2 bg-white">
              <img src={logoSrc} alt="Invoice logo" style={{ maxWidth: 200, maxHeight: 80 }} />
            </div>
            <div className="flex flex-col gap-1.5">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 text-xs border border-gray-300 rounded bg-white cursor-pointer text-gray-600 hover:bg-gray-50"
              >
                Replace
              </button>
              <button
                onClick={removeLogo}
                className="px-3 py-1.5 text-xs border border-gray-300 rounded bg-white cursor-pointer text-red-500 hover:bg-red-50"
              >
                Remove
              </button>
            </div>
          </div>
        ) : (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-primary-400 hover:bg-primary-50 transition-colors mb-2"
          >
            <div className="text-gray-400 text-sm">Click to upload a logo</div>
            <div className="text-gray-400 text-xs mt-1">PNG, JPEG, or WebP. Max 5MB.</div>
            <div className="text-gray-400 text-xs">Will be resized to fit {LOGO_MAX_WIDTH}x{LOGO_MAX_HEIGHT}px</div>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={handleLogoUpload}
          className="hidden"
        />
        {uploading && <div className="text-xs text-primary-500 mt-1">Processing...</div>}
        {uploadError && <div className="text-xs text-red-500 mt-1">{uploadError}</div>}
      </div>

      {/* Business Name */}
      <div className="mb-4">
        <label className="block text-sm font-semibold text-gray-600 mb-1">Business Name</label>
        <input
          type="text"
          value={draft.businessName || ''}
          onChange={e => setDraft(prev => ({ ...prev, businessName: e.target.value || undefined }))}
          placeholder="e.g. DanceSport Productions"
          className={inputCls + ' max-w-md'}
        />
        <small className="text-gray-500 text-xs mt-1 block">
          Replaces "INVOICE" as the main header. The competition name still appears below.
        </small>
      </div>

      {/* Tagline */}
      <div className="mb-4">
        <label className="block text-sm font-semibold text-gray-600 mb-1">Tagline</label>
        <input
          type="text"
          value={draft.tagline || ''}
          onChange={e => setDraft(prev => ({ ...prev, tagline: e.target.value || undefined }))}
          placeholder="e.g. Premier Ballroom Competition Events"
          className={inputCls + ' max-w-md'}
        />
      </div>

      {/* Contact Info */}
      <div className="mb-1">
        <label className="block text-sm font-semibold text-gray-600 mb-2">Contact Information</label>
        <small className="text-gray-500 text-xs block mb-3">
          Displayed in the top-right corner of the invoice.
        </small>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-xl mb-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Email</label>
          <input
            type="email"
            value={draft.email || ''}
            onChange={e => setDraft(prev => ({ ...prev, email: e.target.value || undefined }))}
            placeholder="billing@example.com"
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Phone</label>
          <input
            type="tel"
            value={draft.phone || ''}
            onChange={e => setDraft(prev => ({ ...prev, phone: e.target.value || undefined }))}
            placeholder="(555) 123-4567"
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Website</label>
          <input
            type="text"
            value={draft.website || ''}
            onChange={e => setDraft(prev => ({ ...prev, website: e.target.value || undefined }))}
            placeholder="www.example.com"
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Address</label>
          <input
            type="text"
            value={draft.address || ''}
            onChange={e => setDraft(prev => ({ ...prev, address: e.target.value || undefined }))}
            placeholder="123 Main St, City, ST"
            className={inputCls}
          />
        </div>
      </div>

      {/* Save button */}
      {isDirty && (
        <div className="mt-4">
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-primary-500 text-white rounded border-none cursor-pointer text-sm font-medium transition-colors hover:bg-primary-600"
          >
            Save Branding
          </button>
        </div>
      )}

      {/* Preview hint */}
      {(draft.businessName || draft.logoBase64) && !isDirty && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
          Branding configured. Download a PDF invoice from the Invoices page to preview how it looks.
        </div>
      )}
    </Section>
  );
};

export default InvoiceBrandingSection;
