// SINGLETON widget – un solo WS por bot y por página + sessionId estable (sid)
type ChatSocket = WebSocket & { __isBotSocket?: true };

(function () {
  // Evita inicializar dos veces si el script se carga/inyecta repetido
  const W = window as any;
  if (W.__BOT_WIDGET_INIT__) return;
  W.__BOT_WIDGET_INIT__ = true;

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

  const API = (script.getAttribute('data-server') || '').replace(/\/+$/,''); // sin "/"
  const BOT = script.getAttribute('data-bot') || '';

  if (!API || !BOT) return; // faltan datos para funcionar

  // ——— Globals para múltiples widgets/bots en la misma página ———
  // Sockets por bot
  const globalSockets: Map<string, {
    ws: ChatSocket | null;
    queue: string[];
    connecting: boolean;
    lineEl: HTMLDivElement | null;
    started: boolean;
  }> = (W.__botSockets ||= new Map());

  // Session IDs por bot (persisten por pestaña)
  const globalSids: Map<string, string> = (W.__botSessionIds ||= new Map());

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

  function getSid(botId: string) {
    if (!globalSids.has(botId)) {
      const sid =
        (crypto && typeof crypto.randomUUID === 'function')
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2);
      globalSids.set(botId, sid);
    }
    return globalSids.get(botId)!;
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
    if (box.style.display === 'block') input.focus();
  };

  // ——— Lógica WS con singleton + sid ———
  function wsUrl(botId: string) {
    const sid = encodeURIComponent(getSid(botId));
    const base = API.replace(/^http(s?):/, 'ws$1:');
    return `${base}/ws/chat/${encodeURIComponent(botId)}?sid=${sid}`;
  }

  function ensureSocket(): ChatSocket | null {
    const state = getState(BOT);

    // Si ya existe y está abierta, reutilízala
    if (state.ws && state.ws.readyState === WebSocket.OPEN) return state.ws;

    // Si ya se está conectando, devuelve la referencia actual
    if (state.connecting && state.ws) return state.ws;

    state.connecting = true;
    state.started = false;
    state.lineEl = null;

    const ws = new WebSocket(wsUrl(BOT)) as ChatSocket;
    ws.__isBotSocket = true;
    state.ws = ws;

    ws.onopen = () => {
      state.connecting = false;
      // Drena cola acumulada mientras “conectaba”
      for (const text of state.queue.splice(0)) {
        try {
          ws.send(JSON.stringify({ type: 'user_msg', text, sid: getSid(BOT) }));
        } catch {
          // Si falla el envío, que lo resuelva fallback en el próximo intento
        }
      }
    };

    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(String(ev.data));
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
      // si se cerró, permitimos re-conexión en el próximo envío
      state.ws = null;
      state.connecting = false;
      state.started = false;
      state.lineEl = null;
    };

    return ws;
  }

 async function sendViaHttp(text: string) {
  const sid = getSid(BOT);                 // ← Asegura SID
  const url = `${API}/api/chat/${encodeURIComponent(BOT)}`;
  const payload = { message: text, sid };  // ← Enviar SID

  // Debug útil para ver en consola del navegador
  console.log("[widget][POST]", url, payload);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.warn("[widget][POST] non-200", res.status, err);
      log.innerHTML += `<div><b>Bot:</b> error (${res.status})</div>`;
      return;
    }

    const data = await res.json();
    const reply = (data && (data.reply || data.text)) || '...';
    log.innerHTML += `<div><b>Bot:</b> ${reply}</div>`;
    log.scrollTop = log.scrollHeight;
  } catch (e) {
    console.error("[widget][POST] fetch error", e);
    log.innerHTML += `<div><b>Bot:</b> error</div>`;
  }
}


  function sendMessage(text: string) {
    const state = getState(BOT);
    const ws = ensureSocket();

    // Si ya está abierto, manda; si está conectando, encola
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({ type: 'user_msg', text, sid: getSid(BOT) }));
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
  }

  // ——— Eventos UI ———
  send.onclick = () => {
    const text = input.value.trim();
    if (!text) return;
    log.innerHTML += `<div><b>Tú:</b> ${text}</div>`;
    input.value = '';
    sendMessage(text);
  };

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      send.click();
    }
  });

  // Cierra sockets cuando cierras la pestaña (limpieza)
  window.addEventListener('beforeunload', () => {
    for (const [key, state] of globalSockets.entries()) {
      try { state.ws?.close(); } catch {}
      state.ws = null;
      state.connecting = false;
      state.started = false;
      state.lineEl = null;
    }
  });
})();
