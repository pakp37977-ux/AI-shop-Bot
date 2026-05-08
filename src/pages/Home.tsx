import React from 'react';
import { Link } from 'react-router-dom';
import { Store, MessageCircle, Zap } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between sticky top-0 z-10 w-full">
        <div className="flex items-center gap-2">
          <Store className="w-8 h-8 text-green-600" />
          <span className="text-xl font-bold text-gray-900 tracking-tight">DesiBot Shop</span>
        </div>
        <div className="flex gap-4">
          <Link to="/login" className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900">Login</Link>
          <Link to="/signup" className="px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-md hover:bg-green-700 shadow-sm transition-colors">Create Your Shop</Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center text-center px-4 py-20 max-w-5xl mx-auto w-full">
        <h1 className="text-5xl font-extrabold text-gray-900 tracking-tight leading-tight mb-6 sm:text-6xl">
          Automate your WhatsApp <br className="hidden sm:block" />
          orders with AI.
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mb-10 leading-relaxed">
          Create a blazing fast digital menu and let our Roman Urdu speaking AI assistant take orders, collect payments via JazzCash, and notify you instantly on WhatsApp. No login required for your customers.
        </p>

        <Link to="/signup" className="px-8 py-4 text-lg font-semibold bg-green-600 text-white rounded-full hover:bg-green-700 shadow-md transition-all flex items-center gap-2">
          <Zap className="w-5 h-5" /> Let's Start Earning
        </Link>
        
        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8 w-full">
          <FeatureCard 
            icon={<MessageCircle className="w-8 h-8 text-green-500" />}
            title="Desi AI Assistant"
            desc="Understands Roman Urdu and chats naturally like a desi shopkeeper."
          />
          <FeatureCard 
            icon={<Store className="w-8 h-8 text-indigo-500" />}
            title="Frictionless Shop"
            desc="100% public catalog link. Customers browse and chat without any login blocks."
          />
          <FeatureCard 
            icon={<Zap className="w-8 h-8 text-amber-500" />}
            title="Instant WhatsApp Alerts"
            desc="Get full order details directly on your personal WhatsApp. No complex APIs."
          />
        </div>
      </main>
      <footer className="bg-white border-t py-8 text-center text-gray-500 text-sm">
        &copy; {new Date().getFullYear()} DesiBot Shop. Fiverr Ready.
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center text-center">
      <div className="mb-4 p-4 bg-gray-50 rounded-full">{icon}</div>
      <h3 className="text-xl font-semibold text-gray-900 mb-2 tracking-tight">{title}</h3>
      <p className="text-gray-600 leading-relaxed">{desc}</p>
    </div>
  )
}
