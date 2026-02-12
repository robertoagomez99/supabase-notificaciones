# Supabase Medallion Architecture Monitor & Telegram Alerter

This project implements a real-time audit and notification system for Supabase databases, specifically designed for **Medallion Architecture** (Bronze, Silver, Gold layers). It sends detailed alerts to Telegram whenever an INSERT, UPDATE, or DELETE operation occurs.

## 🚀 Key Features
- **Medallion Support:** Native monitoring for `operational`, `raw_voice`, `raw_vision`, `artifacts`, and `reporting` schemas.
- **Full Audit Trail:** Captures the real-time IP address and the Email of the team member or user who made the change.
- **Enhanced Security:** Implements a security handshake via a Shared Secret Token (`x-api-secret`) to prevent unauthorized webhook calls.
- **Automatic PK Detection:** Dynamically identifies the Primary Key (ID) of any table without manual configuration.
- **Lightweight & Encrypted-Friendly:** Optimized to send only audit metadata, avoiding issues with large encrypted JSON payloads or Telegram character limits.

---

## 🛠️ Vercel Setup (Node.js)

1. Create a Vercel project with your `api/notify-telegram.js` file.
2. Configure the following **Environment Variables** in your Vercel Dashboard:
   - `TELEGRAM_BOT_TOKEN`: Your bot token from @BotFather.
   - `TELEGRAM_CHAT_ID`: Your personal or group Chat ID.
   - `NOTIFY_SECRET`:.

---

## 🐘 Supabase Setup (SQL)

### 1.Enable HTTP Extension
```sql
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;
```

### 2.Create the Notification Function
Deploy the cleansed.notify_telegram() function. Ensure the secret_token variable inside the SQL matches the one in Vercel.
```sql
folder sql
```
## Security (Handshake Protocol)
The system uses a custom header-based authentication:
### 1. Supabase signs the request using:
```sql
ROW('x-api-secret', 'YourSecret')::extensions.http_header.
```
### 2. Vercel interceptor validates:
```sql
if (req.headers['x-api-secret'] !== process.env.NOTIFY_SECRET)
```
### 3. If the tokens do not match, the request is rejected with a 401 Unauthorized status.

