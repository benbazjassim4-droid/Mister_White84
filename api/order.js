function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

async function tgSend(token, chatId, text) {
  // Message simple (pas besoin de Markdown)
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text })
  });
}

export default async function handler(req, res) {
  setCors(res);

  // ✅ Pré-requête navigateur
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const { clientId, items, address, snap, total } = req.body || {};

  if (!clientId) return res.status(400).json({ ok:false, error: "clientId manquant" });
  if (!items || items.length === 0) return res.status(400).json({ ok:false, error: "panier vide" });
  if (!address) return res.status(400).json({ ok:false, error: "adresse manquante" });

  const KV_URL = process.env.KV_REST_API_URL;
  const KV_TOKEN = process.env.KV_REST_API_TOKEN;
  const BOT_TOKEN = process.env.BOT_TOKEN;

  if (!KV_URL || !KV_TOKEN) {
    return res.status(500).json({ ok:false, error: "KV non configuré" });
  }
  if (!BOT_TOKEN) {
    return res.status(500).json({ ok:false, error: "BOT_TOKEN manquant dans Vercel" });
  }

  const orderId = Date.now().toString();

  // 1) Ajouter dans la file
  await fetch(`${KV_URL}/rpush/queue/${orderId}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` }
  });

  // 2) Taille de la file = position
  const sizeRes = await fetch(`${KV_URL}/llen/queue`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` }
  });
  const sizeData = await sizeRes.json();
  const position = sizeData.result;

  // 3) Sauvegarde de la commande
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
      snap: snap || "",
      total: Number(total) || 0,
      createdAt: Date.now()
    })
  });

  // 4) Récupérer le chatId du client (s’il a fait Start)
  const chatRes = await fetch(`${KV_URL}/get/client:${clientId}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` }
  });
  const chatData = await chatRes.json();
  const clientChatId = chatData?.result;

  // 5) Envoyer message au client
  if (clientChatId) {
    const msg =
      `✅ Commande reçue !\n` +
      `Tu es actuellement ${position}ᵉ sur la liste d’attente.\n\n` +
      `Merci 🙂`;

    // on essaie d'envoyer (si Telegram refuse, on ne bloque pas la commande)
    try { await tgSend(BOT_TOKEN, clientChatId, msg); } catch(e) {}
  }

  return res.status(200).json({ ok: true, position, orderId, clientNotified: !!clientChatId });
}
