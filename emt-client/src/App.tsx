import { useEffect, useState, type SubmitEvent } from 'react'
import './App.css'

type Incident = {
  patientName: string
  incidentAt: string
  location: string
  crewMember: string
  notes: string
  pulse: number
  systolic: number
  diastolic: number
  temperatureC: number
  respiratoryRate: number
  spo2: number
}

const QUEUE_KEY = 'emt-offline-queue'

const getApiBase = () => import.meta.env.VITE_API_BASE_URL ?? 'https://localhost:7112'

function App() {
  const [incident, setIncident] = useState<Incident>({
    patientName: '',
    incidentAt: new Date().toISOString().slice(0, 16),
    location: '',
    crewMember: '',
    notes: '',
    pulse: 80,
    systolic: 120,
    diastolic: 80,
    temperatureC: 36.7,
    respiratoryRate: 16,
    spo2: 98,
  })
  const [status, setStatus] = useState('Ready')
  const [queue, setQueue] = useState<Incident[]>([]) 
  const [online, setOnline] = useState(navigator.onLine)

  const loadQueue = () => {
    const raw = localStorage.getItem(QUEUE_KEY)
    if (!raw) return [] as Incident[]
    try { return JSON.parse(raw) as Incident[] } catch { return [] as Incident[] }
  }

  const saveQueue = (items: Incident[]) => {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(items))
    setQueue(items)
  }

  const syncQueue = async () => {
    const items = loadQueue()
    if (!items.length) return
    const api = `${getApiBase()}/api/incidents`
    try {
      for (const item of items) {
        await fetch(api, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...item, incidentAt: new Date(item.incidentAt).toISOString() }),
        })
      }
      saveQueue([])
      setStatus(`Synced ${items.length} incident(s)`)     
    } catch (error) {
      console.error('Sync failed', error)
      setStatus('Offline queue not synced yet')
    }
  }

  useEffect(() => {
    setQueue(loadQueue())
    const onOnline = () => { setOnline(true); setStatus('Back online'); syncQueue() }
    const onOffline = () => { setOnline(false); setStatus('Offline mode') }
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    if (navigator.onLine) syncQueue()
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(console.error)
    }
  }, [])

  const submit = async (event: SubmitEvent) => {
    event.preventDefault()
    const payload = { ...incident, incidentAt: new Date(incident.incidentAt).toISOString() }

    if (!navigator.onLine) {
      const updated = [...loadQueue(), payload]
      saveQueue(updated)
      setStatus('Saved offline; will sync when online')
      return
    }

    try {
      const response = await fetch(`${getApiBase()}/api/incidents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!response.ok) throw new Error('Save failed')
      setStatus('Incident submitted successfully')
      await syncQueue()
    } catch (error) {
      const updated = [...loadQueue(), payload]
      saveQueue(updated)
      setStatus('Submit failed online; queued offline')
    }
  }

  return (
    <main className="app">
      <header className="hero">
        <div>
          <p className="kicker">EMT Offline PWA</p>
          <h1>Rugged Tablet Incident Capture</h1>
          <p>Capture patient details and vital signs. Works offline and syncs when online.</p>
        </div>
        <div className={`badge ${online ? 'online' : 'offline'}`}>{online ? 'Online' : 'Offline'}</div>
      </header>

      <section className="card">
        <h2>Patient & Incident</h2>
        <form onSubmit={submit} className="form-grid">
          <label>Patient Name<input value={incident.patientName} onChange={(e) => setIncident((s) => ({ ...s, patientName: e.target.value }))} required/></label>
          <label>Incident Date/Time<input type="datetime-local" value={incident.incidentAt} onChange={(e) => setIncident((s) => ({ ...s, incidentAt: e.target.value }))} required/></label>
          <label>Location<input value={incident.location} onChange={(e) => setIncident((s) => ({ ...s, location: e.target.value }))} required/></label>
          <label>Crew Member<input value={incident.crewMember} onChange={(e) => setIncident((s) => ({ ...s, crewMember: e.target.value }))} required/></label>
          <label>Notes<textarea value={incident.notes} onChange={(e) => setIncident((s) => ({ ...s, notes: e.target.value }))} /></label>

          <label>Pulse<input type="number" value={incident.pulse} onChange={(e) => setIncident((s) => ({ ...s, pulse: Number(e.target.value) }))} required/></label>
          <label>Systolic<input type="number" value={incident.systolic} onChange={(e) => setIncident((s) => ({ ...s, systolic: Number(e.target.value) }))} required/></label>
          <label>Diastolic<input type="number" value={incident.diastolic} onChange={(e) => setIncident((s) => ({ ...s, diastolic: Number(e.target.value) }))} required/></label>
          <label>Temp (°C)<input type="number" step="0.1" value={incident.temperatureC} onChange={(e) => setIncident((s) => ({ ...s, temperatureC: Number(e.target.value) }))} required/></label>
          <label>Resp Rate<input type="number" value={incident.respiratoryRate} onChange={(e) => setIncident((s) => ({ ...s, respiratoryRate: Number(e.target.value) }))} required/></label>
          <label>SpO2<input type="number" value={incident.spo2} onChange={(e) => setIncident((s) => ({ ...s, spo2: Number(e.target.value) }))} required/></label>

          <button className="submit" type="submit">Save Incident</button>
        </form>
      </section>

      <section className="card">
        <h2>Offline Queue</h2>
        <p>{status}</p>
        <p>Queued incidents: {queue.length}</p>
        {queue.length > 0 && (
          <ul>
            {queue.map((inc, idx) => <li key={`${inc.patientName}-${idx}`}>{inc.patientName} at {new Date(inc.incidentAt).toLocaleString()}</li>)}
          </ul>
        )}
      </section>
    </main>
  )
}

export default App
