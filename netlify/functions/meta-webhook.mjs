import { buildBotReply } from '../../src/services/bot.js';
import { appendLead } from '../../src/services/googleSheets.js';
import { classifyLead } from '../../src/services/leads.js';
import {
  extractFacebookEvents,
  extractInstagramEvents,
  extractWhatsAppEvents,
  sendFacebookText,
  sendInstagramText,
  sendWhatsAppText,
  verifyWebhook
} from '../../src/services/meta.js';

export async function handler(event) {
  if (event.httpMethod === 'GET') {
    const challenge = verifyWebhook(event.queryStringParameters || {});
    if (!challenge) return text(403, 'Forbidden');
    return text(200, challenge);
  }

  if (event.httpMethod !== 'POST') return text(405, 'Method not allowed');

  const body = JSON.parse(event.body || '{}');
  await processMetaWebhook(body);
  return text(200, 'OK');
}

async function processMetaWebhook(body) {
  const events = [
    ...extractWhatsAppEvents(body),
    ...extractInstagramEvents(body),
    ...extractFacebookEvents(body)
  ];

  for (const event of events) {
    try {
      const lead = classifyLead(event);
      await appendLead(lead);
      const reply = await buildBotReply({ event, lead });

      if (event.channel === 'whatsapp') {
        await sendWhatsAppText(event.from, reply);
      }

      if (event.channel === 'instagram') {
        await sendInstagramText(event.from, reply);
      }

      if (event.channel === 'facebook') {
        await sendFacebookText(event.from, reply);
      }
    } catch (error) {
      console.error('Failed to process Meta event', {
        error: error.message,
        channel: event.channel,
        from: event.from
      });
    }
  }
}

function text(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'text/plain' },
    body
  };
}
