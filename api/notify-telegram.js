export default async function handler(req, res) {
  console.log("--- NEW DATABASE NOTIFICATION RECEIVED ---");

  // CORS headers setup
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Security Validation
  const API_SECRET = process.env.NOTIFY_SECRET;
  const clientSecret = req.headers['x-api-secret'];

  if (!clientSecret || clientSecret !== API_SECRET) {
    console.error("❌ ERROR: Unauthorized access attempt");
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { 
      type, table, schema, 
      user_email, client_ip, record_id,
      record, old_record,
      project_ref, database_name,
      db_user, db_host
    } = req.body;
    
    // Set timestamp in Colombia timezone
    const timestamp = new Date().toLocaleString('es-CO', { 
      timeZone: 'America/Bogota',
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });

    // Helper to escape special characters for Telegram MarkdownV2
    // Telegram is very strict with characters like . - _ ! in MarkdownV2
    const escapeMd = (text) => {
      if (!text) return 'N/A';
      return String(text).replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
    };

    // Emoji mapping for schemas
    const schemaEmojis = {
      'operational': '⚙️', 'raw_voice': '🎙️', 'raw_vision': '👁️',
      'artifacts': '📦', 'reporting': '📊', 'cleansed': '✨', 'public': '🌐'
    };
    const emoji = schemaEmojis[schema] || '🔔';

    // Emoji mapping for operations
    const opEmoji = type === 'INSERT' ? '✅' : type === 'UPDATE' ? '✏️' : '🗑️';

    // BUILDING THE MESSAGE
    let message = `${emoji} *DATABASE CHANGE DETECTED*\n\n`;
    
    // Project and Database info
    message += `🏢 *Project:* \`${escapeMd(project_ref)}\`\n`;
    message += `💾 *Database:* \`${escapeMd(database_name)}\`\n`;
    message += `👨‍💻 *DB User:* \`${escapeMd(db_user)}\`\n\n`;
    
    // Location info
    message += `📂 *Schema:* \`${escapeMd(schema)}\`\n`;
    message += `📋 *Table:* \`${escapeMd(table)}\`\n\n`;
    
    // Operation details
    message += `${opEmoji} *Operation:* ${escapeMd(type)}\n`;
    message += `🆔 *Record ID:* \`${escapeMd(record_id)}\`\n\n`;
    
    // User and Network info
    message += `👤 *User:* ${escapeMd(user_email)}\n`;
    message += `🌐 *Source IP:* \`${escapeMd(client_ip)}\`\n`;
    message += `⏰ *Time:* ${escapeMd(timestamp)}\n`;

    // DATA DETAILS (Only for INSERT and UPDATE)
    // -----------------------------------------
    
    // 1. Details for INSERT
    if (type === 'INSERT' && record) {
      const recordKeys = Object.keys(record).filter(k => 
        !['id', 'created_at', 'updated_at'].includes(k)
      ).slice(0, 5);
      
      if (recordKeys.length > 0) {
        message += `\n📝 *New Data:*\n`;
        recordKeys.forEach(key => {
          const value = record[key];
          if (value !== null && value !== undefined) {
            const displayValue = String(value).length > 40 
              ? String(value).substring(0, 37) + '...' 
              : String(value);
            message += `  • ${escapeMd(key)}: \`${escapeMd(displayValue)}\`\n`;
          }
        });
      }
    }

    // 2. Details for UPDATE
    if (type === 'UPDATE' && old_record && record) {
      const changedKeys = Object.keys(record).filter(key => 
        record[key] !== old_record[key] && 
        !['updated_at', 'modified_at'].includes(key)
      ).slice(0, 4);
      
      if (changedKeys.length > 0) {
        message += `\n📝 *Changes:*\n`;
        changedKeys.forEach(key => {
          const oldVal = String(old_record[key] || 'null').substring(0, 25);
          const newVal = String(record[key] || 'null').substring(0, 25);
          message += `  • ${escapeMd(key)}:\n`;
          message += `    ❌ \`${escapeMd(oldVal)}\`\n`;
          message += `    ✅ \`${escapeMd(newVal)}\`\n`;
        });
      }
    }

    // Link to Supabase Project (Corrected Markdown format)
    if (project_ref && project_ref !== 'unknown' && project_ref !== 'your-project-ref-here') {
      const baseUrl = "https://supabase.com/dashboard/project/";
      message += `\n🔗 [View Project](${baseUrl}${project_ref})`;
    }

    // Send the message to Telegram API
    const response = await fetch(
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: process.env.TELEGRAM_CHAT_ID,
          text: message,
          parse_mode: 'MarkdownV2',
          disable_web_page_preview: true
        })
      }
    );

    const result = await response.json();
    if (!response.ok) {
      throw new Error(`Telegram API Error: ${result.description}`);
    }

    console.log("✅ Notification sent successfully to Telegram");
    return res.status(200).json({ success: true });
    
  } catch (error) {
    console.error("❌ ERROR:", error.message);
    return res.status(500).json({ error: error.message });
  }
}