// ============================================================
// js/modulos/registro.js — Lógica de Registro de Usuario
// ============================================================
import { supabase } from '../supabase.js';

// Validación en tiempo real de contraseñas
document.getElementById('passwordConfirm').addEventListener('input', () => {
  const pwd     = document.getElementById('password').value;
  const confirm = document.getElementById('passwordConfirm').value;
  document.getElementById('pwdMismatch')
    .classList.toggle('d-none', pwd === confirm || confirm === '');
});

document.getElementById('formRegistro').addEventListener('submit', async (e) => {
  e.preventDefault();

  const nombre   = document.getElementById('nombre').value.trim();
  const email    = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const confirm  = document.getElementById('passwordConfirm').value;

  // Validar coincidencia de contraseñas
  if (password !== confirm) {
    document.getElementById('pwdMismatch').classList.remove('d-none');
    return;
  }

  // Spinner
  document.getElementById('btnText').classList.add('d-none');
  document.getElementById('btnSpinner').classList.remove('d-none');
  document.getElementById('alertError').classList.add('d-none');

  // Crear usuario en Supabase Auth
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: nombre }  // metadata del usuario
    }
  });

  document.getElementById('btnText').classList.remove('d-none');
  document.getElementById('btnSpinner').classList.add('d-none');

  if (error) {
    let msg = 'Error al crear la cuenta.';
    if (error.message.includes('already registered')) msg = 'Este correo ya está registrado.';
    document.getElementById('alertMsg').textContent = msg;
    document.getElementById('alertError').classList.remove('d-none');
    return;
  }

  // Éxito
  document.getElementById('alertSuccess').classList.remove('d-none');
  document.getElementById('formRegistro').reset();

  // Crear cuentas demo para el usuario recién registrado
  if (data.user) await crearCuentasDemo(data.user.id);
});

// ── Crea cuentas y transacciones de demostración ───────
async function crearCuentasDemo(userId) {
  // Cuenta corriente
  const { data: cc } = await supabase.from('cuentas').insert({
    user_id: userId,
    tipo: 'corriente',
    numero_cuenta: '019-' + Math.floor(Math.random() * 9000000 + 1000000),
    saldo: 4250.00,
    moneda: 'PEN'
  }).select().single();

  // Cuenta ahorro
  const { data: ca } = await supabase.from('cuentas').insert({
    user_id: userId,
    tipo: 'ahorro',
    numero_cuenta: '019-' + Math.floor(Math.random() * 9000000 + 1000000),
    saldo: 12875.50,
    moneda: 'PEN'
  }).select().single();

  // Cuenta de ahorro detalle
  await supabase.from('cuentas_ahorro').insert({
    user_id: userId,
    saldo: 12875.50,
    meta_ahorro: 20000,
    tasa_interes: 3.5,
    fecha_apertura: new Date().toISOString().split('T')[0]
  });

  // Transacciones de ejemplo
  const txns = [
    { user_id: userId, cuenta_id: cc.id, tipo: 'debito',  descripcion: 'Pago servicio agua SEDAPAL',      monto: 85.00 },
    { user_id: userId, cuenta_id: cc.id, tipo: 'credito', descripcion: 'Transferencia recibida',          monto: 500.00 },
    { user_id: userId, cuenta_id: cc.id, tipo: 'debito',  descripcion: 'Compra supermercado WONG',        monto: 230.50 },
    { user_id: userId, cuenta_id: cc.id, tipo: 'debito',  descripcion: 'Pago Netflix',                    monto: 39.90 },
    { user_id: userId, cuenta_id: cc.id, tipo: 'credito', descripcion: 'Depósito sueldo',                 monto: 3500.00 },
    { user_id: userId, cuenta_id: ca.id, tipo: 'credito', descripcion: 'Depósito ahorro programado',      monto: 1000.00 },
    { user_id: userId, cuenta_id: cc.id, tipo: 'debito',  descripcion: 'Pago luz ENEL',                   monto: 120.00 },
    { user_id: userId, cuenta_id: cc.id, tipo: 'credito', descripcion: 'Devolución compra',               monto: 150.00 },
  ];
  await supabase.from('transacciones').insert(txns);
}