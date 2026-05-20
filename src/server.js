import { existsSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { createServer } from 'node:http';
import { URL } from 'node:url';
import { config } from './config.js';
import { buildBotReply } from './services/bot.js';
import { appendLead } from './services/googleSheets.js';
import {
  extractFacebookEvents,
  extractInstagramEvents,
  extractWhatsAppEvents,
  sendFacebookText,
  sendInstagramText,
  sendWhatsAppText,
  verifyWebhook
} from './services/meta.js';
import { classifyLead } from './services/leads.js';

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  try {
    if (req.method === 'GET' && url.pathname === '/health') {
      sendJson(res, 200, { ok: true, service: 'autoselect-client-bot' });
      return;
    }

    if (req.method === 'GET' && url.pathname.startsWith('/widget/')) {
      sendStaticFile(res, url.pathname);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/test-message') {
      const body = await readJson(req);
      const event = {
        id: `test-${Date.now()}`,
        channel: body.channel || 'whatsapp',
        from: body.from || 'test-client',
        text: body.text || '',
        timestamp: new Date().toISOString(),
        raw: body
      };

      const lead = classifyLead(event);
      await appendLead(lead);
      const reply = await buildBotReply({ event, lead });

      sendJson(res, 200, { lead, reply });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/web-chat') {
      const body = await readJson(req);
      const event = {
        id: body.sessionId || `web-${Date.now()}`,
        channel: 'web',
        from: body.name || body.phone || body.email || 'web-visitor',
        text: body.text || '',
        timestamp: new Date().toISOString(),
        raw: body
      };

      const lead = {
        ...classifyLead(event),
        contactId: [body.name, body.phone, body.email].filter(Boolean).join(' | ') || event.from,
        sourceUrl: body.sourceUrl || ''
      };
      await appendLead(lead);
      const reply = await buildBotReply({ event, lead });

      sendJson(res, 200, { lead, reply });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/webhook/meta') {
      const challenge = verifyWebhook(Object.fromEntries(url.searchParams));
      if (!challenge) {
        sendText(res, 403, 'Forbidden');
        return;
      }

      sendText(res, 200, challenge);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/webhook/meta') {
      const body = await readJson(req);
      sendText(res, 200, 'OK');
      processMetaWebhook(body);
      return;
    }

    sendText(res, 404, 'Not found');
  } catch (error) {
    console.error('Request failed', error);
    sendJson(res, 500, { error: 'Internal server error' });
  }
});

server.listen(config.port, () => {
  console.log(`AutoSelect bot listening on port ${config.port}`);
});

async function processMetaWebhook(body) {
  const whatsappEvents = extractWhatsAppEvents(body);
  const instagramEvents = extractInstagramEvents(body);
  const facebookEvents = extractFacebookEvents(body);
  const events = [...whatsappEvents, ...instagramEvents, ...facebookEvents];

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
      console.error('Failed to process event', {
        error: error.message,
        channel: event.channel,
        from: event.from
      });
    }
  }
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 2_000_000) {
        req.destroy();
        reject(new Error('Request body too large'));
      }
    });
    req.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
  });
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(JSON.stringify(payload));
}

function sendText(res, statusCode, body) {
  res.writeHead(statusCode, { 'Content-Type': 'text/plain' });
  res.end(body);
}

function sendStaticFile(res, pathname) {
  const requestedPath = pathname.replace('/widget/', '');
  const filePath = join(process.cwd(), 'public', 'widget', requestedPath);

  if (!existsSync(filePath)) {
    sendText(res, 404, 'Not found');
    return;
  }

  const contentTypes = {
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8'
  };

  res.writeHead(200, {
    'Content-Type': contentTypes[extname(filePath)] || 'application/octet-stream',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(readFileSync(filePath));
}
