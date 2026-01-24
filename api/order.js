export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { clientId, items, address, snap, total } = req.body || {};

  if (!clientId) return res.status(400).json({ error: "clientId manquant" });
  if (!items || items.length === 0) return res.status(400).json({ error: "panier vide" });
  if (!address) return res.status(400).json({ error: "adresse manquante" });

  const KV_URL = process.env.KV_REST_API_URL;
  const KV_TOKEN = process.env.KV_REST_API_TOKEN;

  if (!KV_URL || !KV_TOKEN) {
    return res.status(500).json({ error: "KV non configuré" });
  }

  // ID commande
  const orderId = Date.now().toString();

  // 1️⃣ Ajouter dans la file
  await fetch(`${KV_URL}/rpush/queue/${orderId}`, {
    headers: {
      Authorization: `Bearer ${KV_TOKEN}`
    }
  });

  // 2️⃣ Taille de la file = position
  const sizeRes = await fetch(`${KV_URL}/llen/queue`, {
    headers: {
      Authorization: `Bearer ${KV_TOKEN}`
    }
  });
  const sizeData = await sizeRes.json();
  const position = sizeData.result;

  // 3️⃣ Sauvegarde de la commande
  await fetch(`${KV_URL}/set/order:${orderId}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KV_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      clientId,
      items,
      address,
      snap,
      total,
      createdAt: Date.now()
    })
  });

  return res.status(200).json({
    ok: true,
    position,
    orderId
  });
}

