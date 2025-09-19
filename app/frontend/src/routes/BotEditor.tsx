import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

export default function BotEditor(){
  const params = useParams()
  const id = params.id
  const [bot, setBot] = useState<any>({ name:'', prompt:'', allowedOrigins:'' })
  const isNew = id === 'new'

  useEffect(()=>{
    if(!isNew){
      fetch(`${import.meta.env.VITE_API_URL}/api/bots/${id}`, { credentials:'include' })
        .then(r=>r.json()).then(setBot)
    }
  },[id])

  async function save(){
    const method = isNew ? 'POST' : 'PUT'
    const url = isNew ? `${import.meta.env.VITE_API_URL}/api/bots` : `${import.meta.env.VITE_API_URL}/api/bots/${id}`
    const res = await fetch(url, {
      method, headers:{'Content-Type':'application/json'}, credentials:'include',
      body: JSON.stringify(bot)
    })
    if(res.ok){ window.location.href='/dashboard' } else { alert('Error guardando') }
  }

  async function showSnippet(){
    const res = await fetch(`${import.meta.env.VITE_API_URL}/api/bots/${id}/embed`, { credentials:'include' })
    const data = await res.json()
    alert(data.snippet)
  }

  return (
    <main className="container py-16 max-w-2xl">
      <h1 className="text-2xl font-bold mb-4">{isNew ? 'Nuevo Bot' : 'Editar Bot'}</h1>
      <div className="card flex flex-col gap-3">
        <label>Nombre</label>
        <input value={bot.name} onChange={e=>setBot({...bot, name:e.target.value})} />
        <label>Prompt</label>
        <textarea rows={6} value={bot.prompt} onChange={e=>setBot({...bot, prompt:e.target.value})} />
        <label>Allowed Origins (coma-separados)</label>
        <input value={bot.allowedOrigins} onChange={e=>setBot({...bot, allowedOrigins:e.target.value})} />
        <div className="flex gap-2">
          <button className="btn" onClick={save}>Guardar</button>
          {!isNew && <button className="btn bg-neutral-700 hover:bg-neutral-600" onClick={showSnippet}>Ver Snippet</button>}
        </div>
      </div>
    </main>
  )
}
