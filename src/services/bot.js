import { config } from '../config.js';

export async function buildBotReply({ event, lead }) {
  const ruleReply = buildRuleReply(lead);
  if (shouldUsePriorityRule(lead)) {
    return ruleReply;
  }

  if (config.openai.apiKey) {
    return buildAiReply({ event, lead });
  }

  return ruleReply;
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
            'Responde en espanol, claro, cercano y breve.',
            'Tu objetivo es captar datos utiles y derivar a un asesor cuando el cliente este listo.',
            'No inventes precios, disponibilidad, garantias ni financiacion.',
            'Si faltan datos, pide solo la siguiente informacion necesaria.',
            'Al iniciar una conversacion o ante un saludo, responde: "Hola, con que puedo ayudarte, dime por favor que es lo que estas buscando."',
            'Si el cliente pregunta por financiacion, explica que en la web puede simular cantidad, meses y porcentaje. Indica tambien que suele necesitar nomina, DNI o NIE en vigor, situacion bancaria viable y visitar las instalaciones para documentacion y prueba del vehiculo.',
            'Si el cliente pregunta por coche, catalogo o stock, envia www.autoselect.info y pregunta si necesita hablar con un comercial o si puede acudir a la direccion indicada en la web.',
            config.business.city ? `Ciudad: ${config.business.city}.` : '',
            config.business.phone ? `Telefono comercial: ${config.business.phone}.` : ''
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
  const text = normalize(lead.message);

  if (mentionsFinancing(text)) {
    return [
      'Sobre financiacion: en nuestra pagina web puedes simular tu caso particular indicando cantidad, meses y porcentaje.',
      'Para poder hacer la financiacion normalmente necesitas nomina, DNI o NIE en vigor y una situacion bancaria que permita aprobar la operacion.',
      'Si tienes mucho credito, hipotecas, impagos o normalmente te quedas sin saldo a final de mes, es muy poco probable que la financiera acepte.',
      'Tambien es importante acudir a nuestras instalaciones para presentar la documentacion, probar el vehiculo y facilitarnos tus datos personales: telefono, email y situacion familiar, como numero de hijos.'
    ].join(' ');
  }

  if (mentionsCatalogOrCar(text)) {
    return [
      'Puedes ver nuestro catalogo actualizado en www.autoselect.info.',
      'Si estas interesado en algun coche del catalogo, dime cual es y te ayudo.',
      'Tambien dime si necesitas hablar con un comercial o si puedes acudir a la direccion indicada en autoselect.info.'
    ].join(' ');
  }

  if (isGreetingOrStart(text)) {
    return 'Hola, con que puedo ayudarte, dime por favor que es lo que estas buscando.';
  }

  if (lead.intent === 'sell_vehicle') {
    return [
      `Gracias por escribir a ${config.business.name}.`,
      'Para valorar tu vehiculo, enviame marca, modelo, ano, kilometros, estado general, ubicacion y 3 o 4 fotos.',
      'Con eso un asesor te prepara una respuesta.'
    ].join(' ');
  }

  if (lead.intent === 'buy_vehicle') {
    return [
      `Hola, soy el asistente de ${config.business.name}.`,
      'Te ayudo a encontrar vehiculo.',
      'Que presupuesto tienes, que tipo de coche buscas y prefieres pago al contado o financiacion?'
    ].join(' ');
  }

  return 'Hola, con que puedo ayudarte, dime por favor que es lo que estas buscando.';
}

function shouldUsePriorityRule(lead) {
  const text = normalize(lead.message);

  return isGreetingOrStart(text) || mentionsFinancing(text) || mentionsCatalogOrCar(text);
}

function normalize(value = '') {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function isGreetingOrStart(text) {
  const cleaned = text.replace(/[^\p{L}\p{N}\s]/gu, '').trim();
  return /^(hola|buenas|buenos dias|buenas tardes|buenas noches|hello|hi|ola)$/.test(cleaned);
}

function mentionsFinancing(text) {
  return /\b(financiacion|financiar|financiado|financiera|credito|creditos|cuota|cuotas)\b/.test(text);
}

function mentionsCatalogOrCar(text) {
  return /\b(coche|coches|vehiculo|vehiculos|catalogo|stock|web|pagina)\b/.test(text);
}
