// ============================================================
// js/modulos/ahorro.js — Lógica de la Cuenta de Ahorro
// ============================================================
import { supabase } from '../supabase.js';
import { requireAuth, formatSoles, formatFecha } from '../utils.js';

const user = await requireAuth();
document.getElementById('userName').textContent = user.user_metadata?.full_name?.split(' ')[0] || user.email;

document.getElementById('btnLogout').addEventListener('click', async () => {
  await supabase.auth.signOut();
  window.location.replace('/index.html');
});

// ── Cargar cuenta de ahorro ────────────────────────────
const { data: ahorro } = await supabase
  .from('cuentas_ahorro').select('*')
  .eq('user_id', user.id)
  .single();

const { data: cuentaAhorro } = await supabase
  .from('cuentas').select('*')
  .eq('user_id', user.id)
  .eq('tipo', 'ahorro')
  .single();

document.getElementById('loadingAhorro').classList.add('d-none');
document.getElementById('contenidoAhorro').classList.remove('d-none');

if (ahorro) {
  const saldo = parseFloat(ahorro.saldo);
  const meta  = parseFloat(ahorro.meta_ahorro);
  const pct   = Math.min(Math.round((saldo / meta) * 100), 100);
  const falta = meta - saldo;

  document.getElementById('saldoAhorro').textContent   = formatSoles(saldo);
  document.getElementById('tasaAhorro').textContent    = `${ahorro.tasa_interes}%`;
  document.getElementById('fechaApertura').textContent = formatFecha(ahorro.fecha_apertura);
  document.getElementById('metaAhorro').textContent    = formatSoles(meta);

  // Barra de progreso
  document.getElementById('saldoProgreso').textContent  = formatSoles(saldo);
  document.getElementById('metaProgreso').textContent   = formatSoles(meta);
  document.getElementById('pctProgreso').textContent    = `${pct}%`;
  document.getElementById('faltaProgreso').textContent  = `Falta: ${formatSoles(Math.max(falta, 0))}`;
  document.getElementById('metaLabel').textContent      = `Meta: ${formatSoles(meta)}`;
  document.getElementById('barraProgreso').style.width  = `${pct}%`;
  document.getElementById('barraProgreso').textContent  = pct >= 10 ? `${pct}%` : '';

  // Número de cuenta enmascarado
  if (cuentaAhorro) {
    const num = cuentaAhorro.numero_cuenta;
    document.getElementById('numCuentaAhorro').textContent =
      `••• ••• ${num.slice(-4)}`;
  }

  // Proyección de crecimiento a 12 meses
  const tasaMensual = ahorro.tasa_interes / 100 / 12;
  let saldoProyectado = saldo;
  const filas = [];
  for (let mes = 1; mes <= 12; mes++) {
    const interes = saldoProyectado * tasaMensual;
    saldoProyectado += interes;
    const fecha = new Date();
    fecha.setMonth(fecha.getMonth() + mes);
    filas.push(`
      <tr>
        <td>${fecha.toLocaleDateString('es-PE', { month:'short', year:'numeric' })}</td>
        <td class="text-end fw-semibold">${formatSoles(saldoProyectado)}</td>
        <td class="text-end text-success">${formatSoles(interes)}</td>
      </tr>
    `);
  }
  document.getElementById('tablaProyeccion').innerHTML = filas.join('');
}

// ── Cargar movimientos de la cuenta de ahorro ─────────
if (cuentaAhorro) {
  const { data: movs } = await supabase
    .from('transacciones').select('*')
    .eq('user_id', user.id)
    .eq('cuenta_id', cuentaAhorro.id)
    .order('fecha', { ascending: false })
    .limit(10);

  const tbody = document.getElementById('movAhorro');
  if (movs && movs.length > 0) {
    tbody.innerHTML = movs.map(m => `
      <tr>
        <td class="ps-3 text-muted small">${formatFecha(m.fecha)}</td>
        <td class="fw-semibold small">${m.descripcion}</td>
        <td>
          <span class="badge ${m.tipo === 'debito' ? 'badge-debito' : 'badge-credito'} px-2 py-1">
            ${m.tipo === 'debito' ? 'Retiro' : 'Depósito'}
          </span>
        </td>
        <td class="text-end pe-3">
          <span class="${m.tipo === 'debito' ? 'monto-debito' : 'monto-credito'} fw-bold">
            ${m.tipo === 'debito' ? '- ' : '+ '}${formatSoles(m.monto)}
          </span>
        </td>
      </tr>
    `).join('');
  }
}