import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Send, Image as ImageIcon, Loader2, CheckCircle2, MessageCircle } from 'lucide-react';
import { collection, doc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, handleFirestoreError, OperationType } from '../lib/firebase';
import { v4 as uuidv4 } from 'uuid';

interface Props {
  shop: any;
  products: any[];
  onClose: () => void;
}

export default function ChatBot({ shop, products, onClose }: Props) {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Payment State
  const [paymentRequired, setPaymentRequired] = useState(false);
  const [orderDetails, setOrderDetails] = useState<any>(null);
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [orderComplete, setOrderComplete] = useState(false);
  const [waLink, setWaLink] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, paymentRequired, orderComplete]);

  useEffect(() => {
    if (!shop.is_open) {
      setMessages([{ role: 'model', text: 'Maazrat dukan band hai. Hum abhi order nahi le saktay.' }]);
      return;
    }
    setMessages([{ role: 'model', text: shop.welcome_msg }]);
  }, [shop, products]);

  const callApi = async (messageContent: any, currentHistory: any[]) => {
    const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            message: messageContent,
            history: currentHistory,
            shop,
            products
        })
    });

    if (!res.ok) {
        let errorMsg = res.statusText || `Error ${res.status}`;
        try {
          const errData = await res.json();
          if (errData.error) errorMsg = errData.error;
        } catch (e) {}
        throw new Error(errorMsg);
    }
    
    return await res.json();
  };

  const sendMessage = async (e?: React.FormEvent, customMessage?: any) => {
    if (e) e.preventDefault();
    
    const userText = customMessage || input;
    if (!userText || !shop.is_open || loading) return;

    if (!customMessage) {
        setInput('');
        setMessages(prev => [...prev, { role: 'user', text: userText }]);
    }
    
    setLoading(true);

    try {
      const historyToSend = messages.filter(m => m.role === 'user' || m.role === 'model');
      const response = await callApi(userText, historyToSend);
      
      if (response.functionCalls && response.functionCalls.length > 0) {
        const call = response.functionCalls[0];
        if (call.name === 'finalize_order') {
          const args = call.args as any;
          setOrderDetails(args);
          setPaymentRequired(true);
          
          setMessages(prev => [...prev, { role: 'model', text: 'Order confirm ho gaya hai! Neechay payment kar dain.', functionCall: true}]);
        }
      } else {
        setMessages(prev => [...prev, { role: 'model', text: response.text }]);
      }
    } catch (err: any) {
      console.error('Chat error details:', err);
      const errorMessage = err.message || 'Dobara try kijiye.';
      
      let desiError = 'Oops, network masla. ' + errorMessage;
      
      if (errorMessage.includes('403') || errorMessage.includes('denied access')) {
         desiError = "Maazrat! Aapki API Key block ho chuki hai (Error 403). Baraye meharbani Groq console se aik Nayi API Key banayein aur Secrets mein paste karain.";
      } else if (errorMessage.includes('API key not valid')) {
         desiError = "API Key galat hai. Secrets mein GROQ_API_KEY theek se dalein.";
      }

      setMessages(prev => [...prev, { role: 'model', text: desiError }]);
    } finally {
      setLoading(false);
    }
  };

  const submitPayment = async () => {
    if (!screenshotFile) {
        alert("Please upload payment screenshot");
        return;
    }
    setUploading(true);
    try {
      const orderId = uuidv4();
      
      const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME?.replace(/['"]/g, '').trim();
      const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET?.replace(/['"]/g, '').trim();
      if (!cloudName || !uploadPreset) {
        throw new Error("Cloudinary configuration missing in .env file");
      }

      const formData = new FormData();
      formData.append('file', screenshotFile);
      formData.append('upload_preset', uploadPreset);

      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      
      let url = "";
      if (data.secure_url) {
        url = data.secure_url;
      } else {
        throw new Error(`Cloudinary Upload Error: ${data.error?.message || "Unknown error"} (Cloud: ${cloudName}, Preset: ${uploadPreset})`);
      }

      // Save to firestore
      await setDoc(doc(db, 'orders', orderId), {
        shop_id: shop.id,
        customer_name: orderDetails.customer_name,
        phone: orderDetails.phone,
        address: orderDetails.address,
        items_json: orderDetails.items_json,
        total_amount: orderDetails.total_amount,
        status: 'pending',
        payment_screenshot: url,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      // Generate WA link
      const waMsg = `*New Order #* ${orderId.substring(0,6)}\n*Items:* ${orderDetails.items_json}\n*Total:* Rs. ${orderDetails.total_amount}\n*Customer:* ${orderDetails.customer_name}\n*Phone:* ${orderDetails.phone}\n*Address:* ${orderDetails.address}`;
      setWaLink(`https://wa.me/${shop.owner_whatsapp}?text=${encodeURIComponent(waMsg)}`);
      
      setOrderComplete(true);
    } catch (err) {
      console.error(err);
      alert('Order save error. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end sm:p-4 bg-black/20 sm:bg-black/40 backdrop-blur-sm sm:items-end font-sans">
      <div className="w-full h-full sm:w-[400px] sm:h-[600px] bg-white sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-5">
        
        {/* Header */}
        <div className="bg-green-600 p-4 flex items-center justify-between text-white shrink-0 shadow-sm relative z-10">
          <div className="flex items-center gap-3">
            {shop.logo_url ? (
              <img src={shop.logo_url} alt="" className="w-10 h-10 rounded-full border-2 border-green-500 object-cover" />
            ) : (
              <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-green-600 font-bold text-xl uppercase">
                {shop.shop_name[0]}
              </div>
            )}
            <div>
              <h3 className="font-bold tracking-tight">{shop.shop_name} Bot</h3>
              <p className="text-xs text-green-100 flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full ${shop.is_open ? 'bg-green-300' : 'bg-red-400'}`}></span>
                {shop.is_open ? 'Online' : 'Offline'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-green-700 rounded-full transition-colors"><X className="w-5 h-5"/></button>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 flex-col flex">
          {messages.map((msg, i) => {
            const parts = msg.text.split(/(\[IMAGE:.*?\])/g);
            return (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${msg.role === 'user' ? 'bg-green-600 text-white rounded-tr-sm shadow-sm' : 'bg-white text-gray-800 border border-gray-100 shadow-sm rounded-tl-sm'}`}>
                  {parts.map((part: string, index: number) => {
                    const match = part.match(/\[IMAGE:(.*?)\]/);
                    if (match && match[1]) {
                      return (
                        <img 
                          key={index} 
                          src={match[1].trim()} 
                          alt="Menu item" 
                          referrerPolicy="no-referrer"
                          className="w-full max-h-32 object-cover rounded-md mt-2 mb-2 shadow-sm border border-gray-100" 
                        />
                      );
                    }
                    return <span key={index} className="whitespace-pre-wrap">{part}</span>;
                  })}
                </div>
              </div>
            );
          })}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-white border p-3 rounded-2xl rounded-tl-sm shadow-sm">
                <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
              </div>
            </div>
          )}

          {/* Payment Modal inside Chat */}
          {paymentRequired && !orderComplete && shop.is_open && (
            <div className="bg-white border rounded-xl p-5 shadow-sm mt-2 flex flex-col items-center animate-in fade-in">
              <h4 className="font-bold text-gray-900 mb-1">Pay via JazzCash</h4>
              <p className="text-sm text-gray-500 mb-4 block text-center">Scan QR or send to: <br/> <strong className="text-gray-900">{shop.jazzcash_number || 'N/A'}</strong></p>
              
              <div className="bg-white p-2 rounded-lg border-2 border-red-500 mb-4 shadow-sm inline-block">
                {/* Always make sure value is valid before rendering QR to avoid crasehs */}
                 <QRCodeSVG value={`jazzcash://${shop.jazzcash_number}?amount=${orderDetails.total_amount}`} size={160} />
              </div>

              <div className="bg-gray-50 w-full p-3 rounded-lg flex items-center justify-between mb-4">
                 <span className="text-sm font-medium text-gray-600">Total:</span>
                 <span className="font-bold text-lg text-gray-900">Rs. {orderDetails.total_amount}</span>
              </div>

              <div className="w-full mb-4">
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2 text-center">Upload Screenshot</label>
                <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 flex flex-col items-center justify-center hover:bg-gray-50 transition-colors relative cursor-pointer">
                   <input type="file" accept="image/*" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={e => setScreenshotFile(e.target.files?.[0] || null)} />
                   {screenshotFile ? (
                      <span className="text-sm font-medium text-green-600 break-all text-center">{screenshotFile.name}</span>
                   ) : (
                      <>
                        <ImageIcon className="w-6 h-6 text-gray-400 mb-1" />
                        <span className="text-sm text-gray-500">Tap to upload</span>
                      </>
                   )}
                </div>
              </div>

              <button 
                onClick={submitPayment} 
                disabled={uploading || !screenshotFile}
                className="w-full bg-red-600 text-white font-medium py-3 rounded-xl shadow-md hover:bg-red-700 transition disabled:opacity-50 flex items-center justify-center"
              >
                {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirm Order'}
              </button>
            </div>
          )}

          {orderComplete && (
            <div className="bg-white border rounded-xl p-5 shadow-sm mt-2 flex flex-col items-center text-center animate-in zoom-in">
              <CheckCircle2 className="w-16 h-16 text-green-500 mb-2" />
              <h4 className="font-bold text-lg text-gray-900 mb-1">Order Placed!</h4>
              <p className="text-sm text-gray-500 mb-6">Your order has been sent to the shop.</p>
              <a 
                href={waLink} 
                target="_blank" 
                rel="noreferrer"
                className="w-full bg-green-500 text-white font-medium py-3 rounded-full hover:bg-green-600 transition flex items-center justify-center gap-2"
              >
                <MessageCircle className="w-5 h-5" /> Notify Shop on WhatsApp
              </a>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-3 bg-white border-t shrink-0 relative z-10">
          <form onSubmit={sendMessage} className="flex items-end gap-2 bg-gray-50 rounded-2xl border border-gray-200 p-1 pl-4 focus-within:border-green-500 focus-within:ring-1 focus-within:ring-green-500 transition-all shadow-sm">
            <input 
              type="text" 
              className="flex-1 bg-transparent py-3 outline-none text-sm text-gray-900"
              placeholder={shop.is_open ? "Type your message..." : "Shop is closed"}
              value={input}
              onChange={e => setInput(e.target.value)}
              disabled={!shop.is_open || paymentRequired || loading}
            />
            <button 
              type="submit" 
              disabled={!input.trim() || !shop.is_open || paymentRequired || loading}
              className="w-10 h-10 flex-shrink-0 bg-green-600 text-white rounded-xl flex items-center justify-center hover:bg-green-700 disabled:opacity-50 disabled:bg-gray-300 disabled:text-gray-500 transition-all mb-0.5 mr-0.5"
            >
              <Send className="w-4 h-4 ml-0.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
