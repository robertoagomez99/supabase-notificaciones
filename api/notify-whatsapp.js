export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Solo se permiten POST requests' });
  }

  try {
    const { type, table, record } = req.body;
    
    // Construir mensaje
    let mensaje = `🔔 *Cambio en Supabase*\n\n`;
    mensaje += `📋 Tabla: ${table}\n`;
    mensaje += `⚡ Acción: ${type}\n`;
    mensaje += `⏰ ${new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })}`;
    
    if (type === 'INSERT') {
      mensaje += `\n\n✅ Nuevo registro creado`;
    } else if (type === 'UPDATE') {
      mensaje += `\n\n✏️ Registro actualizado`;
    } else if (type === 'DELETE') {
      mensaje += `\n\n🗑️ Registro eliminado`;
    }
    
    // Credenciales de Twilio
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_FROM; // whatsapp:+14155238886
    const toNumber = process.env.TWILIO_TO; // whatsapp:+573001234567
    
    if (!accountSid || !authToken || !fromNumber || !toNumber) {
      throw new Error('Faltan credenciales de Twilio');
    }
    
    // Enviar WhatsApp con Twilio
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        From: fromNumber,
        To: toNumber,
        Body: mensaje
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Error de Twilio: ${error}`);
    }
    
    console.log('Notificación enviada exitosamente');
    return res.status(200).json({ success: true });
    
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
}