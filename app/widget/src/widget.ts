// SINGLETON widget – un solo WS por bot y por página
(function () {
  // Evita inicializar dos veces si el script se carga/inyecta repetido
  if ((window as any).__BOT_WIDGET_INIT__) return;
  (window as any).__BOT_WIDGET_INIT__ = true;

  // Localiza la etiqueta <script data-bot data-server>
  let script = document.currentScript as HTMLScriptElement | null;
  if (!script) {
    script = document.querySelector(
      'script[src*="/api/embed/widget.js"][data-bot][data-server]'
    ) as HTMLScriptElement | null;
    if (!script) {
      const all = document.querySelectorAll('script[src]');
      for (let i = all.length - 1; i >= 0; i--) {
        const s = all[i] as HTMLScriptElement;
        if (s.src.includes('/api/embed/widget.js')) { script = s; break; }
      }
    }
  }
  if (!script) return;

  const API = script.getAttribute('data-server')!.replace(/\/$/, ''); // sin "/"
  const BOT = script.getAttribute('data-bot')!;

  // ——— Estado global por si hay varios widgets/bots en la misma página ———
  const globalSockets = ((window as any).__botSockets ||= new Map<
    string,
    {
      ws: WebSocket | null;
      queue: string[];
      connecting: boolean;
      lineEl: HTMLDivElement | null;
      started: boolean;
    }
  >());

  function getState(botId: string) {
    if (!globalSockets.has(botId)) {
      globalSockets.set(botId, {
        ws: null,
        queue: [],
        connecting: false,
        lineEl: null,
        started: false,
      });
    }
    return globalSockets.get(botId)!;
  }

  // ——— UI mínima ———
  const btn = document.createElement('button');
  btn.textContent = 'Chat';
  Object.assign(btn.style, {
    position: 'fixed', bottom: '20px', right: '20px',
    padding: '10px 14px', borderRadius: '999px', zIndex: '99999'
  });
  document.body.appendChild(btn);

  const box = document.createElement('div');
  Object.assign(box.style, {
    position: 'fixed', bottom: '70px', right: '20px', width: '360px',
    maxHeight: '60vh', overflow: 'auto', background: '#111', color: '#fff',
    padding: '12px', borderRadius: '12px', display: 'none', zIndex: '99999'
  });
  const log = document.createElement('div');
  const input = document.createElement('input'); input.placeholder = 'Escribe...'; input.style.width = '100%';
  const send = document.createElement('button'); send.textContent = 'Enviar';
  box.append(log, input, send); document.body.appendChild(box);

  btn.onclick = () => {
    box.style.display = (box.style.display === 'none' ? 'block' : 'none');
  };

  // ——— Lógica WS con singleton ———
  function wsUrl() {
    return API.replace(/^http(s?):/, 'ws$1:') + `/ws/chat/${BOT}`;
  }

  function ensureSocket() {
    const state = getState(BOT);
    if (state.ws && state.ws.readyState === WebSocket.OPEN) return state.ws;
    if (state.connecting) return state.ws; // se está abriendo

    state.connecting = true;
    state.started = false;
    state.lineEl = null;

    const ws = new WebSocket(wsUrl());
    state.ws = ws;

    ws.onopen = () => {
      state.connecting = false;
      // drena cola acumulada mientras “conectaba”
      for (const text of state.queue.splice(0)) {
        ws.send(JSON.stringify({ type: 'user_msg', text }));
      }
    };

    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data.type === 'bot_start') {
          state.started = true;
          state.lineEl = document.createElement('div');
          state.lineEl.id = 'ws_line';
          state.lineEl.innerHTML = '<b>Bot:</b> ';
          log.appendChild(state.lineEl);
        }
        if (data.type === 'bot_delta') {
          if (!state.lineEl) {
            state.lineEl = document.createElement('div');
            state.lineEl.id = 'ws_line';
            state.lineEl.innerHTML = '<b>Bot:</b> ';
            log.appendChild(state.lineEl);
          }
          state.lineEl.innerHTML += data.delta;
          log.scrollTop = log.scrollHeight;
        }
        if (data.type === 'bot_done') {
          if (state.lineEl) state.lineEl.id = '';
        }
        if (data.type === 'bot_error') {
          log.innerHTML += `<div><b>Bot:</b> error</div>`;
        }
      } catch (e) {
        console.error(e);
      }
    };

    ws.onerror = () => {
      // Si no llegó a empezar, deja que fallback maneje
    };

    ws.onclose = () => {
      // si se cerró, marcamos para poder re-conectar en el próximo envío
      state.ws = null;
      state.connecting = false;
      state.started = false;
      state.lineEl = null;
    };

    return ws;
  }

  async function sendViaHttp(text: string) {
    try {
      const res = await fetch(`${API}/api/chat/${BOT}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text })
      });
      const data = await res.json();
      log.innerHTML += `<div><b>Bot:</b> ${data.reply || '...'}</div>`;
      log.scrollTop = log.scrollHeight;
    } catch {
      log.innerHTML += `<div><b>Bot:</b> error</div>`;
    }
  }

  send.onclick = () => {
    const text = input.value.trim();
    if (!text) return;
    log.innerHTML += `<div><b>Tú:</b> ${text}</div>`;
    input.value = '';

    const state = getState(BOT);
    const ws = ensureSocket();

    // si ya está abierto, manda; si está conectando, encola
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({ type: 'user_msg', text }));
      } catch {
        // si falló el send, intenta HTTP fallback
        sendViaHttp(text);
      }
    } else if (state.connecting) {
      state.queue.push(text);
    } else {
      // si por algún motivo no hay ws, usa HTTP como respaldo
      sendViaHttp(text);
    }
  };
})();
