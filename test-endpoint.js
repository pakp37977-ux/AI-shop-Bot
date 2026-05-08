async function run() {
  const req = await fetch("http://localhost:3000/api/generate-image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productName: "Apple", category: "Fruit" })
  });
  console.log(req.status);
  const text = await req.text();
  console.log(text.slice(0, 100)); // only log beginning in case of huge base64
}
run();
