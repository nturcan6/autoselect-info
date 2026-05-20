(function () {
  const currentScript = document.currentScript;
  const endpoint =
    currentScript?.dataset.endpoint ||
    new URL('/web-chat', currentScript?.src || window.location.href).toString();
  const brand = currentScript?.dataset.brand || 'AutoSelect';

  const styles = document.createElement('style');
  styles.textContent = `
    .as-chat-button {
      position: fixed;
      right: 18px;
      bottom: 18px;
      z-index: 99999;
      border: 0;
      border-radius: 999px;
      background: #0f766e;
      color: white;
      min-height: 52px;
      padding: 0 18px;
      font: 700 15px/1.1 system-ui, -apple-system, Segoe UI, sans-serif;
      box-shadow: 0 12px 30px rgba(15, 23, 42, 0.22);
      cursor: pointer;
    }
    .as-chat-panel {
      position: fixed;
      right: 18px;
      bottom: 84px;
      z-index: 99999;
      width: min(360px, calc(100vw - 32px));
      background: #ffffff;
      color: #111827;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      box-shadow: 0 24px 60px rgba(15, 23, 42, 0.22);
      font: 14px/1.4 system-ui, -apple-system, Segoe UI, sans-serif;
      overflow: hidden;
      display: none;
    }
    .as-chat-panel[data-open="true"] {
      display: block;
    }
    .as-chat-header {
      background: #0f766e;
      color: white;
      padding: 14px 16px;
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: center;
    }
    .as-chat-header strong {
      display: block;
      font-size: 15px;
    }
    .as-chat-close {
      border: 0;
      background: transparent;
      color: white;
      font-size: 22px;
      cursor: pointer;
      line-height: 1;
    }
    .as-chat-body {
      padding: 14px;
      display: grid;
      gap: 10px;
    }
    .as-chat-messages {
      min-height: 96px;
      max-height: 220px;
      overflow: auto;
      display: grid;
      gap: 8px;
      padding-right: 2px;
    }
    .as-chat-bubble {
      padding: 9px 11px;
      border-radius: 8px;
      max-width: 92%;
      white-space: pre-wrap;
    }
    .as-chat-bubble[data-from="bot"] {
      background: #ecfdf5;
      justify-self: start;
    }
    .as-chat-bubble[data-from="user"] {
      background: #eff6ff;
      justify-self: end;
    }
    .as-chat-fields {
      display: grid;
      gap: 8px;
    }
    .as-chat-fields input,
    .as-chat-fields textarea {
      width: 100%;
      box-sizing: border-box;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 10px;
      font: inherit;
    }
    .as-chat-fields textarea {
      min-height: 76px;
      resize: vertical;
    }
    .as-chat-submit {
      border: 0;
      border-radius: 6px;
      background: #111827;
      color: white;
      min-height: 42px;
      padding: 0 14px;
      font: 700 14px system-ui, -apple-system, Segoe UI, sans-serif;
      cursor: pointer;
    }
    .as-chat-submit:disabled {
      opacity: 0.62;
      cursor: wait;
    }
  `;

  const panel = document.createElement('section');
  panel.className = 'as-chat-panel';
  panel.innerHTML = `
    <div class="as-chat-header">
      <strong>${escapeHtml(brand)}</strong>
      <button class="as-chat-close" type="button" aria-label="Cerrar">×</button>
    </div>
    <div class="as-chat-body">
      <div class="as-chat-messages" aria-live="polite"></div>
      <form class="as-chat-fields">
        <input name="name" autocomplete="name" placeholder="Nombre" />
        <input name="phone" autocomplete="tel" placeholder="Telefono" />
        <input name="email" autocomplete="email" placeholder="Email opcional" />
        <textarea name="text" required placeholder="Quiero comprar o vender un vehiculo..."></textarea>
        <button class="as-chat-submit" type="submit">Enviar</button>
      </form>
    </div>
  `;

  const button = document.createElement('button');
  button.className = 'as-chat-button';
  button.type = 'button';
  button.textContent = 'Hablar con AutoSelect';

  document.head.appendChild(styles);
  document.body.appendChild(panel);
  document.body.appendChild(button);

  const messages = panel.querySelector('.as-chat-messages');
  const form = panel.querySelector('form');
  const submit = panel.querySelector('.as-chat-submit');
  const close = panel.querySelector('.as-chat-close');
  const sessionId = crypto?.randomUUID?.() || `web-${Date.now()}`;

  addMessage('bot', 'Hola, soy el asistente de AutoSelect. ¿Quieres comprar un vehiculo o vender el tuyo?');

  button.addEventListener('click', () => {
    panel.dataset.open = panel.dataset.open === 'true' ? 'false' : 'true';
  });

  close.addEventListener('click', () => {
    panel.dataset.open = 'false';
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    if (!data.text.trim()) return;

    addMessage('user', data.text.trim());
    submit.disabled = true;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          sessionId,
          sourceUrl: window.location.href
        })
      });
      const payload = await response.json();
      addMessage('bot', payload.reply || 'Gracias. Un asesor de AutoSelect revisara tu solicitud.');
      form.elements.text.value = '';
    } catch {
      addMessage('bot', 'Ahora mismo no he podido enviar tu mensaje. Intentalo de nuevo en unos minutos.');
    } finally {
      submit.disabled = false;
    }
  });

  function addMessage(from, text) {
    const bubble = document.createElement('div');
    bubble.className = 'as-chat-bubble';
    bubble.dataset.from = from;
    bubble.textContent = text;
    messages.appendChild(bubble);
    messages.scrollTop = messages.scrollHeight;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[char];
    });
  }
})();
