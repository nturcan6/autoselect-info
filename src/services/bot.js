import { config } from '../config.js';

export async function buildBotReply({ event, lead }) {
  if (config.openai.apiKey) {
    return buildAiReply({ event, lead });
  }

  return buildRuleReply(lead);
}

async function buildAiReply({ event, lead }) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.openai.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
    model: config.openai.model,
    temperature: 0.3,
    messages: [
      {
        role: 'system',
        content: [
          `Eres el asistente comercial de ${config.business.name}.`,
          'Responde en español, claro, cercano y breve.',
          'Tu objetivo es captar datos útiles y derivar a un asesor cuando el cliente esté listo.',
          'No inventes precios, disponibilidad, garantías ni financiación.',
          'Si faltan datos, pide solo la siguiente información necesaria.',
          config.business.city ? `Ciudad: ${config.business.city}.` : '',
          config.business.phone ? `Teléfono comercial: ${config.business.phone}.` : ''
        ]
          .filter(Boolean)
          .join('\n')
      },
      {
        role: 'user',
        content: JSON.stringify({
          canal: event.channel,
          mensajeCliente: event.text,
          intencionDetectada: lead.intent,
          vehiculoDetectado: lead.vehicle,
          presupuestoDetectado: lead.budget
        })
      }
    ]
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI reply failed: ${response.status} ${body}`);
  }

  const payload = await response.json();

  return payload.choices[0]?.message?.content?.trim() || buildRuleReply(lead);
}

function buildRuleReply(lead) {
  if (lead.intent === 'sell_vehicle') {
    return [
      `Gracias por escribir a ${config.business.name}.`,
      'Para valorar tu vehículo, envíame marca, modelo, año, kilómetros, estado general, ubicación y 3 o 4 fotos.',
      'Con eso un asesor te prepara una respuesta.'
    ].join(' ');
  }

  if (lead.intent === 'buy_vehicle') {
    return [
      `Hola, soy el asistente de ${config.business.name}.`,
      'Te ayudo a encontrar vehículo.',
      '¿Qué presupuesto tienes, qué tipo de coche buscas y prefieres pago al contado o financiación?'
    ].join(' ');
  }

  return [
    `Hola, soy el asistente de ${config.business.name}.`,
    '¿Quieres comprar un vehículo o vender el tuyo?'
  ].join(' ');
}
