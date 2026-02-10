export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  
  if (req.method === 'OPTIONS') return res.status(200).end();

  // --- SEGURIDAD: Validar Token ---
  const API_SECRET = process.env.NOTIFY_SECRET; // Crea esto en Vercel Environment Variables
  const clientSecret = req.headers['x-api-secret'];

  if (!clientSecret || clientSecret !== API_SECRET) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  try {
    const { type, table, schema, user_email, client_ip, record_id } = req.body;
    
    // Configurar hora
    const hora = new Date().toLocaleString('es-CO', { 
      timeZone: 'America/Bogota',
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });

    // Helper para escapar MarkdownV2 (Mejorado)
    const escapeMd = (text) => {
      if (text === null || text === undefined || text === '') return 'Desconocido';
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
    
    // Aquí usamos user_email directamente
    mensaje += `👤 *Usuario:* ${escapeMd(user_email)}\n`; 
    mensaje += `🌐 *IP Origen:* \`${escapeMd(client_ip)}\`\n`;
    mensaje += `⏰ *Hora:* ${escapeMd(hora)}\n`;

    const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: process.env.TELEGRAM_CHAT_ID,
        text: mensaje,
        parse_mode: 'MarkdownV2'
      })
    });

    return res.status(200).json({ success: true });
    
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}