export default async function handler(req, res) {
  console.log("--- NUEVA PETICIÓN RECIBIDA ---");

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Validación de Seguridad
  const API_SECRET = process.env.NOTIFY_SECRET;
  const clientSecret = req.headers['x-api-secret'];

  if (!clientSecret || clientSecret !== API_SECRET) {
    console.error("❌ ERROR: Clave secreta incorrecta");
    return res.status(401).json({ error: 'No autorizado' });
  }

  try {
    const { 
      type, table, schema, 
      user_email, client_ip, record_id,
      record, old_record,
      
      // INFORMACIÓN DEL PROYECTO (automática desde Supabase)
      project_ref,
      database_name,
      db_user,
      db_host
    } = req.body;
    
    const hora = new Date().toLocaleString('es-CO', { 
      timeZone: 'America/Bogota',
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });

    const escapeMd = (text) => {
      if (!text) return 'N/A';
      return String(text).replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
    };

    // Emojis por schema
    const schemaEmojis = {
      'operational': '⚙️', 'raw_voice': '🎙️', 'raw_vision': '👁️',
      'artifacts': '📦', 'reporting': '📊', 'cleansed': '✨', 'public': '🌐'
    };
    const emoji = schemaEmojis[schema] || '🔔';

    // Emojis por operación
    const operationEmojis = {
      'INSERT': '✅', 'UPDATE': '✏️', 'DELETE': '🗑️'
    };
    const opEmoji = operationEmojis[type] || '⚡';

    // CONSTRUCCIÓN DEL MENSAJE COMPLETO
    let mensaje = `${emoji} *CAMBIO EN BASE DE DATOS*\n\n`;
    
    // Información del Proyecto/DB (automática)
    mensaje += `🏢 *Proyecto:* \`${escapeMd(project_ref)}\`\n`;
    mensaje += `💾 *Base de Datos:* \`${escapeMd(database_name)}\`\n`;
    mensaje += `🖥️ *Host:* \`${escapeMd(db_host)}\`\n`;
    mensaje += `👨‍💻 *DB User:* \`${escapeMd(db_user)}\`\n\n`;
    
    // Ubicación del cambio
    mensaje += `📂 *Schema:* \`${escapeMd(schema)}\`\n`;
    mensaje += `📋 *Tabla:* \`${escapeMd(table)}\`\n\n`;
    
    // Información de la operación
    mensaje += `${opEmoji} *Operación:* ${escapeMd(type)}\n`;
    mensaje += `🆔 *ID Registro:* \`${escapeMd(record_id)}\`\n\n`;
    
    // Usuario e IP
    mensaje += `👤 *Usuario:* ${escapeMd(user_email)}\n`;
    mensaje += `🌐 *IP Origen:* \`${escapeMd(client_ip)}\`\n`;
    mensaje += `⏰ *Fecha/Hora:* ${escapeMd(hora)}\n`;

    // DETALLES DEL CAMBIO
    if (type === 'INSERT' && record) {
      const recordKeys = Object.keys(record).filter(k => 
        !['id', 'created_at', 'updated_at'].includes(k)
      ).slice(0, 5);
      
      if (recordKeys.length > 0) {
        mensaje += `\n📝 *Datos nuevos:*\n`;
        recordKeys.forEach(key => {
          const value = record[key];
          if (value !== null && value !== undefined) {
            const displayValue = String(value).length > 40 
              ? String(value).substring(0, 37) + '...' 
              : String(value);
            mensaje += `  • ${escapeMd(key)}: \`${escapeMd(displayValue)}\`\n`;
          }
        });
      }
    }

    if (type === 'UPDATE' && old_record && record) {
      const changedKeys = Object.keys(record).filter(key => 
        record[key] !== old_record[key] && 
        !['updated_at', 'modified_at'].includes(key)
      ).slice(0, 4);
      
      if (changedKeys.length > 0) {
        mensaje += `\n📝 *Cambios:*\n`;
        changedKeys.forEach(key => {
          const oldVal = String(old_record[key] || 'null').substring(0, 25);
          const newVal = String(record[key] || 'null').substring(0, 25);
          mensaje += `  • ${escapeMd(key)}:\n`;
          mensaje += `    ❌ \`${escapeMd(oldVal)}\`\n`;
          mensaje += `    ✅ \`${escapeMd(newVal)}\`\n`;
        });
      }
    }

    if (type === 'DELETE' && record) {
      const recordKeys = Object.keys(record).filter(k => 
        !['created_at', 'updated_at'].includes(k)
      ).slice(0, 5);
      
      if (recordKeys.length > 0) {
        mensaje += `\n📝 *Registro eliminado:*\n`;
        recordKeys.forEach(key => {
          const value = record[key];
          if (value !== null && value !== undefined) {
            const displayValue = String(value).length > 40 
              ? String(value).substring(0, 37) + '...' 
              : String(value);
            mensaje += `  • ${escapeMd(key)}: \`${escapeMd(displayValue)}\`\n`;
          }
        });
      }
    }

    // Link al proyecto de Supabase
    if (project_ref && project_ref !== 'unknown') {
      mensaje += `\n🔗 [Ver Proyecto](https://supabase.com/dashboard/project/${project_ref})`;
    }

    // Enviar a Telegram
    const response = await fetch(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: process.env.TELEGRAM_CHAT_ID,
          text: mensaje,
          parse_mode: 'MarkdownV2',
          disable_web_page_preview: true
        })
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Telegram error: ${JSON.stringify(error)}`);
    }

    console.log("✅ Mensaje enviado con éxito");
    return res.status(200).json({ success: true });
    
  } catch (error) {
    console.error("❌ Error:", error.message);
    return res.status(500).json({ error: error.message });
  }
}