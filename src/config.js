import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

loadDotEnv();

export const config = {
  port: Number(process.env.PORT || 3000),
  metaVerifyToken: process.env.META_VERIFY_TOKEN || 'mi_token_secreto_autoselect',
  graphVersion: process.env.META_GRAPH_VERSION || 'v21.0',
  whatsapp: {
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID
  },
  instagram: {
    accessToken: process.env.INSTAGRAM_ACCESS_TOKEN,
    pageId: process.env.INSTAGRAM_PAGE_ID
  },
  facebook: {
    accessToken: process.env.FACEBOOK_PAGE_ACCESS_TOKEN,
    pageId: process.env.FACEBOOK_PAGE_ID
  },
  googleSheets: {
    sheetId: process.env.GOOGLE_SHEET_ID,
    tab: process.env.GOOGLE_SHEET_TAB || 'Leads',
    serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    privateKey: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || 'gpt-4.1-mini'
  },
  business: {
    name: process.env.BUSINESS_NAME || 'AutoSelect',
    city: process.env.BUSINESS_CITY || '',
    phone: process.env.BUSINESS_PHONE || '',
    handoffText:
      process.env.HUMAN_HANDOFF_TEXT ||
      'Gracias. Te paso con un asesor para continuar.'
  }
};

function loadDotEnv() {
  const envPath = resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) return;

  const lines = readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] ??= value;
  }
}
