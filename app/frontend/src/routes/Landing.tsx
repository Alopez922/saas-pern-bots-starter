import React from 'react'
import { Link } from 'react-router-dom'

export default function Landing(){
  return (
    <main className="container py-16">
      <h1 className="text-4xl font-bold mb-4">Bots + Landing + Ads</h1>
      <p className="text-neutral-300 mb-8">Convierte clics en clientes con chatbots de IA, páginas que convierten y campañas rentables.</p>
      <div className="flex gap-3">
        <Link className="btn" to="/login">Ingresar</Link>
        <a className="btn bg-neutral-700 hover:bg-neutral-600" href="#features">Ver más</a>
      </div>
      <section id="features" className="grid md:grid-cols-3 gap-4 mt-12">
        <div className="card">Landing Pages</div>
        <div className="card">Google Ads</div>
        <div className="card">Widgets de Chat</div>
      </section>
    </main>
  )
}
