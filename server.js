import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors());
app.use(express.json());

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

function payPeriodsCompleted(firstPPStart) {
  const start = new Date(firstPPStart);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((today - start) / (14 * 24 * 60 * 60 * 1000)));
}

function yearsOfService(hireDate) {
  return (new Date() - new Date(hireDate)) / (365.25 * 24 * 60 * 60 * 1000);
}

function ptoRateForEmployee(cfg) {
  // Same PTO rate for everyone
  return cfg.pto_rate;   // must match the column name in config
}
Yes — if you only want accrual on posted pay dates, then the current function is still not the best approach. It is counting time since hire, but what you actually want is to count how many pay dates have passed for that employee. Biweekly payroll is driven by recurring pay dates every 14 days, and counting posted pay dates directly is the clearest way to match that rule.

What to fix
Replace your current payPeriodsCompletedForEmployee function with this version:

js
function payPeriodsCompletedForEmployee(cfg, emp) {
  const companyStart = new Date(cfg.first_pp_start);   // e.g. 2026-02-22
  const hireDate = new Date(emp.hire_date);            // e.g. 2026-03-23
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const firstCompanyPay = new Date('2026-03-13');      // first known pay date
  const twoWeeks = 14 * 24 * 60 * 60 * 1000;

  const start = hireDate > companyStart ? hireDate : companyStart;

  let payDate = new Date(firstCompanyPay);
  let count = 0;

  while (payDate <= today) {
    const periodStart = new Date(companyStart);
    const periodsFromStart = Math.round((payDate - firstCompanyPay) / twoWeeks);
    periodStart.setDate(periodStart.getDate() + periodsFromStart * 14);

    const periodEnd = new Date(periodStart);
    periodEnd.setDate(periodEnd.getDate() + 13);

    // Count this pay date only if the employee was employed during that pay period
    if (hireDate <= periodEnd) {
      count++;
    }

    payDate.setDate(payDate.getDate() + 14);
  }

  return count;
}

  // Otherwise, count full periods since their start
  const diffMs = today - start;
  const pp = Math.max(0, Math.floor(diffMs / twoWeeks));
  return pp;
}
function calcAccruals(emp, cfg) {
  const pp   = payPeriodsCompletedForEmployee(cfg, emp);
  const rate = ptoRateForEmployee(cfg);  // no years-of-service logic
  const newPTO  = Math.min(rate * pp, cfg.pto_max  || 99999);
  const newSick = Math.min(cfg.sick_rate * pp, cfg.sick_max || 99999);
  return { pp, newPTO, newSick };
}

app.get('/api/config', async (req, res) => {
  const { data, error } = await supabase.from('config').select('*').single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.patch('/api/config', async (req, res) => {
  const { data, error } = await supabase.from('config').update(req.body).eq('id', 1).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.get('/api/employees', async (req, res) => {
  const [{ data: emps, error: e1 }, { data: cfg, error: e2 }, { data: logs, error: e3 }] =
    await Promise.all([
      supabase.from('employees').select('*').order('name'),
      supabase.from('config').select('*').single(),
      supabase.from('time_off_log').select('*'),
    ]);
  if (e1 || e2 || e3) return res.status(500).json({ error: e1?.message || e2?.message || e3?.message });

  const result = emps.map(emp => {
    const { pp, newPTO, newSick } = calcAccruals(emp, cfg);
    const ptoUsed  = logs.filter(l => l.emp_id === emp.emp_id && l.leave_type === 'PTO') .reduce((s, l) => s + Number(l.hours), 0);
    const sickUsed = logs.filter(l => l.emp_id === emp.emp_id && l.leave_type === 'Sick').reduce((s, l) => s + Number(l.hours), 0);
    const totalPTO  = Number(emp.prior_pto)  + newPTO;
    const totalSick = Number(emp.prior_sick) + newSick;
    return {
      ...emp,
      yrs_service: parseFloat(yearsOfService(emp.hire_date).toFixed(1)),
      pp_completed: pp,
      new_pto:   parseFloat(newPTO.toFixed(2)),
      new_sick:  parseFloat(newSick.toFixed(2)),
      total_pto:  parseFloat(totalPTO.toFixed(2)),
      total_sick: parseFloat(totalSick.toFixed(2)),
      pto_used:   parseFloat(ptoUsed.toFixed(2)),
      sick_used:  parseFloat(sickUsed.toFixed(2)),
      pto_bal:    parseFloat((totalPTO  - ptoUsed).toFixed(2)),
      sick_bal:   parseFloat((totalSick - sickUsed).toFixed(2)),
    };
  });
  res.json(result);
});

app.get('/api/employees/:empId', async (req, res) => {
  const { data, error } = await supabase.from('employees').select('*').eq('emp_id', req.params.empId).single();
  if (error) return res.status(404).json({ error: 'Not found' });
  res.json(data);
});

app.post('/api/employees', async (req, res) => {
  const { data, error } = await supabase.from('employees').insert(req.body).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

app.patch('/api/employees/:empId', async (req, res) => {
  const { data, error } = await supabase.from('employees').update(req.body).eq('emp_id', req.params.empId).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

app.delete('/api/employees/:empId', async (req, res) => {
  const { error } = await supabase.from('employees').delete().eq('emp_id', req.params.empId);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ ok: true });
});

app.get('/api/log', async (req, res) => {
  const { data, error } = await supabase.from('time_off_log').select('*').order('leave_date', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post('/api/log', async (req, res) => {
  const { data, error } = await supabase.from('time_off_log').insert(req.body).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

app.delete('/api/log/:id', async (req, res) => {
  const { error } = await supabase.from('time_off_log').delete().eq('id', req.params.id);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ ok: true });
});

app.use(express.static(path.join(__dirname, 'client/dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/dist/index.html'));
});

cron.schedule('0 6 * * 5', () => {
  console.log('[Cron] Payday check at', new Date().toISOString());
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`PTO Tracker running on port ${PORT}`));
