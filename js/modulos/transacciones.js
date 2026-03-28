// ============================================================
// js/modulos/transacciones.js — Lógica de Historial y Filtros
// ============================================================
import { supabase } from '../supabase.js';
import { requireAuth, formatSoles, formatFecha } from '../utils.js';

const user = await requireAuth();
document.getElementById('userName').textContent = user.user_metadata?.full_name?.split(' ')[0] || user.email;

document.getElementById('btnLogout').addEventListener('click', async () => {
  await supabase.auth.signOut();
  window.location.replace('/index.html');
});

// ── Cargar transacciones con filtros opcionales ────────
async function cargarTransacciones() {
  const tipo   = document.getElementById('filtroTipo').value;
  const desde  = document.getElementById('filtroDesde').value;
  const hasta  = document.getElementById('filtroHasta').value;

  let query = supabase
    .from('transacciones')
    .select(`*, cuentas(tipo, numero_cuenta)`)
    .eq('user_id', user.id)
    .order('fecha', { ascending: false })
    .limit(20);

  if (tipo)   query = query.eq('tipo', tipo);
  if (desde)  query = query.gte('fecha', desde);
  if (hasta)  query = query.lte('fecha', hasta + 'T23:59:59');

  const { data: txns, error } = await query;
  renderTabla(txns || []);
  renderResumen(txns || []);
}

function renderTabla(txns) {
  const tbody = document.getElementById('txnBody');
  if (txns.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">
      <i class="bi bi-inbox fs-2 d-block mb-2"></i>No se encontraron transacciones con esos filtros.
    </td></tr>`;
    return;
  }
  tbody.innerHTML = txns.map(t => `
    <tr>
      <td class="ps-3 text-muted small">${formatFecha(t.fecha)}</td>
      <td>
        <div class="d-flex align-items-center gap-2">
          <i class="bi ${t.tipo === 'debito' ? 'bi-arrow-up-right-circle text-danger' : 'bi-arrow-down-left-circle text-success'} fs-5"></i>
          <span class="fw-semibold small">${t.descripcion}</span>
        </div>
      </td>
      <td class="text-muted small">
        ${t.cuentas ? (t.cuentas.tipo === 'corriente' ? 'Cta. Corriente' : 'Cta. Ahorro') : '—'}
      </td>
      <td>
        <span class="badge ${t.tipo === 'debito' ? 'badge-debito' : 'badge-credito'} px-2 py-1">
          ${t.tipo === 'debito' ? 'Débito' : 'Crédito'}
        </span>
      </td>
      <td class="text-end pe-3">
        <span class="${t.tipo === 'debito' ? 'monto-debito' : 'monto-credito'} fw-bold">
          ${t.tipo === 'debito' ? '- ' : '+ '}${formatSoles(t.monto)}
        </span>
      </td>
    </tr>
  `).join('');
}

function renderResumen(txns) {
  const debitos  = txns.filter(t => t.tipo === 'debito').reduce((s, t)  => s + Number(t.monto), 0);
  const creditos = txns.filter(t => t.tipo === 'credito').reduce((s, t) => s + Number(t.monto), 0);
  const neto = creditos - debitos;
  document.getElementById('resTotal').textContent    = txns.length;
  document.getElementById('resDebitos').textContent  = formatSoles(debitos);
  document.getElementById('resCreditoss').textContent = formatSoles(creditos);
  const netoEl = document.getElementById('resNeto');
  netoEl.textContent = formatSoles(Math.abs(neto));
  netoEl.className   = `fw-bold fs-5 ${neto >= 0 ? 'text-success' : 'text-danger'}`;
}

// Eventos filtros
document.getElementById('btnFiltrar').addEventListener('click', cargarTransacciones);
document.getElementById('btnLimpiar').addEventListener('click', () => {
  document.getElementById('filtroTipo').value  = '';
  document.getElementById('filtroDesde').value = '';
  document.getElementById('filtroHasta').value = '';
  cargarTransacciones();
});

// Carga inicial
cargarTransacciones();