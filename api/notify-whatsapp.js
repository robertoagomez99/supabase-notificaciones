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
    
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const contentSid = process.env.TWILIO_CONTENT_SID;
    const fromNumber = process.env.TWILIO_FROM;
    const toNumber = process.env.TWILIO_TO;
    
    if (!accountSid || !authToken || !contentSid || !fromNumber || !toNumber) {
      return res.status(500).json({ 
        error: 'Faltan credenciales',
        missing: {
          accountSid: !accountSid,
          authToken: !authToken,
          contentSid: !contentSid,
          from: !fromNumber,
          to: !toNumber
        }
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
        ContentSid: contentSid,
        ContentVariables: JSON.stringify({
          "1": table || "desconocida",
          "2": type || "desconocido",
          "3": hora
        })
      })
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Twilio error: ${error}`);
    }
    
    const data = await response.json();
    console.log('Mensaje enviado, SID:', data.sid);
    
    return res.status(200).json({ 
      success: true,
      messageSid: data.sid,
      status: data.status
    });
    
  } catch (error) {
    console.error('Error completo:', error);
    return res.status(500).json({ 
      error: error.message 
    });
  }
}