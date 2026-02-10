export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Solo POST' });
  }

  try {
    const { type, table, record } = req.body;
    
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    
    if (!token || !chatId) {
      return res.status(500).json({ 
        error: 'Faltan credenciales',
        missing: { token: !token, chatId: !chatId }
      });
    }
    
    const hora = new Date().toLocaleString('es-CO', { 
      timeZone: 'America/Bogota',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    let mensaje = `🔔 *Cambio en Supabase*\n\n`;
    mensaje += `📋 *Tabla:* ${table || 'desconocida'}\n`;
    mensaje += `⚡ *Acción:* ${type || 'desconocida'}\n`;
    mensaje += `⏰ *Hora:* ${hora}\n`;
    
    if (type === 'INSERT') {
      mensaje += `\n✅ Nuevo registro creado`;
    } else if (type === 'UPDATE') {
      mensaje += `\n✏️ Registro actualizado`;
    } else if (type === 'DELETE') {
      mensaje += `\n🗑️ Registro eliminado`;
    }
    
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: mensaje,
        parse_mode: 'Markdown'
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Telegram error: ${JSON.stringify(error)}`);
    }
    
    const data = await response.json();
    console.log('Mensaje enviado a Telegram:', data.result.message_id);
    
    return res.status(200).json({ 
      success: true,
      messageId: data.result.message_id
    });
    
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ 
      error: error.message 
    });
  }
}
