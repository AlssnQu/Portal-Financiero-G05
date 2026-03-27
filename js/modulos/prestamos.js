import { supabase, requireAuth, formatSoles, formatFecha, showToast } from '../../js/supabase.js';
  /* ───────────────────────────────────────────────────────
     AUTH
  ─────────────────────────────────────────────────────── */
  const user = await requireAuth();
  document.getElementById('userName').textContent =
    user.user_metadata?.full_name?.split(' ')[0] || user.email;

  document.getElementById('btnLogout').addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.replace('/index.html');
  });

  /* ───────────────────────────────────────────────────────
     CLAVE PARA LOCALSTORAGE
  ─────────────────────────────────────────────────────── */
  const LS_KEY = `prestamo_simulacion_${user.id}`;

  /* ───────────────────────────────────────────────────────
     FÓRMULA DE AMORTIZACIÓN FRANCESA (RF-21)
     C = P × [r(1+r)^n] / [(1+r)^n - 1]
  ─────────────────────────────────────────────────────── */
  function calcularCuota(monto, plazoMeses, tasaAnual) {
    const r = (tasaAnual / 100) / 12;
    const n = plazoMeses;
    if (r === 0) return monto / n;
    const factor = Math.pow(1 + r, n);
    return monto * (r * factor) / (factor - 1);
  }

  /* ───────────────────────────────────────────────────────
     TABLA DE AMORTIZACIÓN
  ─────────────────────────────────────────────────────── */
  function generarTablaAmortizacion(monto, plazo, tasa) {
    const r     = (tasa / 100) / 12;
    const cuota = calcularCuota(monto, plazo, tasa);
    let saldo   = monto;
    const filas = [];

    for (let i = 1; i <= plazo; i++) {
      const interes  = saldo * r;
      const capital  = cuota - interes;
      saldo         -= capital;
      filas.push({
        num:      i,
        capital:  capital,
        interes:  interes,
        cuota:    cuota,
        saldo:    Math.max(0, saldo)
      });
    }
    return filas;
  }

  /* ───────────────────────────────────────────────────────
     GRÁFICO DE DISTRIBUCIÓN (Chart.js)
  ─────────────────────────────────────────────────────── */
  let chartInstancia = null;

  function actualizarGrafico(monto, total, intereses) {
    const ctx = document.getElementById('chartDistribucion').getContext('2d');
    const datos = {
      labels: ['Capital', 'Intereses'],
      datasets: [{
        data: [monto, intereses],
        backgroundColor: ['#3b82f6', '#f59e0b'],
        borderWidth: 0,
        hoverOffset: 8
      }]
    };
    if (chartInstancia) {
      chartInstancia.data = datos;
      chartInstancia.update();
    } else {
      chartInstancia = new Chart(ctx, {
        type: 'doughnut',
        data: datos,
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  const val = ctx.parsed;
                  const pct = ((val / total) * 100).toFixed(1);
                  return ` S/ ${val.toLocaleString('es-PE', { minimumFractionDigits: 2 })} (${pct}%)`;
                }
              }
            }
          },
          cutout: '65%'
        }
      });
    }
  }

  /* ───────────────────────────────────────────────────────
     VALIDACIÓN DE CAPACIDAD DE PAGO
     Regla: cuota no debe superar el 35% de los ingresos
  ─────────────────────────────────────────────────────── */
  const RATIO_MAXIMO = 0.35;

  function validarCapacidadPago(cuota, ingresos) {
    const alertEl  = document.getElementById('alertaIngresos');
    const textoEl  = document.getElementById('alertaIngresosTexto');
    if (!ingresos || ingresos <= 0) { alertEl.style.display = 'none'; return true; }

    const ratio   = cuota / ingresos;
    const maxCuota = ingresos * RATIO_MAXIMO;

    if (ratio > RATIO_MAXIMO) {
      const pct = (ratio * 100).toFixed(0);
      textoEl.innerHTML =
        `La cuota mensual representa el <strong>${pct}%</strong> de tus ingresos. ` +
        `Se recomienda que no supere el 35% (S/ ${formatSoles(maxCuota)} en tu caso). ` +
        `Considera reducir el monto o ampliar el plazo.`;
      alertEl.style.display = '';
      return false;
    }
    alertEl.style.display = 'none';
    return true;
  }

  /* ───────────────────────────────────────────────────────
     ACTUALIZAR SIMULADOR — tiempo real (RF-21, RF-22)
  ─────────────────────────────────────────────────────── */
  function actualizar() {
    const monto     = parseInt(document.getElementById('sliderMonto').value);
    const plazo     = parseInt(document.getElementById('selectPlazo').value);
    const tasa      = parseFloat(document.getElementById('selectTasa').value);
    const cuota     = calcularCuota(monto, plazo, tasa);
    const total     = cuota * plazo;
    const intereses = total - monto;

    // Mostrar resultados
    document.getElementById('montoLabel').textContent   = formatSoles(monto);
    document.getElementById('cuotaValor').textContent   = formatSoles(cuota);
    document.getElementById('totalPagar').textContent   = formatSoles(total);
    document.getElementById('totalInteres').textContent = formatSoles(intereses);

    // Sincronizar con formulario (RF-23)
    document.getElementById('solMonto').value = monto.toLocaleString('es-PE');
    document.getElementById('solPlazo').value = `${plazo} meses`;
    document.getElementById('solTasa').value  = `${tasa}% TEA`;
    document.getElementById('solCuota').value = cuota.toFixed(2);

    // Actualizar gráfico
    actualizarGrafico(monto, total, intereses);

    // Validar capacidad si ya hay ingreso ingresado
    const ingresos = parseFloat(document.getElementById('ingresos').value);
    if (ingresos > 0) validarCapacidadPago(cuota, ingresos);

    // ── MEJORA: Persistencia temporal en localStorage ──
    guardarEnLS({ monto, plazo, tasa });
  }

  // Escuchar cambios en tiempo real (RF-22)
  ['sliderMonto', 'selectPlazo', 'selectTasa'].forEach(id => {
    document.getElementById(id).addEventListener('input', actualizar);
  });

  // Revalidar capacidad de pago cuando cambie el campo de ingresos
  document.getElementById('ingresos').addEventListener('input', () => {
    const monto  = parseInt(document.getElementById('sliderMonto').value);
    const plazo  = parseInt(document.getElementById('selectPlazo').value);
    const tasa   = parseFloat(document.getElementById('selectTasa').value);
    const cuota  = calcularCuota(monto, plazo, tasa);
    const ingresos = parseFloat(document.getElementById('ingresos').value);
    validarCapacidadPago(cuota, ingresos);
  });

  /* ───────────────────────────────────────────────────────
     PERSISTENCIA TEMPORAL EN LOCALSTORAGE (MEJORA)
  ─────────────────────────────────────────────────────── */
  function guardarEnLS(datos) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(datos)); } catch (_) {}
  }

  function restaurarDesdeLS() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      const { monto, plazo, tasa } = JSON.parse(raw);
      if (monto) document.getElementById('sliderMonto').value = monto;
      if (plazo)  document.getElementById('selectPlazo').value = plazo;
      if (tasa)   document.getElementById('selectTasa').value  = tasa;
    } catch (_) {}
  }

  // Restaurar antes del primer cálculo
  restaurarDesdeLS();
  actualizar();

  /* ───────────────────────────────────────────────────────
     TABLA DE AMORTIZACIÓN — Modal
  ─────────────────────────────────────────────────────── */
  const modalAmort = new bootstrap.Modal(document.getElementById('modalAmortizacion'));

  document.getElementById('btnVerAmortizacion').addEventListener('click', () => {
    const monto = parseInt(document.getElementById('sliderMonto').value);
    const plazo = parseInt(document.getElementById('selectPlazo').value);
    const tasa  = parseFloat(document.getElementById('selectTasa').value);
    const cuota = calcularCuota(monto, plazo, tasa);
    const total = cuota * plazo;

    // Encabezado
    document.getElementById('encabezadoAmort').innerHTML =
      `<strong>Monto:</strong> ${formatSoles(monto)} &nbsp;|&nbsp;
       <strong>Plazo:</strong> ${plazo} meses &nbsp;|&nbsp;
       <strong>Tasa:</strong> ${tasa}% TEA &nbsp;|&nbsp;
       <strong>Cuota:</strong> ${formatSoles(cuota)} &nbsp;|&nbsp;
       <strong>Total:</strong> ${formatSoles(total)}`;

    // Filas
    const filas = generarTablaAmortizacion(monto, plazo, tasa);
    document.getElementById('tablaAmortBody').innerHTML = filas.map(f => `
      <tr>
        <td class="text-center">${f.num}</td>
        <td>${formatSoles(f.capital)}</td>
        <td>${formatSoles(f.interes)}</td>
        <td class="fw-semibold">${formatSoles(f.cuota)}</td>
        <td>${formatSoles(f.saldo)}</td>
      </tr>
    `).join('');

    modalAmort.show();
  });

  document.getElementById('btnImprimir').addEventListener('click', () => {
    window.print();
  });

  /* ───────────────────────────────────────────────────────
     ENVIAR SOLICITUD (RF-24, RF-25)
  ─────────────────────────────────────────────────────── */
  const modalExito = new bootstrap.Modal(document.getElementById('modalExito'));

  document.getElementById('formPrestamo').addEventListener('submit', async (e) => {
    e.preventDefault();

    // ── FIX: Validar checkbox de términos ──
    const chkTerminos = document.getElementById('chkTerminos');
    const chkError    = document.getElementById('chkError');
    if (!chkTerminos.checked) {
      chkError.classList.remove('d-none');
      chkTerminos.focus();
      return;
    }
    chkError.classList.add('d-none');

    const proposito = document.getElementById('proposito').value;
    const ingresos  = parseFloat(document.getElementById('ingresos').value);
    const monto     = parseInt(document.getElementById('sliderMonto').value);
    const plazo     = parseInt(document.getElementById('selectPlazo').value);
    const tasa      = parseFloat(document.getElementById('selectTasa').value);
    const cuota     = calcularCuota(monto, plazo, tasa);

    // Validar propósito
    if (!proposito) {
      showToast('Selecciona el propósito del préstamo.', 'warning');
      document.getElementById('proposito').focus();
      return;
    }

    // Validar ingresos requeridos
    if (!ingresos || ingresos <= 0) {
      showToast('Ingresa tus ingresos mensuales.', 'warning');
      document.getElementById('ingresos').focus();
      return;
    }

    // Advertencia de capacidad de pago: bloquear si excede el 35%
    if (!validarCapacidadPago(cuota, ingresos)) {
      showToast('La cuota supera el 35% de tus ingresos. Ajusta el monto o el plazo.', 'danger');
      return;
    }

    // Mostrar spinner
    document.getElementById('btnSolText').classList.add('d-none');
    document.getElementById('btnSolSpinner').classList.remove('d-none');

    // Insertar en Supabase (RF-24)
    const { data, error } = await supabase
      .from('solicitudes_prestamo')
      .insert({
        user_id:       user.id,
        monto,
        plazo_meses:   plazo,
        tasa_anual:    tasa,
        cuota_mensual: parseFloat(cuota.toFixed(2)),
        proposito,
        estado:        'pendiente'
      })
      .select()
      .single();

    document.getElementById('btnSolText').classList.remove('d-none');
    document.getElementById('btnSolSpinner').classList.add('d-none');

    if (error) {
      showToast('Error al enviar la solicitud. Intenta nuevamente.', 'danger');
      return;
    }

    // Mostrar modal de éxito con UUID (RF-25)
    document.getElementById('numSolicitud').textContent = data.id.slice(0, 8).toUpperCase();
    document.getElementById('exitoMonto').textContent   = formatSoles(monto);
    document.getElementById('exitoCuota').textContent   = formatSoles(cuota);
    modalExito.show();

    // Limpiar y refrescar
    document.getElementById('formPrestamo').reset();
    chkTerminos.checked = false;
    document.getElementById('alertaIngresos').style.display = 'none';
    // Limpiar LS ya que la solicitud fue enviada
    try { localStorage.removeItem(LS_KEY); } catch (_) {}
    actualizar();
    cargarSolicitudes();
  });

  /* ───────────────────────────────────────────────────────
     MODAL DE ESTADO — Etapas del proceso (MEJORA)
  ─────────────────────────────────────────────────────── */
  const ETAPAS = [
    { clave: 'recibida',   label: 'Solicitud recibida',     desc: 'Tu solicitud ingresó al sistema.' },
    { clave: 'revision',   label: 'En revisión',            desc: 'Estamos verificando tu información.' },
    { clave: 'evaluacion', label: 'En evaluación',          desc: 'Análisis de riesgo crediticio en curso.' },
    { clave: 'decision',   label: 'Decisión',               desc: 'Se emitirá una respuesta pronto.' },
    { clave: 'resultado',  label: 'Aprobado / Rechazado',   desc: 'Te notificaremos por correo.' }
  ];

  // Mapa: estado BD → índice de etapa activa
  const ESTADO_ETAPA = {
    pendiente:  2, // "En evaluación"
    aprobado:   4,
    rechazado:  4
  };

  const ESTADO_COLOR = {
    pendiente:  'warning',
    aprobado:   'success',
    rechazado:  'danger'
  };

  const ESTADO_LABEL = {
    pendiente:  'En evaluación',
    aprobado:   'Aprobado',
    rechazado:  'Rechazado'
  };

  function renderEtapas(estadoBD) {
    const etapaActiva = ESTADO_ETAPA[estadoBD] ?? 2;
    const esRechazado = estadoBD === 'rechazado';
    let html = '';

    ETAPAS.forEach((etapa, idx) => {
      let claseIcono, icono;
      if (idx < etapaActiva) {
        claseIcono = 'completada';
        icono = 'bi-check-lg';
      } else if (idx === etapaActiva) {
        claseIcono = esRechazado ? 'pendiente-e' : 'activa';
        icono = esRechazado ? 'bi-x-lg' : 'bi-hourglass-split';
      } else {
        claseIcono = 'pendiente-e';
        icono = 'bi-circle';
      }

      const lineaClase = idx < etapaActiva ? 'completada' : '';
      const labelExtra = idx === etapaActiva
        ? `<span class="badge bg-${ESTADO_COLOR[estadoBD]} ms-2" style="font-size:.65rem">${ESTADO_LABEL[estadoBD]}</span>`
        : '';

      html += `
        <div class="etapa-item">
          <div class="d-flex flex-column align-items-center">
            <div class="etapa-icono ${claseIcono}">
              <i class="bi ${icono}"></i>
            </div>
            ${idx < ETAPAS.length - 1 ? `<div class="etapa-linea ${lineaClase}"></div>` : ''}
          </div>
          <div class="pt-1">
            <div class="small fw-semibold">${etapa.label} ${labelExtra}</div>
            <div class="text-muted" style="font-size:.75rem">${etapa.desc}</div>
          </div>
        </div>`;
    });

    return html;
  }

  const modalEstado   = new bootstrap.Modal(document.getElementById('modalEstado'));
  let solicitudActual = null;

  function abrirModalEstado(sol) {
    solicitudActual = sol;
    document.getElementById('estadoNumSolicitud').textContent = sol.id.slice(0, 8).toUpperCase();
    document.getElementById('estadoMonto').textContent        = formatSoles(sol.monto);
    document.getElementById('estadoFecha').textContent        = formatFecha(sol.created_at);
    document.getElementById('etapasContainer').innerHTML      = renderEtapas(sol.estado);
    modalEstado.show();
  }

  /* ───────────────────────────────────────────────────────
     HISTORIAL DE SOLICITUDES (MEJORA: botón "Ver estado")
  ─────────────────────────────────────────────────────── */
  async function cargarSolicitudes() {
    const { data: sols } = await supabase
      .from('solicitudes_prestamo')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5);

    const el = document.getElementById('listaSolicitudes');

    if (!sols || sols.length === 0) {
      el.innerHTML = `<p class="text-muted text-center py-3 small">Sin solicitudes previas.</p>`;
      return;
    }

    el.innerHTML = `
      <ul class="list-group list-group-flush">
        ${sols.map(s => `
          <li class="list-group-item d-flex justify-content-between align-items-center px-3"
              data-id="${s.id}">
            <div>
              <div class="fw-semibold small">${formatSoles(s.monto)} · ${s.plazo_meses} meses</div>
              <div class="text-muted" style="font-size:.75rem">
                ID: ${s.id.slice(0, 8).toUpperCase()} · ${formatFecha(s.created_at)}
              </div>
            </div>
            <button class="btn btn-sm btn-outline-secondary btn-ver-estado"
                    data-sol='${JSON.stringify(s)}'>
              <i class="bi bi-activity me-1"></i>Ver estado
            </button>
          </li>
        `).join('')}
      </ul>`;

    // Delegación de eventos para botones "Ver estado"
    el.querySelectorAll('.btn-ver-estado').forEach(btn => {
      btn.addEventListener('click', () => {
        const sol = JSON.parse(btn.dataset.sol);
        abrirModalEstado(sol);
      });
    });
  }

  cargarSolicitudes();