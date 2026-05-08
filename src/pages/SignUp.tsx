import React from 'react';
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';

export default function SignUp() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [shopName, setShopName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      const slug = shopName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') + '-' + Math.floor(Math.random() * 1000);

      // Create shop document
      await setDoc(doc(db, 'shops', user.uid), {
        owner_id: user.uid,
        shop_name: shopName,
        slug: slug,
        logo_url: '',
        jazzcash_number: '',
        owner_whatsapp: '',
        delivery_charges: 0,
        welcome_msg: 'Aoa! Kya haal hain? Bataien kya order karain ge?',
        is_open: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      navigate('/dashboard/settings');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100 max-w-md w-full">
        <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight text-center mb-6">Create Your Shop</h2>
        {error && <div className="mb-4 bg-red-50 text-red-600 p-3 rounded-md text-sm">{error}</div>}
        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Shop Name</label>
            <input 
              type="text" 
              required 
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500 outline-none" 
              value={shopName} 
              onChange={e => setShopName(e.target.value)} 
              placeholder="e.g. Al-Madina Fast Food"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email (Admin)</label>
            <input 
              type="email" 
              required 
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500 outline-none" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input 
              type="password" 
              required 
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500 outline-none" 
              value={password} 
              onChange={e => setPassword(e.target.value)}
              placeholder="Minimum 6 characters" 
            />
          </div>
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-green-600 text-white font-medium py-3 rounded-md hover:bg-green-700 transition-colors disabled:opacity-70 mt-4"
          >
            {loading ? 'Creating...' : 'Sign Up'}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-gray-600">
          Already have a shop? <Link to="/login" className="text-green-600 font-semibold hover:underline">Login here</Link>
        </p>
      </div>
    </div>
  );
}
