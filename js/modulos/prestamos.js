import { supabase, requireAuth, formatSoles, formatFecha, showToast } from './supabase.js';

// 1. Inicialización y Seguridad
const user = await requireAuth();
const modalExito = new bootstrap.Modal(document.getElementById('modalExito'));
const modalEstado = new bootstrap.Modal(document.getElementById('modalEstado'));

document.getElementById('userName').textContent = user.user_metadata?.full_name?.split(' ')[0] || user.email;

// 2. Elementos del DOM
const form = document.getElementById('formPrestamo');
const btnSolicitar = document.getElementById('btnSolicitar');
const chkTerminos = document.getElementById('chkTerminos');
const inputIngresos = document.getElementById('ingresos');
const selectProposito = document.getElementById('proposito');
const divOtro = document.getElementById('divOtroProposito');

// 3. Persistencia Temporal (Cargar datos previos si existen)
window.addEventListener('load', () => {
    const saved = JSON.parse(localStorage.getItem('draft_prestamo'));
    if(saved) {
        document.getElementById('sliderMonto').value = saved.monto;
        document.getElementById('selectPlazo').value = saved.plazo;
        actualizarSimulacion();
    }
});

// 4. Lógica de Negocio: Amortización Francesa
function calcularCuotaFrancesa(P, annualRate, n) {
    const i = (annualRate / 100) / 12;
    if (i === 0) return P / n;
    return P * (i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1);
}

function actualizarSimulacion() {
    const monto = parseInt(document.getElementById('sliderMonto').value);
    const plazo = parseInt(document.getElementById('selectPlazo').value);
    const tasa = parseFloat(document.getElementById('selectTasa').value);
    const ingresos = parseFloat(inputIngresos.value) || 0;

    const cuota = calcularCuotaFrancesa(monto, tasa, plazo);
    
    // UI Updates
    document.getElementById('montoLabel').textContent = formatSoles(monto);
    document.getElementById('cuotaValor').textContent = formatSoles(cuota);

    // Validación de Capacidad de Pago (30% ingresos)
    const msgValidacion = document.getElementById('msgValidacionIngresos');
    if (ingresos > 0 && cuota > (ingresos * 0.30)) {
        msgValidacion.classList.remove('d-none');
    } else {
        msgValidacion.classList.add('d-none');
    }

    // Guardar borrador
    localStorage.setItem('draft_prestamo', JSON.stringify({monto, plazo}));
}

// 5. Eventos de Interacción
['sliderMonto', 'selectPlazo', 'selectTasa', 'ingresos'].forEach(id => {
    document.getElementById(id).addEventListener('input', actualizarSimulacion);
});

// Validar Checkbox para habilitar botón
chkTerminos.addEventListener('change', () => {
    btnSolicitar.disabled = !chkTerminos.checked;
});

// Lógica "Otro" propósito
selectProposito.addEventListener('change', () => {
    divOtro.classList.toggle('d-none', selectProposito.value !== 'otro');
});

// 6. Envío de Solicitud (Supabase)
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Validación de propósito obligatorio
    if (!selectProposito.value) {
        showToast("Por favor seleccione un propósito", "warning");
        return;
    }

    const monto = parseInt(document.getElementById('sliderMonto').value);
    const plazo = parseInt(document.getElementById('selectPlazo').value);
    const tasa = parseFloat(document.getElementById('selectTasa').value);
    const cuota = calcularCuotaFrancesa(monto, tasa, plazo);
    const finalProposito = selectProposito.value === 'otro' 
        ? document.getElementById('otroPropositoText').value 
        : selectProposito.value;

    btnSolicitar.disabled = true;
    btnSolicitar.textContent = "Procesando...";

    const { data, error } = await supabase.from('solicitudes_prestamo').insert({
        user_id: user.id,
        monto,
        plazo_meses: plazo,
        tasa_anual: tasa,
        cuota_mensual: parseFloat(cuota.toFixed(2)),
        proposito: finalProposito,
        estado: 'pendiente'
    }).select().single();

    if (error) {
        showToast("Error al guardar", "danger");
        btnSolicitar.disabled = false;
        return;
    }

    document.getElementById('numSolicitud').textContent = data.id.substring(0,8).toUpperCase();
    modalExito.show();
    form.reset();
    localStorage.removeItem('draft_prestamo');
    cargarHistorial();
});

// 7. Stepper de Estado
window.verEstado = (id, estado) => {
    const etapas = ['Recibido', 'En Evaluación', 'Verificación', 'Finalizado'];
    const currentStep = estado === 'pendiente' ? 1 : 3; // Lógica simplificada

    let html = '';
    etapas.forEach((nombre, index) => {
        const isActive = index <= currentStep ? 'active' : '';
        const isCompleted = index < currentStep ? '<i class="bi bi-check"></i>' : index + 1;
        html += `
            <div class="step-item ${isActive}">
                <div class="step-icon">${isCompleted}</div>
                <div class="step-text">${nombre}</div>
            </div>
        `;
    });
    document.getElementById('stepperContent').innerHTML = html;
    modalEstado.show();
};

// 8. Cargar Historial
async function cargarHistorial() {
    const { data } = await supabase.from('solicitudes_prestamo')
        .select('*').eq('user_id', user.id).order('created_at', {ascending: false});

    const container = document.getElementById('listaSolicitudes');
    if(!data.length) {
        container.innerHTML = '<p class="text-center p-3 small">No hay solicitudes.</p>';
        return;
    }

    container.innerHTML = data.map(s => `
        <div class="p-3 border-bottom d-flex justify-content-between align-items-center">
            <div>
                <div class="fw-bold small">${formatSoles(s.monto)}</div>
                <div class="text-muted" style="font-size: 11px">ID: ${s.id.substring(0,8)} | ${formatFecha(s.created_at)}</div>
            </div>
            <button class="btn btn-sm btn-light border" onclick="verEstado('${s.id}', '${s.estado}')">
                Ver Estado
            </button>
        </div>
    `).join('');
}

cargarHistorial();