import { HfInference } from "@huggingface/inference";
async function run() {
  const hf = new HfInference(process.env.HUGGINGFACE_TOKEN);
  try {
    const res = await hf.textToImage({
      model: "stabilityai/stable-diffusion-xl-base-1.0",
      inputs: "test"
    });
    console.log(typeof res, res.constructor.name);
  } catch (e) {
  }
}
run();
