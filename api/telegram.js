export default async function handler(req, res) {
  const BOT_TOKEN = process.env.BOT_TOKEN;
  const ADMIN_CHAT_ID = String(process.env.ADMIN_CHAT_ID);
  const KV_URL = process.env.KV_REST_API_URL;
  const KV_TOKEN = process.env.KV_REST_API_TOKEN;

  if (!BOT_TOKEN || !ADMIN_CHAT_ID || !KV_URL || !KV_TOKEN) {
    return res.status(500).json({ error: "Config manquante" });
  }

  const update = req.body;

  /* 🔹 Quand un client clique START */
  if (update.message && update.message.text?.startsWith("/start")) {
    const chatId = String(update.message.chat.id);
    const parts = update.message.text.split(" ");
    const clientId = parts[1]; // /start CLIENTID

    if (clientId) {
      await fetch(`${KV_URL}/set/client:${clientId}/${chatId}`, {
        headers: { Authorization: `Bearer ${KV_TOKEN}` }
      });

      await sendTelegram(
        BOT_TOKEN,
        chatId,
        "✅ Suivi activé ! Tu peux revenir sur le site et commander."
      );
    }
  }

  /* 🔹 Quand TOI tu cliques sur ✅ Fait */
  if (update.callback_query) {
    const fromId = String(update.callback_query.message.chat.id);
    const data = update.callback_query.data;

    if (fromId !== ADMIN_CHAT_ID) {
      return res.json({ ok: true });
    }

    if (data.startsWith("done:")) {
      const orderId = data.replace("done:", "");

      // Retirer la commande de la file
      await fetch(`${KV_URL}/lrem/queue/0/${orderId}`, {
        headers: { Authorization: `Bearer ${KV_TOKEN}` }
      });

      // Recalculer la file
      const q = await fetch(`${KV_URL}/lrange/queue/0/-1`, {
        headers: { Authorization: `Bearer ${KV_TOKEN}` }
      }).then(r => r.json());

      const queue = q.result || [];

      // Prévenir les clients
      for (let i = 0; i < queue.length; i++) {
        const oid = queue[i];
        const order = await fetch(`${KV_URL}/get/order:${oid}`, {
          headers: { Authorization: `Bearer ${KV_TOKEN}` }
        }).then(r => r.json());

        if (!order?.result) continue;

        const clientId = order.result.clientId;
        const chat = await fetch(`${KV_URL}/get/client:${clientId}`, {
          headers: { Authorization: `Bearer ${KV_TOKEN}` }
        }).then(r => r.json());

        if (chat?.result) {
          await sendTelegram(
            BOT_TOKEN,
            chat.result,
            `⏳ Mise à jour : tu es maintenant ${i + 1}ᵉ sur la liste d’attente.`
          );
        }
      }

      await answerCallback(BOT_TOKEN, update.callback_query.id);
    }
  }

  res.json({ ok: true });
}

/* Helpers */
async function sendTelegram(token, chatId, text, buttons = null) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      reply_markup: buttons
    })
  });
}

async function answerCallback(token, id) {
  await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: id })
  });
}
