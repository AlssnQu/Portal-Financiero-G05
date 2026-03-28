// ============================================================
// js/modulos/pagos.js — Lógica de Pago de Servicios
// ============================================================
import { supabase } from '../supabase.js';
import { requireAuth, formatSoles, formatFecha, showToast } from '../utils.js';

const user = await requireAuth();
document.getElementById('userName').textContent = user.user_metadata?.full_name?.split(' ')[0] || user.email;

document.getElementById('btnLogout').addEventListener('click', async () => {
  await supabase.auth.signOut();
  window.location.replace('/index.html');
});

// ── Cargar cuentas del usuario ─────────────────────────
const { data: cuentas } = await supabase
  .from('cuentas').select('*').eq('user_id', user.id);

const selectCuenta = document.getElementById('cuentaOrigen');
if (cuentas && cuentas.length > 0) {
  selectCuenta.innerHTML = cuentas.map(c =>
    `<option value="${c.id}">${c.tipo === 'corriente' ? 'Cta. Corriente' : 'Cta. Ahorro'} — ${formatSoles(c.saldo)}</option>`
  ).join('');
}

// ── Submit formulario → abrir modal ────────────────────
const modal = new bootstrap.Modal(document.getElementById('modalConfirmar'));
let datosPago = null;

document.getElementById('formPago').addEventListener('submit', (e) => {
  e.preventDefault();
  const servicio  = document.querySelector('input[name="servicioRadio"]:checked')?.value;
  const contrato  = document.getElementById('contrato').value.trim();
  const monto     = parseFloat(document.getElementById('montoPago').value);
  const cuentaId  = document.getElementById('cuentaOrigen').value;
  const cuentaLabel = selectCuenta.options[selectCuenta.selectedIndex]?.text;

  if (!servicio) { alert('Selecciona un servicio.'); return; }
  if (!contrato) { alert('Ingresa el número de contrato.'); return; }
  if (!monto || monto <= 0) { alert('Ingresa un monto válido.'); return; }

  datosPago = { servicio, contrato, monto, cuentaId, cuentaLabel };

  // Llenar modal
  document.getElementById('confServicio').textContent = servicio.toUpperCase();
  document.getElementById('confContrato').textContent = contrato;
  document.getElementById('confMonto').textContent    = formatSoles(monto);
  document.getElementById('confCuenta').textContent   = cuentaLabel;

  modal.show();
});

// ── Confirmar y guardar pago ───────────────────────────
document.getElementById('btnConfirmarPago').addEventListener('click', async () => {
  if (!datosPago) return;

  document.getElementById('btnConfText').classList.add('d-none');
  document.getElementById('btnConfSpinner').classList.remove('d-none');

  const { error } = await supabase.from('pagos').insert({
    user_id:          user.id,
    servicio:         datosPago.servicio,
    numero_contrato:  datosPago.contrato,
    monto:            datosPago.monto,
    estado:           'completado'
  });

  document.getElementById('btnConfText').classList.remove('d-none');
  document.getElementById('btnConfSpinner').classList.add('d-none');
  modal.hide();

  if (error) {
    showToast('Error al procesar el pago. Intenta nuevamente.', 'danger');
    return;
  }

  showToast(`Pago de ${datosPago.servicio.toUpperCase()} realizado con éxito por ${formatSoles(datosPago.monto)}`, 'success');
  document.getElementById('formPago').reset();
  datosPago = null;
  cargarHistorial();
});

// ── Historial de pagos ─────────────────────────────────
async function cargarHistorial() {
  const { data: pagos } = await supabase
    .from('pagos').select('*')
    .eq('user_id', user.id)
    .order('fecha', { ascending: false })
    .limit(10);

  const el = document.getElementById('historialPagos');
  const iconos = { agua:'droplet', luz:'lightning', cable:'tv', telefono:'phone', gas:'fire' };

  if (!pagos || pagos.length === 0) {
    el.innerHTML = `<p class="text-muted text-center py-4">Sin pagos registrados aún.</p>`;
    return;
  }

  el.innerHTML = `
    <ul class="list-group list-group-flush">
      ${pagos.map(p => `
        <li class="list-group-item d-flex justify-content-between align-items-center px-3">
          <div class="d-flex align-items-center gap-3">
            <div class="rounded-circle bg-primary bg-opacity-10 d-flex align-items-center justify-content-center"
                 style="width:36px;height:36px">
              <i class="bi bi-${iconos[p.servicio] || 'receipt'} text-primary"></i>
            </div>
            <div>
              <div class="fw-semibold small text-capitalize">${p.servicio}</div>
              <div class="text-muted" style="font-size:.75rem">
                N° ${p.numero_contrato} · ${formatFecha(p.fecha)}
              </div>
            </div>
          </div>
          <div class="text-end">
            <div class="monto-debito fw-bold small">- ${formatSoles(p.monto)}</div>
            <span class="badge bg-success-subtle text-success" style="font-size:.7rem">Completado</span>
          </div>
        </li>
      `).join('')}
    </ul>`;
}

cargarHistorial();