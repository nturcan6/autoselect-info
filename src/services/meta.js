import { config } from '../config.js';

const graphBase = `https://graph.facebook.com/${config.graphVersion}`;
const instagramGraphBase = `https://graph.instagram.com/${config.graphVersion}`;

export function verifyWebhook(query) {
  const mode = query['hub.mode'];
  const token = query['hub.verify_token'];
  const challenge = query['hub.challenge'];

  if (mode === 'subscribe' && token === config.metaVerifyToken) {
    return challenge;
  }

  return null;
}

export function extractWhatsAppEvents(payload) {
  const entries = payload.entry || [];
  const events = [];

  for (const entry of entries) {
    for (const change of entry.changes || []) {
      const value = change.value || {};
      for (const message of value.messages || []) {
        const text = message.text?.body?.trim();
        if (!text) continue;

        events.push({
          id: message.id,
          channel: 'whatsapp',
          from: message.from,
          text,
          timestamp: unixToIso(message.timestamp),
          raw: message
        });
      }
    }
  }

  return events;
}

export function extractInstagramEvents(payload) {
  if (payload.object !== 'instagram') return [];
  return extractMessagingEvents(payload, 'instagram');
}

export function extractFacebookEvents(payload) {
  if (payload.object !== 'page') return [];
  return extractMessagingEvents(payload, 'facebook');
}

function extractMessagingEvents(payload, channel) {
  const entries = payload.entry || [];
  const events = [];

  for (const entry of entries) {
    for (const messaging of entry.messaging || []) {
      const text = messaging.message?.text?.trim();
      const senderId = messaging.sender?.id;
      if (!text || !senderId) continue;

        events.push({
          id: messaging.message.mid,
          channel,
          from: senderId,
          text,
          timestamp: new Date(messaging.timestamp || Date.now()).toISOString(),
        raw: messaging
      });
    }
  }

  return events;
}

export async function sendWhatsAppText(to, body) {
  if (!config.whatsapp.accessToken || !config.whatsapp.phoneNumberId) {
    console.log('[dry-run whatsapp]', { to, body });
    return;
  }

  const response = await fetch(
    `${graphBase}/${config.whatsapp.phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.whatsapp.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { preview_url: false, body }
      })
    }
  );

  await assertMetaOk(response, 'WhatsApp send failed');
  return response.json();
}

export async function sendWhatsAppTemplate(to, { name, language = 'es', parameters = [] }) {
  if (!config.whatsapp.accessToken || !config.whatsapp.phoneNumberId) {
    console.log('[dry-run whatsapp template]', { to, name, language, parameters });
    return;
  }

  const response = await fetch(
    `${graphBase}/${config.whatsapp.phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.whatsapp.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name,
          language: { code: language },
          components: [
            {
              type: 'body',
              parameters: parameters.map((text) => ({
                type: 'text',
                text: String(text || '').slice(0, 900)
              }))
            }
          ]
        }
      })
    }
  );

  await assertMetaOk(response, 'WhatsApp template send failed');
  return response.json();
}

export async function sendInstagramText(recipientId, text) {
  if (!config.instagram.accessToken || !config.instagram.pageId) {
    console.log('[dry-run instagram]', { recipientId, text });
    return;
  }

  const response = await fetch(`${instagramGraphBase}/${config.instagram.pageId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.instagram.accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text }
    })
  });

  await assertMetaOk(response, 'Instagram send failed');
}

export async function sendFacebookText(recipientId, text) {
  if (!config.facebook.accessToken || !config.facebook.pageId) {
    console.log('[dry-run facebook]', { recipientId, text });
    return;
  }

  const response = await fetch(`${graphBase}/${config.facebook.pageId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.facebook.accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text }
    })
  });

  await assertMetaOk(response, 'Facebook send failed');
}

async function assertMetaOk(response, message) {
  if (response.ok) return;
  const body = await response.text();
  throw new Error(`${message}: ${response.status} ${body}`);
}

function unixToIso(timestamp) {
  const numericTimestamp = Number(timestamp);
  if (!Number.isFinite(numericTimestamp)) return new Date().toISOString();
  return new Date(numericTimestamp * 1000).toISOString();
}
