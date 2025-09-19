import React, { useState } from 'react'

export default function Register(){
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [name,setName]=useState('')

  async function onSubmit(e: React.FormEvent){
    e.preventDefault()
    const res = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/register`, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      credentials:'include',              // importante para la cookie
      body: JSON.stringify({ email, password, name })
    })
    if(res.ok){ window.location.href='/dashboard' } else { alert('Error registrando') }
  }

  return (
    <main className="container py-16 max-w-md">
      <h1 className="text-2xl font-bold mb-6">Crear cuenta</h1>
      <form onSubmit={onSubmit} className="card flex flex-col gap-3">
        <label>Nombre</label>
        <input value={name} onChange={e=>setName(e.target.value)} />
        <label>Email</label>
        <input value={email} onChange={e=>setEmail(e.target.value)} />
        <label>Contraseña</label>
        <input type="password" value={password} onChange={e=>setPassword(e.target.value)} />
        <button className="btn" type="submit">Registrarme</button>
      </form>
    </main>
  )
}
