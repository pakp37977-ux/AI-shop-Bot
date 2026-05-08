import express from "express";
import { createServer as createViteServer } from "vite";
import Groq from "groq-sdk";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "./src/lib/firebase";
import { HfInference } from "@huggingface/inference";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API route for AI Image generation (using HuggingFace)
  app.post("/api/generate-image", async (req, res) => {
    try {
      const { productName, category } = req.body;
      let token = process.env.HUGGINGFACE_TOKEN;
      
      for (const [key, value] of Object.entries(process.env)) {
        if (key.toLowerCase().includes('huggingface') && value && value !== "AI Studio Free Tier") {
          token = value;
          break;
        }
      }
      
      if (token) {
        token = token.replace(/["']/g, '').trim();
      }
      
      if (!token || token === "AI Studio Free Tier") {
        return res.status(500).json({ error: "Missing HUGGINGFACE_TOKEN in Secrets" });
      }

      const hf = new HfInference(token);
      const prompt = `Professional food photography of ${productName}, ${category || 'Pakistani cuisine'}, on white ceramic plate, restaurant studio lighting, appetizing, highly detailed, 8k, no text`;

      const imageBlob = await hf.textToImage({
        model: "stabilityai/stable-diffusion-xl-base-1.0",
        inputs: prompt,
        parameters: {
          negative_prompt: "blurry, low quality, text, logo, watermark",
          num_inference_steps: 25,
          guidance_scale: 7.5
        }
      });

      // HF returns image as blob, convert to base64
      const imageBuffer = await (imageBlob as unknown as Blob).arrayBuffer();
      const buffer = Buffer.from(imageBuffer);
      const base64Image = `data:image/png;base64,${buffer.toString('base64')}`;

      res.json({ imageUrl: base64Image });
    } catch (err: any) {
      console.error("AI Image Generation Error:", err);
      res.status(500).json({ error: err.message || "Image generation failed" });
    }
  });

  // API route for Chat (using Groq)
  app.post("/api/chat", async (req, res) => {
    let apiKey = process.env.GROQ_API_KEY;
    try {
      
      // Look through all environment variables for a valid groq key
      for (const [key, value] of Object.entries(process.env)) {
        if (key.toLowerCase().includes('groq') && value && value !== "AI Studio Free Tier") {
          apiKey = value;
          break;
        }
      }

      if (apiKey) {
         apiKey = apiKey.replace(/["']/g, '').trim();
      }
      if (!apiKey || apiKey === "AI Studio Free Tier") {
        return res.status(500).json({ error: "Server missing valid GROQ_API_KEY. Please add it to Secrets." });
      }

      console.log("Groq apiKey length:", apiKey.length, "starts with:", apiKey.substring(0, 4));

      const { message, history, shop } = req.body;
      
      let products = [];
      if (shop?.id) {
         try {
           const prodQ = query(collection(db, 'products'), where('shop_id', '==', shop.id), where('is_active', '==', true));
           const prodSnap = await getDocs(prodQ);
           products = prodSnap.docs.map(d => ({ id: d.id, ...d.data() }));
         } catch (e) {
           console.error("Error fetching secure products menu:", e);
         }
      }

      const groq = new Groq({ apiKey });

      const systemPrompt = `You are a desi shop assistant for "${shop.shop_name}".
Respond ONLY in Roman Urdu. Keep replies very short, friendly, and desi.
Your job is to take food orders. If they ask what's available, tell them the menu.
Delivery Charges: Rs. ${shop.delivery_charges}

Real Menu: ${JSON.stringify(products)}.
Only sell these items from the Real Menu. Never make up prices or items. If customer asks for something not in the menu, say 'Maazrat ye nahi hai'.
When showing the menu to the user, include the product images if they exist using the format: [IMAGE: url] before the item name. 
Example: 
Ye raha menu:
[IMAGE: url1] 1. Pizza - 577
[IMAGE: url2] 2. Biryani - 300

Once they finalize the order, ask for their Name, Phone number, and Address. 
When you have all 3 details (name, phone, address) AND their final items, call the 'finalize_order' function with the data. 
NEVER ask for payment yourself, the function call handles that UI.`;

      // Transform history for Groq sdk
      const formattedHistory = (history || []).map((msg: any) => ({
        role: msg.role === 'model' ? 'assistant' : 'user',
        content: msg.text || ""
      }));

      const completion = await groq.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: systemPrompt },
          ...formattedHistory,
          { role: 'user', content: message }
        ],
        temperature: 0.2,
        tools: [{
          type: "function",
          function: {
            name: "finalize_order",
            description: "Call this ONLY when the user has provided their Name, Phone, Address, and finalized the items they want to order.",
            parameters: {
              type: "object",
              properties: {
                customer_name: { type: "string" },
                phone: { type: "string" },
                address: { type: "string" },
                items_json: { type: "string", description: "A summary string of items ordered" },
                total_amount: { type: "number", description: "Total price of items PLUS delivery charges" }
              },
              required: ["customer_name", "phone", "address", "items_json", "total_amount"]
            }
          }
        }],
        tool_choice: "auto",
        max_tokens: 500
      });
      
      const messageObj = completion.choices[0]?.message;
      let functionCallsResult = null;

      if (messageObj?.tool_calls && messageObj.tool_calls.length > 0) {
         const tc = messageObj.tool_calls[0].function;
         if (tc.name === 'finalize_order') {
            try {
               const args = JSON.parse(tc.arguments);
               functionCallsResult = [{
                 name: tc.name,
                 args: args
               }];
            } catch (e) {
               console.error("Error parsing tool arguments", e);
            }
         }
      }

      res.json({
        text: messageObj?.content || "",
        functionCalls: functionCallsResult
      });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: `Groq API Error: ` + err.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const path = await import("path");
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
