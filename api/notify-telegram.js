export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Solo POST' });

  try {
    const { type, table, record, schema } = req.body;
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
      if (!text) return '';
      return String(text).replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
    };

    // 1. Asignar Emoji según el esquema (Medallion Model)
    const schemaEmojis = {
      'operational': '⚙️',
      'raw_voice': '🎙️',
      'raw_vision': '👁️',
      'artifacts': '📦',
      'reporting': '📊',
      'cleansed': '✨'
    };
    const emoji = schemaEmojis[schema] || '🔔';

    // 2. Construir el encabezado
    let mensaje = `${emoji} *CAMBIO DETECTADO*\n\n`;
    mensaje += `📂 *Esquema:* \`${escapeMd(schema.toUpperCase())}\`\n`;
    mensaje += `📋 *Tabla:* ${escapeMd(table)}\n`;
    mensaje += `⚡ *Acción:* ${escapeMd(type)}\n`;
    mensaje += `⏰ *Hora:* ${escapeMd(hora)}\n\n`;

    // 3. Añadir los datos del registro (limitado para no exceder los 4096 caracteres de Telegram)
    if (record) {
      const jsonStr = JSON.stringify(record, null, 2);
      // Cortamos el JSON si es muy largo para evitar errores de Telegram
      const shortJson = jsonStr.length > 1500 ? jsonStr.substring(0, 1500) + '...' : jsonStr;
      
      mensaje += `📝 *Datos del registro:*\n`;
      mensaje += `\`\`\`json\n${shortJson}\n\`\`\``;
    }

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