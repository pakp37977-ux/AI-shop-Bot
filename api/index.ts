import express from "express";
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import Groq from "groq-sdk";
import { HfInference } from "@huggingface/inference";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Constants
const PORT = process.env.PORT || 3000;

// Initialize Express
const app = express();
app.use(express.json());

// Debug logging
app.use((req, res, next) => {
  console.log(`[API LOG] ${req.method} ${req.url}`);
  next();
});

// Load config safely
let firebaseConfig: any = {};
try {
  const configPath = path.resolve(__dirname, '../firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } else {
    console.warn("firebase-applet-config.json not found at", configPath);
  }
} catch (e) {
  console.error("Error loading firebase config:", e);
}

// Initialize Firebase
let db: any;
if (firebaseConfig && firebaseConfig.projectId) {
  try {
    const firebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);
  } catch (e) {
    console.error("Firebase initialization failed:", e);
  }
}

// Helper to get API Key robustly
const getApiKey = (prefix: string) => {
  let key = process.env[`${prefix}_API_KEY`] || process.env[`VITE_${prefix}_API_KEY`] || process.env[prefix];
  
  // Fallback to searching all env keys
  if (!key || key === "AI Studio Free Tier") {
    for (const [k, v] of Object.entries(process.env)) {
      if (k.toUpperCase().includes(prefix.toUpperCase()) && v && v !== "AI Studio Free Tier") {
        key = v as string;
        break;
      }
    }
  }

  if (key) {
    key = key.replace(/["']/g, '').trim();
  }
  return (key && key !== "AI Studio Free Tier" && key !== "undefined") ? key : null;
};

const router = express.Router();

// Health check
router.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    configLoaded: !!firebaseConfig.projectId,
    dbInited: !!db,
    env: {
      has_groq: !!getApiKey('GROQ'),
      has_hf: !!getApiKey('HUGGINGFACE') || !!getApiKey('HF')
    }
  });
});

// AI Image Generation
router.post("/generate-image", async (req, res) => {
  try {
    const { productName, category } = req.body;
    const token = getApiKey('HUGGINGFACE') || getApiKey('HF');

    if (!token) {
      return res.status(500).json({ error: "HuggingFace Token is missing. Please set HUGGINGFACE_TOKEN in settings." });
    }

    const hf = new HfInference(token);
    const prompt = `Hyper-realistic, high-quality professional product food photography of ${productName} ${category ? "in " + category : ""}. appetizing, studio lighting, bokeh background.`;
    
    // Use FLUX.1-schnell which is usually more accessible for free tokens
    const model = 'black-forest-labs/FLUX.1-schnell';
    
    const imageBlob = await hf.textToImage({
      model: model,
      inputs: prompt,
      parameters: {
        negative_prompt: 'deformed, blurry, bad anatomy, text, watermark, low quality',
      }
    });

    const imageBuffer = await (imageBlob as unknown as Blob).arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString('base64');
    res.json({ imageUrl: `data:image/jpeg;base64,${base64Image}` });
  } catch (err: any) {
    console.error("Image Generation Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Chat Bot
router.post("/chat", async (req, res) => {
  try {
    console.log("Chat request received");
    const { message, history, shop, products: providedProducts } = req.body;
    const apiKey = getApiKey('GROQ');

    if (!apiKey) {
      console.error("Groq key missing");
      return res.status(500).json({ error: "Groq API Key is missing. Please set GROQ_API_KEY in settings." });
    }

    const groq = new Groq({ apiKey });

    // Try to get fresh products if not provided
    let products = providedProducts || [];
    if (products.length === 0 && shop?.id && db) {
      try {
        console.log("Fetching fresh products from Firebase");
        const prodSnap = await getDocs(query(collection(db, 'products'), where('shop_id', '==', shop.id), where('is_active', '==', true)));
        products = prodSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      } catch (e) {
        console.error("Firebase Fetch Error:", e);
      }
    }

    const productMenu = products.map((p: any) => `- ${p.name}: Rs. ${p.base_price || p.price} ${p.image_url ? '[IMAGE:'+p.image_url+']' : ''}`).join('\n');
    
    console.log("Constructing system prompt");
    const systemPrompt = `Aap Shan Bhai hain, "${shop?.shop_name}" ke maalik (owner).
Aap AI nahi hain, Pakistani shopkeeper hain.

Rules (FAALTO BAAT NAHI KAREN, PROFESSIONAL RAHEN):
1. Sirf Roman Urdu mein baat karain.
2. Tone: Professional shopkeeper. Casual words jaise "yaar", "bhai", "Jinga Lala" ka istemal SAKHT MANA HAI. Hamesha "Sir" keh kar mukhatib karain.
3. Greeting: Sirf "Assalam-o-Alaikum", "Walaikum Assalam", ya "Salaam" ka istemal karain. Namaste ya koi aur aisi greeting KABHI NAHI use karni.
4. "Assalam-o-Alaikum" aur "Walaikum Assalam" ke spelling aur tareeqay ka khaas khayal rakhain.
5. First greeting: "Assalam-o-Alaikum Sir, aap kya order karein ge?"
6. Agar koi "Hi" ya "Hello" bole: "Sir aap kya order kerna chahte hain? Chicken, Biryani, Pizza, Burger ya kuch aur?"
7. Payment Options: Sirf ye batayein: "Payment options: JazzCash, Easypaisa, Bank Transfer, COD. Aap kaise pay karein ge?"
8. Naam aur delivery address poochain agar order confirm karna hai.
9. Product mention karte waqt "[IMAGE:url]" lazmi lagain.
10. Order final ho toh "finalize_order" tool call karain.

Shop Details:
- JazzCash: ${shop?.jazzcash_number}
- Delivery Charges: Rs. ${shop?.delivery_charges || 0}

Menu:
${productMenu || 'Filhal menu mein kuch nahi hai.'}
`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...(history || []).map((m: any) => ({ role: m.role === 'model' ? 'assistant' : 'user', content: m.text })),
      { role: "user", content: message }
    ];

    console.log("Sending request to Groq");
    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages,
      temperature: 0.7, // Personality ke liye temperature barha diya
      tools: [{
        type: 'function',
        function: {
          name: 'finalize_order',
          description: 'Call when customer confirms details.',
          parameters: {
            type: 'object',
            properties: {
              customer_name: { type: 'string' },
              phone: { type: 'string' },
              address: { type: 'string' },
              items_json: { type: 'string' },
              total_amount: { type: 'number' }
            },
            required: ['customer_name', 'phone', 'address', 'items_json', 'total_amount']
          }
        }
      }]
    });
    console.log("Groq responded");

    const response = completion.choices[0].message;
    let functionCallsResult = null;

    if (response.tool_calls) {
      functionCallsResult = response.tool_calls.map(tc => ({
        name: tc.function.name,
        args: JSON.parse(tc.function.arguments)
      }));
    }

    res.json({ text: response.content || "", functionCalls: functionCallsResult });
  } catch (err: any) {
    console.error("Chat Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Mount router under both to handle direct hits and prefixed hits
app.use("/api", router);
app.use("/", router);

export default app;
