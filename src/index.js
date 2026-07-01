import express from "express";
import crypto from "crypto";
import { handleGHLWebhook } from "./webhookHandler.js";

const app = express();
app.use(express.json());

function verifySignature(req) {
  const secret = process.env.GHL_WEBHOOK_SECRET;
  if (!secret) return true;
  const signature = req.headers["x-ghl-signature"] || "";
  const payload = JSON.stringify(req.body);
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

app.get("/", (_req, res) => res.json({ status: "GHL → ClickUp sync running" }));

app.post("/webhook/ghl", async (req, res) => {
  try {
    if (!verifySignature(req)) {
      console.warn("⚠️  Invalid webhook signature");
      return res.status(401).json({ error: "Invalid signature" });
    }
    console.log("📥 GHL event received:", req.body?.type || "unknown");
    const result = await handleGHLWebhook(req.body);
    res.json({ success: true, result });
  } catch (err) {
    console.error("❌ Webhook error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => console.log(`🚀 Listening on port ${PORT}`));
