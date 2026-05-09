import React from 'react';
import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage, handleFirestoreError, OperationType } from '../lib/firebase';

export default function DashboardSettings() {
  const [shopName, setShopName] = useState('');
  const [slug, setSlug] = useState('');
  const [jazzcash, setJazzcash] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [delivery, setDelivery] = useState('');
  const [welcomeMsg, setWelcomeMsg] = useState('');
  const [isOpen, setIsOpen] = useState(true);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoUrl, setLogoUrl] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Auto-generate slug from shopName
  const updateSlug = (name: string) => {
    const generatedSlug = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    setSlug(generatedSlug);
  };

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        if (!auth.currentUser) return;
        const shopSnap = await getDoc(doc(db, 'shops', auth.currentUser.uid));
        if (shopSnap.exists()) {
          const d = shopSnap.data();
          setShopName(d.shop_name || '');
          setSlug(d.slug || '');
          setJazzcash(d.jazzcash_number || '');
          setWhatsapp(d.owner_whatsapp || '');
          setDelivery(d.delivery_charges?.toString() || '0');
          setWelcomeMsg(d.welcome_msg || '');
          setIsOpen(d.is_open ?? true);
          setLogoUrl(d.logo_url || '');
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `shops/${auth.currentUser?.uid}`);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    if (!auth.currentUser) return;
    
    if (!shopName || !shopName.trim()) {
      setErrorMsg("Please enter a Shop Name.");
      return;
    }
    if (!slug || !slug.trim()) {
      setErrorMsg("Please add shop name to generate link.");
      return;
    }
    if (!whatsapp || !whatsapp.trim()) {
      setErrorMsg("Please enter your WhatsApp Number.");
      return;
    }
    if (!delivery || delivery === '') {
      setErrorMsg("Please enter Delivery Charges.");
      return;
    }
    if (!welcomeMsg || !welcomeMsg.trim()) {
      setErrorMsg("Please enter a Welcome Message.");
      return;
    }

    setSaving(true);
    
    try {
      let newLogoUrl = logoUrl;
      if (logoFile) {
        const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME?.replace(/['"]/g, '').trim();
        const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET?.replace(/['"]/g, '').trim();
        if (!cloudName || !uploadPreset) {
          throw new Error("Cloudinary configuration missing in .env file");
        }

        const formData = new FormData();
        formData.append('file', logoFile);
        formData.append('upload_preset', uploadPreset);

        const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
          method: 'POST',
          body: formData
        });
        const data = await res.json();
        
        if (data.secure_url) {
          newLogoUrl = data.secure_url;
          setLogoUrl(newLogoUrl);
        } else {
          throw new Error(`Cloudinary Upload Error: ${data.error?.message || "Unknown error"} (Cloud: ${cloudName}, Preset: ${uploadPreset})`);
        }
      }

      await setDoc(doc(db, 'shops', auth.currentUser.uid), {
        shop_name: shopName,
        slug: slug,
        logo_url: newLogoUrl,
        jazzcash_number: jazzcash,
        owner_whatsapp: whatsapp,
        delivery_charges: Number(delivery),
        welcome_msg: welcomeMsg,
        is_open: isOpen,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      setLogoFile(null);
      setSuccessMsg('Settings saved and shop activated successfully!');
    } catch (error: any) {
      try {
        handleFirestoreError(error, OperationType.UPDATE, `shops/${auth.currentUser?.uid}`);
      } catch (err: any) {
        let msg = err.message;
        try {
          const parsed = JSON.parse(msg);
          if (parsed.error) msg = parsed.error;
        } catch (e) {}
        setErrorMsg("Failed to save: " + msg);
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8">Loading settings...</div>;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Shop Settings</h1>
        <p className="text-gray-500">Configure your shop identity and AI bot preferences.</p>
      </div>

      {errorMsg && (
        <div className="mb-6 p-4 bg-red-50 text-red-600 border border-red-200 rounded-md">
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div className="mb-6 p-4 bg-green-50 text-green-600 border border-green-200 rounded-md">
          {successMsg}
        </div>
      )}

      <form onSubmit={handleSave} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-6">
        
        <div className="flex items-center gap-6 pb-6 border-b">
          {(logoFile ? URL.createObjectURL(logoFile) : logoUrl) ? (
            <img src={logoFile ? URL.createObjectURL(logoFile) : logoUrl} alt="Logo" className="w-20 h-20 rounded object-cover" />
          ) : (
            <div className="w-20 h-20 bg-gray-100 rounded flex items-center justify-center text-gray-400 text-sm">No Logo</div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Shop Logo</label>
            <input type="file" accept="image/*" onChange={e => setLogoFile(e.target.files?.[0] || null)} className="text-sm" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Shop Name</label>
            <input type="text" className="w-full px-4 py-2 border rounded-md" value={shopName} onChange={e => { setShopName(e.target.value); if (!slug) updateSlug(e.target.value); }} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Shop URL Slug</label>
            <input type="text" className="w-full px-4 py-2 border rounded-md" value={slug} onChange={e => setSlug(e.target.value)} placeholder="e.g. your-shop-name" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Your WhatsApp Number (Owner)</label>
            <input type="text" className="w-full px-4 py-2 border rounded-md" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="e.g. 923001234567" />
            <p className="text-xs text-gray-500 mt-1">Bot will send order receipts to this number via wa.me</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">JazzCash Mobile Number</label>
            <input type="text" className="w-full px-4 py-2 border rounded-md" value={jazzcash} onChange={e => setJazzcash(e.target.value)} placeholder="e.g. 03001234567" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Charges (Rs.)</label>
            <input type="number" className="w-full px-4 py-2 border rounded-md" value={delivery} onChange={e => setDelivery(e.target.value)} />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Bot Welcome Message</label>
          <textarea rows={2} className="w-full px-4 py-2 border rounded-md outline-none focus:border-green-500" value={welcomeMsg} onChange={e => setWelcomeMsg(e.target.value)} />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <input type="checkbox" id="isOpen" checked={isOpen} onChange={e => setIsOpen(e.target.checked)} className="w-5 h-5 text-green-600 rounded" />
          <label htmlFor="isOpen" className="font-medium text-gray-900">Shop is Open (Accepting Orders)</label>
        </div>

        <div className="pt-4 border-t mt-2">
          <button type="submit" disabled={saving} className="bg-green-600 text-white px-8 py-3 rounded-md font-medium hover:bg-green-700 disabled:opacity-50">
            {saving ? 'Saving...' : 'Save & Activate Shop'}
          </button>
        </div>
      </form>
    </div>
  );
}
