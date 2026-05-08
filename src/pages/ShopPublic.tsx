import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Store, MessageCircle } from 'lucide-react';
import ChatBot from '../components/ChatBot';

export default function ShopPublic() {
  const { slug } = useParams();
  const [shop, setShop] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [chatbotOpen, setChatbotOpen] = useState(false);

  useEffect(() => {
    const fetchShopAndProducts = async () => {
      try {
        // Fetch Shop (Public Read)
        const shopQ = query(collection(db, 'shops'), where('slug', '==', slug));
        const shopSnap = await getDocs(shopQ);
        
        if (shopSnap.empty) {
          setLoading(false);
          return;
        }

        const shopData = { id: shopSnap.docs[0].id, ...shopSnap.docs[0].data() };
        setShop(shopData);

        // Fetch Products (Public Read for Active)
        const prodQ = query(collection(db, 'products'), where('shop_id', '==', shopData.id), where('is_active', '==', true));
        const prodSnap = await getDocs(prodQ);
        const prodData = prodSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        setProducts(prodData);

      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    if (slug) fetchShopAndProducts();
  }, [slug]);

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading shop...</div>;
  if (!shop) return <div className="min-h-screen flex items-center justify-center text-2xl font-bold">Shop not found.</div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-24 font-sans">
      <header className="bg-white border-b px-4 py-8 shadow-sm flex flex-col items-center">
        {shop.logo_url ? (
          <img src={shop.logo_url} alt={shop.shop_name} className="w-24 h-24 rounded-full object-cover mb-4 shadow-sm border border-gray-100" />
        ) : (
          <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
            <Store className="w-10 h-10" />
          </div>
        )}
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight text-center">{shop.shop_name}</h1>
        {shop.is_open ? (
          <span className="mt-2 inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">We are Open</span>
        ) : (
          <span className="mt-2 inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">Closed Currently</span>
        )}
        <a 
          href={`https://wa.me/${shop.owner_whatsapp}?text=Hi%2C%20I%20want%20to%20order`}
          target="_blank"
          rel="noreferrer"
          className="mt-6 flex items-center gap-2 bg-green-500 text-white px-6 py-2 rounded-full font-medium hover:bg-green-600 shadow-md"
        >
          <MessageCircle className="w-5 h-5" /> Owner WhatsApp
        </a>
      </header>

      <main className="max-w-5xl mx-auto p-4 mt-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6 px-2">Menu ITEMS</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {products.map(p => (
            <div key={p.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col cursor-pointer hover:shadow-md transition-shadow" onClick={() => setChatbotOpen(true)}>
              {p.image_url ? (
                 <img src={p.image_url} alt={p.name} className="w-full h-48 object-cover" />
              ) : (
                 <div className="w-full h-48 bg-gray-100 flex items-center justify-center">
                    <Store className="w-10 h-10 text-gray-400" />
                 </div>
              )}
              <div className="p-4 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-lg text-gray-900">{p.name}</h3>
                  <p className="text-sm text-gray-500 mt-1">{p.category}</p>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <span className="font-bold text-green-600 tracking-tight">
                    {p.variants?.length ? `${p.variants[0].split(':')[1]} - ${p.variants[p.variants.length-1].split(':')[1]}` : `Rs. ${p.price}`}
                  </span>
                  <button className="text-sm bg-green-50 text-green-700 px-3 py-1 rounded-full font-medium hover:bg-green-100">Order</button>
                </div>
              </div>
            </div>
          ))}
          {products.length === 0 && (
            <div className="col-span-full py-12 text-center text-gray-500">No items on the menu yet.</div>
          )}
        </div>
      </main>

      {/* Floating Chat Button */}
      <button 
        onClick={() => setChatbotOpen(true)}
        className="fixed bottom-6 right-6 w-16 h-16 bg-green-600 text-white rounded-full shadow-2xl flex items-center justify-center hover:bg-green-700 hover:scale-105 transition-transform z-40"
      >
        <MessageCircle className="w-8 h-8" />
      </button>

      {/* Chat Bot Overlay */}
      {chatbotOpen && (
        <ChatBot shop={shop} products={products} onClose={() => setChatbotOpen(false)} />
      )}
    </div>
  );
}
