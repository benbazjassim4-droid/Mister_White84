import { createClient } from "@vercel/kv";

const kv = createClient({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { clientId, items, address, snap, total } = req.body || {};

  if (!clientId) return res.status(400).json({ error: "clientId manquant" });
  if (!items || items.length === 0) return res.status(400).json({ error: "panier vide" });
  if (!address) return res.status(400).json({ error: "adresse manquante" });

  // Crée un ID de commande
  const orderId = Date.now().toString();

  // Ajoute la commande dans la file
  await kv.rpush("queue", orderId);

  // Position = taille de la file (1,2,3...)
  const position = await kv.llen("queue");

  // Sauvegarde le contenu de la commande
  await kv.set(`order:${orderId}`, {
    orderId,
    clientId,
    items,
    address,
    snap,
    total,
    createdAt: Date.now(),
  });

  return res.status(200).json({ ok: true, position, orderId });
}
add order api
