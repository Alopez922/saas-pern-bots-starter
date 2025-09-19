// app/backend/src/embeds/embed.routes.js
import { Router } from 'express'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'   // <-- NUEVO

const router = Router()

// === Ruta absoluta al build del widget ===
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const widgetPath = path.resolve(__dirname, '../../widget/dist/widget.js')

router.get('/widget.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript')
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')
  res.setHeader('Cache-Control', 'no-store') // evita caché en dev

  if (fs.existsSync(widgetPath)) {
    // Sirve el bundle (debe contener `new WebSocket(`)
    res.send(fs.readFileSync(widgetPath, 'utf8'))
  } else {
    // -------- Fallback simple si aún no hay build --------
    res.send(`
(function(){
  // Encuentra el <script> del widget de forma robusta
  var script = document.currentScript 
    || (function(){
         var s = document.querySelector('script[src*="/api/embed/widget.js"][data-bot][data-server]');
         if(!s){
           var all = document.querySelectorAll('script[src]');
           for (var i=all.length-1;i>=0;i--){
             if (all[i].src.indexOf('/api/embed/widget.js')>-1) return all[i];
           }
         }
         return s;
       })();
  if(!script){ console.error('Widget: script tag not found'); return; }

  var API = script.getAttribute('data-server');
  var BOT = script.getAttribute('data-bot');
  if(!API || !BOT){ console.error('Widget: missing data-server or data-bot'); return; }

  var btn = document.createElement('button');
  btn.textContent = 'Chat';
  btn.style.position='fixed';btn.style.bottom='20px';btn.style.right='20px';
  btn.style.padding='10px 14px';btn.style.borderRadius='999px';btn.style.zIndex='99999';
  document.body.appendChild(btn);

  var box=document.createElement('div');
  box.style.position='fixed';box.style.bottom='70px';box.style.right='20px';
  box.style.width='360px';box.style.maxHeight='60vh';box.style.overflow='auto';
  box.style.background='#111';box.style.color='#fff';box.style.padding='12px';
  box.style.borderRadius='12px';box.style.display='none';box.style.zIndex='99999';
  var log=document.createElement('div');
  var input=document.createElement('input'); input.placeholder='Escribe...'; input.style.width='100%';
  var send=document.createElement('button'); send.textContent='Enviar';
  box.append(log,input,send); document.body.appendChild(box);

  btn.onclick=function(){ box.style.display = (box.style.display==='none'?'block':'none'); };

  // Handler con WebSocket + fallback HTTP
  send.onclick = async function(){
    var text = input.value.trim(); if(!text) return;
    log.innerHTML += '<div><b>Tú:</b> '+text+'</div>'; input.value='';

    // http(s) -> ws(s)
    var wsUrl = API.replace(/^http(s?):/, 'ws$1:') + '/ws/chat/' + BOT;
    var started = false;
    var lineEl = null;

    try{
      var ws = new WebSocket(wsUrl);

      ws.onopen = function(){
        ws.send(JSON.stringify({ type:'user_msg', text: text }));
      };

      ws.onmessage = function(ev){
        try{
          var data = JSON.parse(ev.data);
          if (data.type === 'bot_start') {
            started = true;
            lineEl = document.createElement('div');
            lineEl.id = 'ws_line';
            lineEl.innerHTML = '<b>Bot:</b> ';
            log.appendChild(lineEl);
          }
          if (data.type === 'bot_delta') {
            if (!lineEl) {
              lineEl = document.createElement('div');
              lineEl.id = 'ws_line';
              lineEl.innerHTML = '<b>Bot:</b> ';
              log.appendChild(lineEl);
            }
            lineEl.innerHTML += data.delta;
            log.scrollTop = log.scrollHeight;
          }
          if (data.type === 'bot_done') {
            if (lineEl) lineEl.id = '';
            ws.close();
          }
          if (data.type === 'bot_error') {
            log.innerHTML += '<div><b>Bot:</b> error</div>';
            ws.close();
          }
        }catch(e){ console.error(e); }
      };

      ws.onerror = function(){ if (!started) fallbackHttp() };
      ws.onclose  = function(){ if (!started) fallbackHttp() };

    }catch(e){
      console.error(e);
      fallbackHttp();
    }

    async function fallbackHttp(){
      try{
        var res = await fetch(API + '/api/chat/' + BOT, {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify({message:text})
        });
        var data = await res.json();
        log.innerHTML += '<div><b>Bot:</b> '+(data.reply||'...')+'</div>';
        log.scrollTop = log.scrollHeight;
      }catch(_){
        log.innerHTML += '<div><b>Bot:</b> error</div>';
      }
    }
  };
})();
    `)
  }
})

export default router
