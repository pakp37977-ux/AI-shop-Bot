import React from 'react';
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../lib/firebase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100 max-w-md w-full">
        <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight text-center mb-6">Welcome Back</h2>
        {error && <div className="mb-4 bg-red-50 text-red-600 p-3 rounded-md text-sm">{error}</div>}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input 
              type="email" 
              required 
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500 outline-none" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
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
            />
          </div>
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-green-600 text-white font-medium py-3 rounded-md hover:bg-green-700 transition-colors disabled:opacity-70 mt-4"
          >
            {loading ? 'Logging in...' : 'Log In'}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-gray-600">
          Don't have a shop? <Link to="/signup" className="text-green-600 font-semibold hover:underline">Create one</Link>
        </p>
      </div>
    </div>
  );
}
