import React, { useState } from 'react'

export default function Login(){
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')

  async function onSubmit(e: React.FormEvent){
    e.preventDefault()
    const res = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/login`,{
      method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include',
      body: JSON.stringify({ email, password })
    })
    if(res.ok){ window.location.href='/dashboard' } else { alert('Login error') }
  }

  return (
    <main className="container py-16 max-w-md">
      <h1 className="text-2xl font-bold mb-6">Ingresar</h1>
      <form onSubmit={onSubmit} className="card flex flex-col gap-3">
        <label>Email</label>
        <input value={email} onChange={e=>setEmail(e.target.value)} />
        <label>Contraseña</label>
        <input type="password" value={password} onChange={e=>setPassword(e.target.value)} />
        <button className="btn" type="submit">Entrar</button>
      </form>
    </main>
  )
}
