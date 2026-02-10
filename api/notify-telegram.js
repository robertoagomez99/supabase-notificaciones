export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Solo POST' });

  try {
    // 1. Recibimos los nuevos datos desde el Trigger SQL actualizado
    const { type, table, schema, user_id, client_ip, record_id } = req.body;
    
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    
    if (!token || !chatId) return res.status(500).json({ error: 'Faltan credenciales' });

    const hora = new Date().toLocaleString('es-CO', { 
      timeZone: 'America/Bogota',
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });

    // Helper para escapar MarkdownV2
    const escapeMd = (text) => {
      if (!text) return 'n/a';
      return String(text).replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
    };

    const schemaEmojis = {
      'operational': '⚙️',
      'raw_voice': '🎙️',
      'raw_vision': '👁️',
      'artifacts': '📦',
      'reporting': '📊',
      'cleansed': '✨'
    };
    const emoji = schemaEmojis[schema] || '🔔';

    // 2. Construir el mensaje optimizado (Sin el JSON pesado)
    let mensaje = `${emoji} *CAMBIO DETECTADO EN ${escapeMd(schema.toUpperCase())}*\n\n`;
    mensaje += `📋 *Tabla:* ${escapeMd(table)}\n`;
    mensaje += `⚡ *Acción:* ${escapeMd(type)}\n`;
    mensaje += `🆔 *ID Registro:* \`${escapeMd(record_id)}\`\n\n`;
    
    // 3. Nuevos datos de Auditoría
    mensaje += `👤 *Usuario:* \`${escapeMd(user_id)}\`\n`;
    mensaje += `🌐 *IP Origen:* \`${escapeMd(client_ip)}\`\n`;
    mensaje += `⏰ *Hora:* ${escapeMd(hora)}\n`;

    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: mensaje,
        parse_mode: 'MarkdownV2'
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(`Telegram error: ${JSON.stringify(data)}`);
    
    return res.status(200).json({ success: true });
    
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
}