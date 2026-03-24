Here it is — copy everything below:
jsximport { useState, useEffect, useCallback } from 'react'

const API = '/api'

const fmt   = d => d ? new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' }) : '—'
const fmtH  = n => Number(n || 0).toFixed(2)
const today = () => new Date().toISOString().split('T')[0]

function ppInfo(firstPP = '2026-02-22', firstPay = '2026-03-13') {
  const start = new Date(firstPP)
  const payStart = new Date(firstPay)
  const now = new Date(); now.setHours(0,0,0,0)
  const pp = Math.max(1, Math.ceil((now - start) / (14*24*60*60*1000)))
  const ps = new Date(start); ps.setDate(ps.getDate() + (pp-1)*14)
  const pe = new Date(ps);    pe.setDate(pe.getDate() + 13)
  const pd = new Date(payStart); pd.setDate(pd.getDate() + (pp-1)*14)
  return { pp, start: fmt(ps.toISOString().split('T')[0]), end: fmt(pe.toISOString().split('T')[0]), pay: fmt(pd.toISOString().split('T')[0]) }
}

const S = {
  app:    { fontFamily: 'system-ui, sans-serif', fontSize: 14, color: '#1a1a2e', maxWidth: 1100, margin: '0 auto', padding: '1rem' },
  topbar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: 12 },
  h1:     { fontSize: 18, fontWeight: 600, margin: 0 },
  tabs:   { display: 'flex', gap: 4, background: '#f0f4fa', borderRadius: 8, padding: 4 },
  tab:    a => ({ padding: '6px 16px', borderRadius: 6, border: a ? '1px solid #d0d8e8' : 'none', background: a ? '#fff' : 'transparent', cursor: 'pointer', fontSize: 13, fontWeight: a ? 600 : 400, color: a ? '#1a1a2e' : '#666' }),
  card:   { background: '#fff', border: '1px solid #e4e9f0', borderRadius: 12, padding: '1rem 1.25rem', marginBottom: '1rem' },
  kpis:   { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: '1.25rem' },
  kpi:    { background: '#f0f4fa', borderRadius: 8, padding: '0.85rem 1rem' },
  kLabel: { fontSize: 12, color: '#666', marginBottom: 5 },
  kVal:   c => ({ fontSize: 22, fontWeight: 600, color: c || '#1a1a2e' }),
  table:  { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th:     { textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid #d0d8e8', fontWeight: 600, color: '#555', fontSize: 12 },
  td:     { padding: '8px 10px', borderBottom: '1px solid #eef1f6', color: '#1a1a2e' },
  banner: { background: '#e6f4ea', border: '1px solid #b7dfc0', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#2e7d32', marginBottom: '1.25rem' },
  btn:    (v='default') => ({
    cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, padding: '7px 16px', borderRadius: 8,
    border: v==='primary' ? 'none' : '1px solid #d0d8e8',
    background: v==='primary' ? '#1b2a4a' : v==='danger' ? '#fdecea' : '#fff',
    color: v==='primary' ? '#fff' : v==='danger' ? '#c62828' : '#1a1a2e',
  }),
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  modal:   { background: '#fff', border: '1px solid #d0d8e8', borderRadius: 12, padding: '1.5rem', width: 480, maxWidth: '95vw' },
  frow:    { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: '1rem' },
  fg:      { display: 'flex', flexDirection: 'column', gap: 4 },
  label:   { fontSize: 12, color: '#555' },
  badge:   t => ({ display: 'inline-block', fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 600,
    background: t==='PTO' ? '#e3f2fd' : t==='Sick' ? '#fff9e6' : t==='low' ? '#fdecea' : '#e6f4ea',
    color:      t==='PTO' ? '#1565a5' : t==='Sick' ? '#7b5800' : t==='low' ? '#c62828' : '#2e7d32' }),
  alert:   t => ({ fontSize: 13, padding: '8px 12px', borderRadius: 8, marginBottom: '1rem',
    background: t==='success' ? '#e6f4ea' : '#fdecea',
    color:      t==='success' ? '#2e7d32' : '#c62828',
    border: `1px solid ${t==='success' ? '#b7dfc0' : '#f5c6c6'}` }),
}

const Input = ({ label, ...p }) => (
  <div style={S.fg}>
    {label && <label style={S.label}>{label}</label>}
    <input style={{ padding: '6px 10px', border: '1px solid #d0d8e8', borderRadius: 8, fontSize: 13, fontFamily: 'inherit' }} {...p} />
  </div>
)
const Select = ({ label, children, ...p }) => (
  <div style={S.fg}>
    {label && <label style={S.label}>{label}</label>}
    <select style={{ padding: '6px 10px', border: '1px solid #d0d8e8', borderRadius: 8, fontSize: 13, fontFamily: 'inherit' }} {...p}>{children}</select>
  </div>
)

export default function App() {
  const [tab, setTab]       = useState('dashboard')
  const [emps, setEmps]     = useState([])
  const [logs, setLogs]     = useState([])
  const [cfg, setCfg]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [alert, setAlert]   = useState(null)
  const [modal, setModal]   = useState(null)
  const [form, setForm]     = useState({})
  const [search, setSearch] = useState('')

  const showAlert = (msg, type='success') => { setAlert({ msg, type }); setTimeout(() => setAlert(null), 4000) }

  const load = useCallback(async () => {
    setLoading(true)
    const [e, l, c] = await Promise.all([
      fetch(`${API}/employees`).then(r => r.json()),
      fetch(`${API}/log`).then(r => r.json()),
      fetch(`${API}/config`).then(r => r.json()),
    ])
    setEmps(Array.isArray(e) ? e : [])
    setLogs(Array.isArray(l) ? l : [])
    setCfg(c || {})
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const pp = cfg ? ppInfo(cfg.first_pp_start) : ppInfo()

  const openAddEmp  = () => { setForm({ prior_pto: '0', prior_sick: '0' }); setModal('addEmp') }
  const openEditEmp = e  => { setForm({ ...e, hire_date: e.hire_date?.split('T')[0] || e.hire_date }); setModal('editEmp') }

  const saveEmp = async () => {
    if (!form.name || !form.emp_id || !form.hire_date) return showAlert('Name, ID, and hire date are required.', 'error')
    const body = { name: form.name, emp_id: form.emp_id, hire_date: form.hire_date, prior_pto: parseFloat(form.prior_pto)||0, prior_sick: parseFloat(form.prior_sick)||0 }
    const url  = modal === 'editEmp' ? `${API}/employees/${form.emp_id}` : `${API}/employees`
    const method = modal === 'editEmp' ? 'PATCH' : 'POST'
    const res  = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await res.json()
    if (!res.ok) return showAlert(data.error || 'Error saving.', 'error')
    setModal(null); showAlert(modal === 'editEmp' ? 'Employee updated.' : 'Employee added.'); load()
  }

  const deleteEmp = async (empId) => {
    if (!confirm('Delete this employee and all their log entries?')) return
    const res = await fetch(`${API}/employees/${empId}`, { method: 'DELETE' })
    if (!res.ok) return showAlert('Error deleting.', 'error')
    showAlert('Employee removed.'); load()
  }

  const openAddLog = () => { setForm({ leave_type: 'PTO', hours: '8', leave_date: today(), notes: '' }); setModal('addLog') }

  const saveLog = async () => {
    if (!form.emp_id || !form.leave_date || !form.hours) return showAlert('All fields are required.', 'error')
    const hrs  = parseFloat(form.hours)
    const emp  = emps.find(e => e.emp_id === form.emp_id)
    const avail = form.leave_type === 'PTO' ? emp?.pto_bal : emp?.sick_bal
    if (hrs > (avail || 0) + 0.01) {
      if (!confirm(`Warning: ${form.leave_type} balance is only ${fmtH(avail)} hrs. Save anyway?`)) return
    }
    const ppNum = Math.max(1, Math.ceil((new Date(form.leave_date) - new Date(cfg?.first_pp_start || '2026-02-22')) / (14*24*60*60*1000)))
    const body  = { emp_id: form.emp_id, leave_type: form.leave_type, hours: hrs, leave_date: form.leave_date, pay_period: ppNum, notes: form.notes }
    const res   = await fetch(`${API}/log`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data  = await res.json()
    if (!res.ok) return showAlert(data.error || 'Error saving.', 'error')
    setModal(null); showAlert(`${form.leave_type} logged for ${emp?.name} (${fmtH(hrs)} hrs).`); load()
  }

  const deleteLog = async (id) => {
    if (!confirm('Remove this log entry?')) return
    const res = await fetch(`${API}/log/${id}`, { method: 'DELETE' })
    if (!res.ok) return showAlert('Error removing.', 'error')
    showAlert('Entry removed.'); load()
  }

  const f = v => ({ ...form, ...v })

  const visEmps = emps.filter(e => !search || e.name.toLowerCase().includes(search.toLowerCase()) || e.emp_id.toLowerCase().includes(search.toLowerCase()))

  const totPTObal   = emps.reduce((s,e) => s + (e.pto_bal  || 0), 0)
  const totSickBal  = emps.reduce((s,e) => s + (e.sick_bal || 0), 0)
  const totPTOused  = emps.reduce((s,e) => s + (e.pto_used || 0), 0)
  const totSickUsed = emps.reduce((s,e) => s + (e.sick_used|| 0), 0)
  const lowCount    = emps.filter(e => e.pto_bal < 8 || e.sick_bal < 4).length

  return (
    <div style={S.app}>
      <div style={S.topbar}>
        <div>
          <div style={S.h1}>{cfg?.company_name || 'PTO & Sick Time Tracker'}</div>
          <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{new Date().toLocaleDateString('en-US', { weekday:'short', month:'long', day:'numeric', year:'numeric' })}</div>
        </div>
        <div style={S.tabs}>
          {['dashboard','employees','log','schedule'].map(t =>
            <button key={t} style={S.tab(tab===t)} onClick={() => setTab(t)}>
              {t.charAt(0).toUpperCase()+t.slice(1)}
            </button>
          )}
        </div>
      </div>

      {alert && <div style={S.alert(alert.type)}>{alert.msg}</div>}
      {loading && <div style={{ color:'#888', fontSize:13, marginBottom:'1rem' }}>Loading...</div>}

      {tab === 'dashboard' && <>
        <div style={S.banner}>
          Pay period #{pp.pp}: {pp.start} – {pp.end} &nbsp;·&nbsp; Pay date: <strong>{pp.pay}</strong>
        </div>
        <div style={S.kpis}>
          <div style={S.kpi}><div style={S.kLabel}>PTO balance (total)</div><div style={S.kVal('#185fa5')}>{fmtH(totPTObal)} hrs</div></div>
          <div style={S.kpi}><div style={S.kLabel}>Sick balance (total)</div><div style={S.kVal('#0f6e56')}>{fmtH(totSickBal)} hrs</div></div>
          <div style={S.kpi}><div style={S.kLabel}>PTO used (YTD)</div><div style={S.kVal('#ba7517')}>{fmtH(totPTOused)} hrs</div></div>
          <div style={S.kpi}><div style={S.kLabel}>Sick used (YTD)</div><div style={S.kVal('#ba7517')}>{fmtH(totSickUsed)} hrs</div></div>
          <div style={S.kpi}><div style={S.kLabel}>Low-balance alerts</div><div style={S.kVal(lowCount ? '#c62828' : '#2e7d32')}>{lowCount} emp</div></div>
          <div style={S.kpi}><div style={S.kLabel}>Active employees</div><div style={S.kVal()}>{emps.length}</div></div>
        </div>
        <div style={S.card}>
          <div style={{ fontSize:13, fontWeight:600, color:'#555', marginBottom:'0.75rem' }}>All employee balances</div>
          <div style={{ overflowX:'auto' }}>
            <table style={S.table}>
              <thead><tr>
                {['Employee','Hire date','Yrs','Prior PTO','New accrued','PTO used','PTO balance','Prior sick','Sick accrued','Sick used','Sick balance','Status'].map(h =>
                  <th key={h} style={S.th}>{h}</th>)}
              </tr></thead>
              <tbody>
                {emps.map(e => (
                  <tr key={e.emp_id}>
                    <td style={S.td}><strong>{e.name}</strong></td>
                    <td style={S.td}>{fmt(e.hire_date)}</td>
                    <td style={S.td}>{e.yrs_service}</td>
                    <td style={{ ...S.td, color:'#1565a5', fontWeight:600 }}>{fmtH(e.prior_pto)}</td>
                    <td style={S.td}>{fmtH(e.new_pto)}</td>
                    <td style={S.td}>{fmtH(e.pto_used)}</td>
                    <td style={{ ...S.td, fontWeight:600, color: e.pto_bal < 8 ? '#c62828' : '#2e7d32' }}>{fmtH(e.pto_bal)}</td>
                    <td style={{ ...S.td, color:'#1565a5', fontWeight:600 }}>{fmtH(e.prior_sick)}</td>
                    <td style={S.td}>{fmtH(e.new_sick)}</td>
                    <td style={S.td}>{fmtH(e.sick_used)}</td>
                    <td style={{ ...S.td, fontWeight:600, color: e.sick_bal < 4 ? '#c62828' : '#2e7d32' }}>{fmtH(e.sick_bal)}</td>
                    <td style={S.td}><span style={S.badge(e.pto_bal < 8 || e.sick_bal < 4 ? 'low' : 'ok')}>{e.pto_bal < 8 || e.sick_bal < 4 ? 'Low' : 'OK'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </>}

      {tab === 'employees' && <>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem', flexWrap:'wrap', gap:8 }}>
          <input placeholder="Search employees..." value={search} onChange={e => setSearch(e.target.value)}
            style={{ padding:'6px 12px', border:'1px solid #d0d8e8', borderRadius:8, fontSize:13, width:240 }} />
          <button style={S.btn('primary')} onClick={openAddEmp}>+ Add employee</button>
        </div>
        <div style={S.card}>
          <div style={{ overflowX:'auto' }}>
            <table style={S.table}>
              <thead><tr>
                {['Name','ID','Hire date','Yrs','Prior PTO','Prior sick','PTO balance','Sick balance',''].map(h =>
                  <th key={h} style={S.th}>{h}</th>)}
              </tr></thead>
              <tbody>
                {visEmps.map(e => (
                  <tr key={e.emp_id}>
                    <td style={S.td}><strong>{e.name}</strong></td>
                    <td style={{ ...S.td, color:'#888' }}>{e.emp_id}</td>
                    <td style={S.td}>{fmt(e.hire_date)}</td>
                    <td style={S.td}>{e.yrs_service}</td>
                    <td style={{ ...S.td, color:'#1565a5', fontWeight:600 }}>{fmtH(e.prior_pto)}</td>
                    <td style={{ ...S.td, color:'#1565a5', fontWeight:600 }}>{fmtH(e.prior_sick)}</td>
                    <td style={{ ...S.td, fontWeight:600, color: e.pto_bal < 8 ? '#c62828' : '#2e7d32' }}>{fmtH(e.pto_bal)}</td>
                    <td style={{ ...S.td, fontWeight:600, color: e.sick_bal < 4 ? '#c62828' : '#2e7d32' }}>{fmtH(e.sick_bal)}</td>
                    <td style={S.td}>
                      <div style={{ display:'flex', gap:6 }}>
                        <button style={S.btn()} onClick={() => openEditEmp(e)}>Edit</button>
                        <button style={S.btn('danger')} onClick={() => deleteEmp(e.emp_id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </>}

      {tab === 'log' && <>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem', flexWrap:'wrap', gap:8 }}>
          <div style={{ fontSize:13, color:'#666' }}>Add a row for each approved leave request</div>
          <button style={S.btn('primary')} onClick={openAddLog}>+ Log time off</button>
        </div>
        <div style={S.card}>
          {logs.length === 0
            ? <div style={{ textAlign:'center', color:'#888', fontSize:13, padding:'1.5rem 0' }}>No entries yet.</div>
            : <div style={{ overflowX:'auto' }}>
                <table style={S.table}>
                  <thead><tr>
                    {['#','Employee','Type','Hours','Date','Pay period','Notes',''].map(h => <th key={h} style={S.th}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {logs.map((l, i) => {
                      const emp = emps.find(e => e.emp_id === l.emp_id)
                      return (
                        <tr key={l.id}>
                          <td style={{ ...S.td, color:'#aaa' }}>{i+1}</td>
                          <td style={S.td}><strong>{emp?.name || l.emp_id}</strong></td>
                          <td style={S.td}><span style={S.badge(l.leave_type)}>{l.leave_type}</span></td>
                          <td style={{ ...S.td, fontWeight:600 }}>{fmtH(l.hours)}</td>
                          <td style={S.td}>{fmt(l.leave_date)}</td>
                          <td style={S.td}>PP #{l.pay_period}</td>
                          <td style={{ ...S.td, color:'#888' }}>{l.notes || '—'}</td>
                          <td style={S.td}><button style={S.btn('danger')} onClick={() => deleteLog(l.id)}>Remove</button></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
          }
        </div>
      </>}

      {tab === 'schedule' && <>
        <div style={S.card}>
          <div style={{ fontSize:13, fontWeight:600, color:'#555', marginBottom:'0.75rem' }}>26 bi-weekly pay periods starting 2/22/2026</div>
          <div style={{ overflowX:'auto' }}>
            <table style={S.table}>
              <thead><tr>
                {['PP #','Period start','Period end','Pay date','PTO rate 0–2 yrs','PTO rate 2–5 yrs','PTO rate 5+ yrs','Sick rate (all)'].map(h => <th key={h} style={S.th}>{h}</th>)}
              </tr></thead>
              <tbody>
                {Array.from({ length: 26 }, (_, i) => {
                  const firstPP  = new Date('2026-02-22')
                  const firstPay = new Date('2026-03-13')
                  const ps = new Date(firstPP);  ps.setDate(ps.getDate() + i*14)
                  const pe = new Date(ps);        pe.setDate(pe.getDate() + 13)
                  const pd = new Date(firstPay);  pd.setDate(pd.getDate() + i*14)
                  const now = new Date(); now.setHours(0,0,0,0)
                  const cur = ps <= now && now <= pe
                  return (
                    <tr key={i} style={cur ? { background:'#e6f4ea', fontWeight:600 } : {}}>
                      <td style={S.td}>{i+1}{cur && <span style={{ ...S.badge('ok'), marginLeft:6 }}>current</span>}</td>
                      <td style={S.td}>{fmt(ps.toISOString().split('T')[0])}</td>
                      <td style={S.td}>{fmt(pe.toISOString().split('T')[0])}</td>
                      <td style={S.td}>{fmt(pd.toISOString().split('T')[0])}</td>
                      <td style={S.td}>{cfg?.pto_rate_0_2 ?? 3.08}</td>
                      <td style={S.td}>{cfg?.pto_rate_2_5 ?? 4.62}</td>
                      <td style={S.td}>{cfg?.pto_rate_5p  ?? 6.15}</td>
                      <td style={S.td}>{cfg?.sick_rate    ?? 1.54}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </>}

      {(modal === 'addEmp' || modal === 'editEmp') && (
        <div style={S.overlay} onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div style={S.modal}>
            <h2 style={{ fontSize:16, fontWeight:600, marginBottom:'1.25rem' }}>{modal==='editEmp' ? 'Edit employee' : 'Add employee'}</h2>
            <div style={S.frow}>
              <Input label="Full name" value={form.name||''} onChange={e => setForm(f({ name: e.target.value }))} placeholder="Last, First" />
              <Input label="Employee ID" value={form.emp_id||''} onChange={e => setForm(f({ emp_id: e.target.value }))} placeholder="EMP-020" disabled={modal==='editEmp'} />
            </div>
            <div style={S.frow}>
              <Input label="Hire date" type="date" value={form.hire_date||''} onChange={e => setForm(f({ hire_date: e.target.value }))} />
              <Input label="Prior PTO balance (hrs)" type="number" step="0.01" value={form.prior_pto||0} onChange={e => setForm(f({ prior_pto: e.target.value }))} />
            </div>
            <div style={S.frow}>
              <Input label="Prior sick balance (hrs)" type="number" step="0.01" value={form.prior_sick||0} onChange={e => setForm(f({ prior_sick: e.target.value }))} />
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:'1.25rem' }}>
              <button style={S.btn()} onClick={() => setModal(null)}>Cancel</button>
              <button style={S.btn('primary')} onClick={saveEmp}>Save</button>
            </div>
          </div>
        </div>
      )}

      {modal === 'addLog' && (
        <div style={S.overlay} onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div style={S.modal}>
            <h2 style={{ fontSize:16, fontWeight:600, marginBottom:'1.25rem' }}>Log time off</h2>
            <div style={S.frow}>
              <Select label="Employee" value={form.emp_id||''} onChange={e => setForm(f({ emp_id: e.target.value }))}>
                <option value="">Select employee...</option>
                {emps.map(e => <option key={e.emp_id} value={e.emp_id}>{e.name}</option>)}
              </Select>
              <Select label="Leave type" value={form.leave_type||'PTO'} onChange={e => setForm(f({ leave_type: e.target.value }))}>
                <option value="PTO">PTO</option>
                <option value="Sick">Sick</option>
              </Select>
            </div>
            <div style={S.frow}>
              <Input label="Hours used" type="number" min="0.5" step="0.5" value={form.hours||8} onChange={e => setForm(f({ hours: e.target.value }))} />
              <Input label="Date of leave" type="date" value={form.leave_date||today()} onChange={e => setForm(f({ leave_date: e.target.value }))} />
            </div>
            <div style={S.frow}>
              <Input label="Notes / approver" value={form.notes||''} onChange={e => setForm(f({ notes: e.target.value }))} placeholder="Approved by..." />
            </div>
            {form.emp_id && (() => {
              const emp = emps.find(e => e.emp_id === form.emp_id)
              const bal = form.leave_type === 'PTO' ? emp?.pto_bal : emp?.sick_bal
              return <div style={{ fontSize:12, color:'#666', marginBottom:8 }}>{form.leave_type} balance: <strong>{fmtH(bal)} hrs</strong></div>
            })()}
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:'1.25rem' }}>
              <button style={S.btn()} onClick={() => setModal(null)}>Cancel</button>
              <button style={S.btn('primary')} onClick={saveLog}>Save entry</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
