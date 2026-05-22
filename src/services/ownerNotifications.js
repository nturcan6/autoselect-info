import { config } from '../config.js';
import { sendWhatsAppText } from './meta.js';

export async function notifyOwner({ event, lead, reply }) {
  const ownerNumber = normalizePhone(config.whatsapp.ownerNumber);
  if (!ownerNumber) return { skipped: true, reason: 'OWNER_WHATSAPP_NUMBER is not set' };

  const customerNumber = normalizePhone(event.from);
  if (customerNumber && customerNumber === ownerNumber) {
    return { skipped: true, reason: 'Customer is owner number' };
  }

  const payload = await sendWhatsAppText(ownerNumber, buildOwnerSummary({ event, lead, reply }));
  return {
    skipped: false,
    to: ownerNumber,
    messageId: payload?.messages?.[0]?.id || null
  };
}

function buildOwnerSummary({ event, lead, reply }) {
  return [
    'Nuevo resumen AutoSelect',
    '',
    `Canal: ${labelChannel(event.channel)}`,
    `Cliente: ${lead.contactId || event.from || 'No indicado'}`,
    `Intencion: ${labelIntent(lead.intent)}`,
    lead.vehicle ? `Vehiculo: ${lead.vehicle}` : null,
    lead.budget ? `Presupuesto: ${lead.budget}` : null,
    '',
    `Mensaje cliente: ${event.text || 'Sin texto'}`,
    '',
    `Respuesta bot: ${reply || 'Sin respuesta registrada'}`,
    '',
    `Siguiente accion: ${lead.nextAction || 'Revisar lead y contactar si procede.'}`
  ]
    .filter((line) => line !== null)
    .join('\n');
}

function labelChannel(channel) {
  return {
    whatsapp: 'WhatsApp',
    web: 'Web',
    instagram: 'Instagram',
    facebook: 'Facebook'
  }[channel] || channel;
}

function labelIntent(intent) {
  return {
    sell_vehicle: 'Quiere vender/tasar coche',
    buy_vehicle: 'Quiere comprar coche',
    general_question: 'Pregunta general'
  }[intent] || intent;
}

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '');
}
