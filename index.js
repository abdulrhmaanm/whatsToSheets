const fs = require('fs');
const express = require('express');
const { google } = require('googleapis');
const bodyParser = require('body-parser');

const app = express(); // ✅ Declare app before using it
const PORT = process.env.PORT || 3000;

// Google Sheets setup
const SHEET_ID = '1tazaMy48peam23mcA_XYZQqjaAjdLyRQh416SJ35i1c'; // ✅ Use your actual Sheet ID
const SHEET_NAME = 'Sheet1';

// Load credentials from Render secret file
const path = '/etc/secrets/smpt-461213-c9200e31a1c6.json';
const credentials = JSON.parse(fs.readFileSync(path, 'utf-8'));

const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

app.use(bodyParser.json());

// ✅ Webhook verification
app.get('/webhook', (req, res) => {
  const VERIFY_TOKEN = 'mytoken'; // Change this to your own token

  if (
    req.query['hub.mode'] === 'subscribe' &&
    req.query['hub.verify_token'] === VERIFY_TOKEN
  ) {
    console.log('🟢 Webhook verified');
    res.status(200).send(req.query['hub.challenge']);
  } else {
    console.log('🔴 Webhook verification failed');
    res.sendStatus(403);
  }
});

// ✅ Webhook to receive WhatsApp messages
app.post('/webhook', async (req, res) => {
  try {
    const entry = req.body?.entry?.[0]?.changes?.[0]?.value;
    const message = entry?.messages?.[0];
    const contact = entry?.contacts?.[0];

    if (!message || !contact) return res.sendStatus(400);

    const name = contact?.profile?.name || 'Unknown';
    const phone = message.from;
    const text = message?.text?.body || '';

    console.log(`📩 ${name} (${phone}): ${text}`);

    const client = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: client });

    // Check for duplicates
    const existing = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!B:B`,
    });

    const existingPhones = existing.data.values?.flat() || [];
    if (existingPhones.includes(phone)) {
      console.log(`⚠️ Duplicate from ${phone} ignored`);
      return res.sendStatus(200);
    }

    // Append new row
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A1`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[name, phone, text]],
      },
    });

    console.log(`✅ Saved: ${name}, ${phone}, ${text}`);
    res.sendStatus(200);
  } catch (err) {
    console.error('❌ Error:', err.message);
    res.sendStatus(500);
  }
});

// ✅ Start the server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
