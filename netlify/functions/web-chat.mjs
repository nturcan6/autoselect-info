import { buildBotReply } from '../../src/services/bot.js';
import { appendLead } from '../../src/services/googleSheets.js';
import { classifyLead } from '../../src/services/leads.js';

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return empty(204);
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  try {
    const body = JSON.parse(event.body || '{}');
    const botEvent = {
      id: body.sessionId || `web-${Date.now()}`,
      channel: 'web',
      from: body.name || body.phone || body.email || 'web-visitor',
      text: body.text || '',
      timestamp: new Date().toISOString(),
      raw: body
    };

    const lead = {
      ...classifyLead(botEvent),
      contactId: [body.name, body.phone, body.email].filter(Boolean).join(' | ') || botEvent.from,
      sourceUrl: body.sourceUrl || ''
    };

    await appendLead(lead);
    const reply = await buildBotReply({ event: botEvent, lead });

    return json(200, { lead, reply });
  } catch (error) {
    console.error('web-chat failed', error);
    return json(500, { error: 'Internal server error' });
  }
}

function empty(statusCode) {
  return {
    statusCode,
    headers: corsHeaders(),
    body: ''
  };
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      ...corsHeaders(),
      'Content-Type': 'application/json; charset=utf-8'
    },
    body: JSON.stringify(body)
  };
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };
}
