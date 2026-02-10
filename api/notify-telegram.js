export default async function handler(req, res) {
  // 1. Logs iniciales para confirmar que ESTE código se ejecuta
  console.log("--- NUEVA PETICIÓN RECIBIDA ---");
  console.log("Headers recibidos:", JSON.stringify(req.headers));

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // 2. Validación de Seguridad
  const API_SECRET = process.env.NOTIFY_SECRET;
  const clientSecret = req.headers['x-api-secret'];

  console.log("Validando: DB_Secret(" + clientSecret + ") vs Vercel_Secret(" + API_SECRET + ")");

  if (!clientSecret || clientSecret !== API_SECRET) {
    console.error("❌ ERROR: Clave secreta incorrecta o no enviada");
    return res.status(401).json({ error: 'No autorizado, las claves no coinciden' });
  }

  try {
    const { type, table, schema, user_email, client_ip, record_id } = req.body;
    
    const hora = new Date().toLocaleString('es-CO', { 
      timeZone: 'America/Bogota',
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });

    const escapeMd = (text) => {
      if (!text) return 'Desconocido';
      return String(text).replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
    };

    const schemaEmojis = {
      'operational': '⚙️', 'raw_voice': '🎙️', 'raw_vision': '👁️',
      'artifacts': '📦', 'reporting': '📊', 'cleansed': '✨'
    };
    const emoji = schemaEmojis[schema] || '🔔';

    let mensaje = `${emoji} *CAMBIO DETECTADO EN ${escapeMd(schema.toUpperCase())}*\n\n`;
    mensaje += `📋 *Tabla:* ${escapeMd(table)}\n`;
    mensaje += `⚡ *Acción:* ${escapeMd(type)}\n`;
    mensaje += `🆔 *ID Registro:* \`${escapeMd(record_id)}\`\n\n`;
    mensaje += `👤 *Usuario:* ${escapeMd(user_email)}\n`; 
    mensaje += `🌐 *IP Origen:* \`${escapeMd(client_ip)}\`\n`;
    mensaje += `⏰ *Hora:* ${escapeMd(hora)}\n`;

    await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: process.env.TELEGRAM_CHAT_ID,
        text: mensaje,
        parse_mode: 'MarkdownV2'
      })
    });

    console.log("✅ Mensaje enviado con éxito");
    return res.status(200).json({ success: true });
    
  } catch (error) {
    console.error("❌ Error interno:", error.message);
    return res.status(500).json({ error: error.message });
  }
}