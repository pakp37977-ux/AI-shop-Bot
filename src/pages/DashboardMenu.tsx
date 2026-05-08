import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, uploadString, getDownloadURL } from 'firebase/storage';
import { auth, db, storage, handleFirestoreError, OperationType } from '../lib/firebase';
import { Plus, Image as ImageIcon, Edit2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

export default function DashboardMenu() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('');
  const [variantsStr, setVariantsStr] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [imagePreview, setImagePreview] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [savingStatus, setSavingStatus] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      if (!auth.currentUser) return;
      const q = query(collection(db, 'products'), where('shop_id', '==', auth.currentUser.uid));
      const snap = await getDocs(q);
      const prds = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setProducts(prds);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'products');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateAI = async () => {
    if (!name) {
      console.warn("Product Name required");
      return;
    }
    setIsGenerating(true);
    try {
      const res = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productName: name, category })
      });
      const data = await res.json();
      if (data.imageUrl) {
        setImageUrl(data.imageUrl);
        setImagePreview(data.imageUrl);
        setImageFile(null);
      } else {
        console.error(data.error || "AI image generation failed");
      }
    } catch (err) {
      console.error("Failed to connect to AI generator", err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if(!file || !auth.currentUser) return;
    setErrorMsg('');
    setSuccessMsg('');
    try {
       const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME?.replace(/['"]/g, '').trim();
       const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET?.replace(/['"]/g, '').trim();
       if (!cloudName || !uploadPreset) {
         setErrorMsg("Cloudinary configuration missing in .env file");
         return;
       }

       const formData = new FormData();
       formData.append('file', file);
       formData.append('upload_preset', uploadPreset);

       const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
         method: 'POST',
         body: formData
       });
       const data = await res.json();
       
       if (data.secure_url) {
         setImageUrl(data.secure_url);
         setImagePreview(data.secure_url);
         setImageFile(null);
       } else {
         console.error("Cloudinary Error:", data);
         setErrorMsg(`Upload failed: ${data.error?.message || "Unknown error"} (Cloud: ${cloudName}, Preset: ${uploadPreset})`);
       }
    } catch (error) {
       console.error("Upload error", error);
       setErrorMsg("Failed to upload image.");
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    const user = auth.currentUser;
    if (!user) {
      setErrorMsg("Please login first.");
      return;
    }
    setSavingStatus('Starting...');
    
    try {
      const productId = uuidv4();
      let finalImageUrl = imageUrl;

      if (finalImageUrl && finalImageUrl.startsWith('data:image')) {
        setSavingStatus('Compressing AI Image...');
        // Canvas compression is stable on mobile and reduces the 4MB payload to ~100KB
        const compressedBlob = await new Promise<Blob>((resolve, reject) => {
          const img = new window.Image();
          img.onload = () => {
             const canvas = document.createElement('canvas');
             const ctx = canvas.getContext('2d');
             // ...
             let width = img.width;
             let height = img.height;
             const MAX = 800;
             if (width > height && width > MAX) {
                height *= MAX / width;
                width = MAX;
             } else if (height > MAX) {
                width *= MAX / height;
                height = MAX;
             }
             canvas.width = width;
             canvas.height = height;
             if(ctx) {
                ctx.fillStyle = "white";
                ctx.fillRect(0,0,width,height);
                ctx.drawImage(img, 0, 0, width, height);
             }
             canvas.toBlob((blob) => {
                if (blob) resolve(blob);
                else reject(new Error('Canvas to blob failed'));
             }, 'image/jpeg', 0.8);
          }
          img.onerror = reject;
          img.src = finalImageUrl;
        });
        
        setSavingStatus('Uploading AI Image to Cloudinary...');
        
        const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME?.replace(/['"]/g, '').trim();
        const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET?.replace(/['"]/g, '').trim();
        if (!cloudName || !uploadPreset) {
          throw new Error("Cloudinary configuration missing in .env file");
        }

        const formData = new FormData();
        formData.append('file', compressedBlob);
        formData.append('upload_preset', uploadPreset);

        const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
          method: 'POST',
          body: formData
        });
        const data = await res.json();
        
        if (data.secure_url) {
          finalImageUrl = data.secure_url;
        } else {
          throw new Error(`Cloudinary Upload Error: ${data.error?.message || "Unknown error"} (Cloud: ${cloudName}, Preset: ${uploadPreset})`);
        }
      } else if (!finalImageUrl && imageFile) {
        setSavingStatus('Uploading Image to Cloudinary...');
        
        const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME?.replace(/['"]/g, '').trim();
        const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET?.replace(/['"]/g, '').trim();
        if (!cloudName || !uploadPreset) {
          throw new Error("Cloudinary configuration missing in .env file");
        }

        const formData = new FormData();
        formData.append('file', imageFile);
        formData.append('upload_preset', uploadPreset);

        const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
          method: 'POST',
          body: formData
        });
        const data = await res.json();
        
        if (data.secure_url) {
          finalImageUrl = data.secure_url;
        } else {
          throw new Error(`Cloudinary Upload Error: ${data.error?.message || "Unknown error"} (Cloud: ${cloudName}, Preset: ${uploadPreset})`);
        }
      }

      setSavingStatus('Saving to Database...');
      const productData = {
        shopId: user.uid,
        shop_id: user.uid, // Keep for backward compatibility with rules
        name,
        price: Number(price),
        image_url: finalImageUrl,
        category,
        variants: variantsStr ? variantsStr.split(',').map(v => v.trim()) : [],
        is_active: isActive,
        status: isActive ? 'active' : 'inactive',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'products', productId), productData);
      
      setSavingStatus('Done!');
      // Reset
      setIsAdding(false);
      setName('');
      setPrice('');
      setCategory('');
      setVariantsStr('');
      setImageFile(null);
      setImageUrl('');
      setImagePreview('');
      setIsActive(true);
      fetchProducts();
      setSuccessMsg('Product saved successfully!');
    } catch (error: any) {
      console.error("Save error:", error);
      setErrorMsg("Failed to save product: " + error.message);
    } finally {
      setSavingStatus(null);
    }
  };

  const toggleStatus = async (product: any) => {
    try {
      await updateDoc(doc(db, 'products', product.id), {
        is_active: !product.is_active,
        updatedAt: new Date().toISOString()
      });
      fetchProducts();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `products/${product.id}`);
    }
  };

  const handleDelete = async (productId: string) => {
    try {
      await deleteDoc(doc(db, 'products', productId));
      fetchProducts();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `products/${productId}`);
    }
  };

  if (loading) return <div className="p-8">Loading menu...</div>;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Menu Items</h1>
          <p className="text-gray-500">Manage your products and variants.</p>
        </div>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md font-medium hover:bg-green-700"
        >
          <Plus className="w-4 h-4" /> Add Product
        </button>
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

      {isAdding && (
        <form onSubmit={handleSaveProduct} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Product Name</label>
            <input type="text" required className="w-full px-4 py-2 border rounded-md" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Base Price (Rs.)</label>
            <input type="number" required className="w-full px-4 py-2 border rounded-md" value={price} onChange={e => setPrice(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <input type="text" className="w-full px-4 py-2 border rounded-md" value={category} onChange={e => setCategory(e.target.value)} placeholder="e.g. Fast Food" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Variants (Optional)</label>
            <input type="text" className="w-full px-4 py-2 border rounded-md" value={variantsStr} onChange={e => setVariantsStr(e.target.value)} placeholder="e.g. Half:200, Full:350" />
          </div>
          <div className="md:col-span-2 flex items-start gap-6">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Product Image</label>
              <div className="flex flex-col gap-2">
                <input type="file" accept="image/*" className="w-full text-sm" onChange={handleFileUpload} />
                <button type="button" onClick={handleGenerateAI} disabled={isGenerating} className="flex items-center justify-center py-2 px-4 border border-indigo-200 text-indigo-600 bg-indigo-50 rounded font-medium hover:bg-indigo-100 disabled:opacity-50 text-sm w-fit">
                  {isGenerating ? "Generating..." : "✨ Generate with AI"}
                </button>
              </div>
              {imagePreview && (
                 <div className="mt-4">
                    <img src={imagePreview} className="w-32 h-32 object-cover rounded shadow-sm border border-gray-200" alt="Preview" />
                 </div>
              )}
            </div>
            <div className="flex items-center gap-2 pt-6 flex-1">
              <input type="checkbox" id="isActive" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="w-4 h-4 text-green-600" />
              <label htmlFor="isActive" className="text-sm font-medium text-gray-700">Available to Order</label>
            </div>
          </div>
          <div className="md:col-span-2 pt-4">
            <button type="submit" disabled={savingStatus !== null} className="bg-green-600 text-white px-6 py-2 rounded-md font-medium hover:bg-green-700 disabled:opacity-50 min-w-[150px]">
              {savingStatus !== null ? savingStatus : 'Save Product'}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100 text-sm font-medium text-gray-500">
              <th className="p-4">Image</th>
              <th className="p-4">Name</th>
              <th className="p-4">Category</th>
              <th className="p-4">Price / Variants</th>
              <th className="p-4">Status</th>
              <th className="p-4">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {products.map(p => (
              <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                <td className="p-4">
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.name} className="w-12 h-12 rounded object-cover" />
                  ) : (
                    <div className="w-12 h-12 bg-gray-100 flex items-center justify-center rounded text-gray-400"><ImageIcon className="w-6 h-6" /></div>
                  )}
                </td>
                <td className="p-4 font-medium text-gray-900">{p.name}</td>
                <td className="p-4 text-sm text-gray-600">{p.category || '-'}</td>
                <td className="p-4 text-sm text-gray-600">
                  {p.variants?.length ? p.variants.join(' | ') : `Rs. ${p.price}`}
                </td>
                <td className="p-4">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${p.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                    {p.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="p-4">
                  <button onClick={() => toggleStatus(p)} className="text-sm font-medium text-indigo-600 hover:text-indigo-900 mr-2">Toggle</button>
                  <button onClick={() => handleDelete(p.id)} className="text-sm font-medium text-red-600 hover:text-red-900">Delete</button>
                </td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-gray-500">No products found. Add one to get started!</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
