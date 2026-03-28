// ============================================================
// js/modulos/dashboard.js — Lógica del Dashboard
// ============================================================
import { supabase } from '../supabase.js';
import { requireAuth, formatSoles, formatFecha } from '../utils.js';

// ── Protección de ruta ─────────────────────────────────
const user = await requireAuth();

// Mostrar nombre del usuario
const nombreDisplay = user.user_metadata?.full_name?.split(' ')[0] || user.email;
document.getElementById('userName').textContent    = nombreDisplay;
document.getElementById('welcomeName').textContent = nombreDisplay;
document.getElementById('fechaHoy').textContent    =
  new Date().toLocaleDateString('es-PE', { weekday:'long', day:'numeric', month:'long', year:'numeric' });

// ── Logout ─────────────────────────────────────────────
document.getElementById('btnLogout').addEventListener('click', async () => {
  await supabase.auth.signOut();
  window.location.replace('/index.html');
});

// ── Cargar cuentas ─────────────────────────────────────
const { data: cuentas, error } = await supabase
  .from('cuentas')
  .select('*')
  .eq('user_id', user.id)
  .order('tipo');

const container = document.getElementById('cuentasContainer');

if (!cuentas || cuentas.length === 0) {
  container.innerHTML = `<div class="col-12">
    <div class="alert alert-info">No se encontraron cuentas asociadas.</div>
  </div>`;
} else {
  container.innerHTML = cuentas.map(c => `
    <div class="col-12 col-md-6 col-xl-4">
      <div class="card card-saldo p-3 ${c.tipo}">
        <div class="d-flex justify-content-between align-items-start mb-2">
          <div>
            <span class="badge ${c.tipo === 'corriente' ? 'bg-primary' : 'bg-success'} mb-1">
              ${c.tipo === 'corriente' ? 'Cuenta Corriente' : 'Cuenta de Ahorro'}
            </span>
            <div class="cuenta-numero">${maskCuenta(c.numero_cuenta)}</div>
          </div>
          <i class="bi ${c.tipo === 'corriente' ? 'bi-credit-card' : 'bi-piggy-bank'} fs-3 text-muted"></i>
        </div>
        <div class="monto">${formatSoles(c.saldo)}</div>
        <div class="text-muted small mt-1">${c.moneda} · Saldo disponible</div>
      </div>
    </div>
  `).join('');
}

// ── Cargar últimas 5 transacciones ────────────────────
const { data: txns } = await supabase
  .from('transacciones')
  .select('*')
  .eq('user_id', user.id)
  .order('fecha', { ascending: false })
  .limit(5);

const txnEl = document.getElementById('txnRecientes');
if (!txns || txns.length === 0) {
  txnEl.innerHTML = `<p class="text-muted text-center py-3">Sin movimientos recientes.</p>`;
} else {
  txnEl.innerHTML = `
    <div class="table-responsive">
      <table class="table table-hover mb-0">
        <tbody>
          ${txns.map(t => `
            <tr>
              <td class="ps-3">
                <div class="d-flex align-items-center gap-3">
                  <div class="rounded-circle d-flex align-items-center justify-content-center
                    ${t.tipo === 'debito' ? 'bg-danger' : 'bg-success'} bg-opacity-10"
                    style="width:36px;height:36px">
                    <i class="bi ${t.tipo === 'debito' ? 'bi-arrow-up-right text-danger' : 'bi-arrow-down-left text-success'}"></i>
                  </div>
                  <div>
                    <div class="fw-semibold small">${t.descripcion}</div>
                    <div class="text-muted" style="font-size:.75rem">${formatFecha(t.fecha)}</div>
                  </div>
                </div>
              </td>
              <td class="text-end pe-3 align-middle">
                <span class="${t.tipo === 'debito' ? 'monto-debito' : 'monto-credito'}">
                  ${t.tipo === 'debito' ? '- ' : '+ '}${formatSoles(t.monto)}
                </span>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>`;
}

// ── Enmascarar número de cuenta ───────────────────────
function maskCuenta(num) {
  if (!num) return '****';
  const parts = num.split('-');
  return parts.length > 1
    ? `••• - •••••• - ${parts[parts.length - 1].slice(-4)}`
    : `•••• •••• ${num.slice(-4)}`;
}