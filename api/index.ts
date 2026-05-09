import express from "express";
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import Groq from "groq-sdk";
import { HfInference } from "@huggingface/inference";
import firebaseConfig from '../firebase-applet-config.json';

const app = express();
app.use(express.json());

// Initialize Firebase in serverless context safely
let db: any;
try {
  const firebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  db = getFirestore(firebaseApp, (firebaseConfig as any).firestoreDatabaseId);
} catch (e) {
  console.error("Firebase init error in API:", e);
}

const router = express.Router();

// Health check with debugging info
router.get("/health", (req, res) => {
  res.json({ 
    status: "ok", 
    timestamp: new Date().toISOString(),
    env: {
      has_groq: !!(process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY),
      has_hf: !!(process.env.HUGGINGFACE_TOKEN || process.env.VITE_HUGGINGFACE_TOKEN)
    }
  });
});

// API route for AI Image generation
router.post("/generate-image", async (req, res) => {
  try {
    const { productName, category } = req.body;
    let token = process.env.HUGGINGFACE_TOKEN || process.env.VITE_HUGGINGFACE_TOKEN;
    
    // Search for any key containing huggingface if the standard one is missing
    if (!token || token === "AI Studio Free Tier") {
        for (const [key, value] of Object.entries(process.env)) {
            if (key.toLowerCase().includes('huggingface') && value && value !== "AI Studio Free Tier") {
                token = value;
                break;
            }
        }
    }

    if (token) {
        token = token.replace(/["']/g, '').trim();
    }

    if (!token || token === "AI Studio Free Tier" || token === "undefined") {
      return res.status(500).json({ error: "HuggingFace Token is missing." });
    }

    const hf = new HfInference(token);
    const prompt = `Hyper-realistic, high-quality professional product food photography of ${productName} ${category ? "in " + category : ""}. trending on instagram, appetizing, studio lighting, bokeh background.`;
    
    const imageBlob = await hf.textToImage({
      model: 'black-forest-labs/FLUX.1-dev',
      inputs: prompt,
      parameters: {
        negative_prompt: 'deformed, blurry, bad anatomy, text, watermark, low quality',
      }
    });

    const imageBuffer = await (imageBlob as unknown as Blob).arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString('base64');
    const imageUrl = `data:image/jpeg;base64,${base64Image}`;

    res.json({ imageUrl });
  } catch (err: any) {
    console.error("AI Image Generation Error:", err);
    res.status(500).json({ error: "Image generation failed: " + err.message });
  }
});

// API route for Chat (using Groq)
router.post("/chat", async (req, res) => {
  try {
    const { message, history, shop, products: providedProducts } = req.body;
    
    let apiKey = process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY;
    if (!apiKey || apiKey === "AI Studio Free Tier") {
        for (const [key, value] of Object.entries(process.env)) {
            if (key.toLowerCase().includes('groq') && value && value !== "AI Studio Free Tier") {
                apiKey = value;
                break;
            }
        }
    }

    if (apiKey) {
        apiKey = apiKey.replace(/["']/g, '').trim();
    }

    if (!apiKey || apiKey === "AI Studio Free Tier" || apiKey === "undefined") {
      return res.status(500).json({ error: "Groq API Key is missing." });
    }

    const groq = new Groq({ apiKey });

    // Fetch fresh products if needed
    let products = providedProducts || [];
    if (products.length === 0 && shop?.id && db) {
       try {
         const prodQ = query(collection(db, 'products'), where('shop_id', '==', shop.id), where('is_active', '==', true));
         const prodSnap = await getDocs(prodQ);
         products = prodSnap.docs.map(d => ({ id: d.id, ...d.data() }));
       } catch (e) {
         console.error("Firebase fetch error in backend:", e);
       }
    }

    const productMenu = products.map((p: any) => `- ${p.name}: Rs. ${p.price} (ID: ${p.id}) ${p.image_url ? '[IMAGE:'+p.image_url+']' : ''}`).join('\n');
    
    const systemPrompt = `Aap ek helpful Pakistani AI sales assistant hain jiska naam "${shop?.shop_name} Bot" hai. Aap Roman Urdu mein baat karte hain.
      Dukan ki maloomat:
      - Shop Name: ${shop?.shop_name}
      - Category: ${shop?.category}
      - Currency: Rs.
      - JazzCash Number: ${shop?.jazzcash_number}
      - Delivery Charges: Rs. ${shop?.delivery_charges || 0}

      Menu:
      ${productMenu || 'Abhi koi products nahi hain.'}

      Asli (Strict) Rules:
      1. Sirf Roman Urdu mein baat karain.
      2. Menu mein se hi items suggest karain.
      3. Jab client order final karna chahay, "finalize_order" function call karain.
      4. Customer se unka naam aur delivery address zaroor poocha karain.
      5. Jab product ka zikr karain to exactly [IMAGE:url] ko message mein shamil karain agar URL available ho.`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...(history || []).map((m: any) => ({ role: m.role === 'model' ? 'assistant' : 'user', content: m.text })),
      { role: "user", content: message }
    ];

    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages,
      temperature: 0.2,
      tools: [{
        type: 'function',
        function: {
          name: 'finalize_order',
          description: 'Call this when the customer confirms their order, items, address and phone.',
          parameters: {
            type: 'object',
            properties: {
              customer_name: { type: 'string' },
              phone: { type: 'string' },
              address: { type: 'string' },
              items_json: { type: 'string', description: 'List of items and quantities' },
              total_amount: { type: 'number', description: 'Total amount including delivery' }
            },
            required: ['customer_name', 'phone', 'address', 'items_json', 'total_amount']
          }
        }
      }]
    });

    const response = completion.choices[0].message;
    let functionCallsResult = null;

    if (response.tool_calls && response.tool_calls.length > 0) {
       functionCallsResult = response.tool_calls.map(tc => ({
         name: tc.function.name,
         args: JSON.parse(tc.function.arguments)
       }));
    }

    res.json({
      text: response.content || "",
      functionCalls: functionCallsResult
    });
  } catch (err: any) {
    console.error("Groq Chat Error:", err);
    res.status(500).json({ error: "Groq API Error: " + err.message });
  }
});

// Router mounting
app.use("/api", router);
app.use("/", router);

export default app;
