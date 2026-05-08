import React from 'react';
import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { Copy, ExternalLink, Activity, DollarSign, Package } from 'lucide-react';

export default function DashboardHome() {
  const [shopSlug, setShopSlug] = useState('');
  const [stats, setStats] = useState({ orders: 0, sales: 0, products: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      const user = auth.currentUser;
      if (!user) return;

      try {
        // Get Shop Data
        const shopSnap = await getDoc(doc(db, 'shops', user.uid));
        if (shopSnap.exists()) {
          setShopSlug(shopSnap.data().slug);
        }

        const shopId = user.uid;

        // Get Products 
        const productsQ = query(collection(db, 'products'), where('shop_id', '==', shopId));
        const productsSnap = await getDocs(productsQ);

        // Get Orders
        const ordersQ = query(collection(db, 'orders'), where('shop_id', '==', shopId));
        const ordersSnap = await getDocs(ordersQ);

        let totalSales = 0;
        let totalOrders = 0;

        ordersSnap.forEach(doc => {
          totalOrders++;
          totalSales += doc.data().total_amount || 0;
        });

        setStats({
          orders: totalOrders,
          sales: totalSales,
          products: productsSnap.size
        });
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const [copyMsg, setCopyMsg] = useState('');

  const shopUrl = `${window.location.origin}/shop/${shopSlug}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shopUrl);
    setCopyMsg('Copied!');
    setTimeout(() => setCopyMsg(''), 2000);
  };

  if (loading) return <div className="p-8">Loading dashboard...</div>;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Dashboard Overview</h1>
        <p className="text-gray-500">Welcome back! Here's what's happening at your shop today.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard icon={<Package className="w-6 h-6 text-blue-500" />} title="Total Orders" value={stats.orders} />
        <StatCard icon={<DollarSign className="w-6 h-6 text-green-500" />} title="Total Sales" value={`Rs. ${stats.sales}`} />
        <StatCard icon={<Activity className="w-6 h-6 text-indigo-500" />} title="Active Products" value={stats.products} />
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Shop Bot Link</h2>
        <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-lg flex-wrap">
          <input 
            type="text" 
            readOnly 
            value={shopUrl} 
            className="flex-1 bg-transparent border-none outline-none text-gray-600 min-w-[200px]"
          />
          <div className="flex gap-2">
            <button 
              onClick={copyToClipboard}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 relative"
            >
              <Copy className="w-4 h-4" /> {copyMsg || 'Copy'}
            </button>
            <a 
              href={shopUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-green-600 border border-green-600 rounded-md text-sm font-medium text-white hover:bg-green-700"
            >
              <ExternalLink className="w-4 h-4" /> Order
            </a>
          </div>
        </div>
        <p className="mt-3 text-sm text-gray-500">Share this link directly on your WhatsApp status, Instagram, or Facebook.</p>
      </div>
    </div>
  );
}

function StatCard({ icon, title, value }: { icon: React.ReactNode, title: string, value: string | number }) {
  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
      <div className="p-4 bg-gray-50 rounded-full">{icon}</div>
      <div>
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  )
}
