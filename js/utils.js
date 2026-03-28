// ============================================================
// js/utils.js — Funciones utilitarias comunes
// ============================================================
import { supabase } from './supabase.js';

// ── Utilidad: obtener usuario autenticado ─────────────────
export async function getUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// ── Protección de rutas: redirige si no hay sesión ────────
export async function requireAuth() {
  const user = await getUser();
  if (!user) {
    window.location.replace('/index.html');
  }
  return user;
}

// ── Formatear moneda peruana ──────────────────────────────
export function formatSoles(amount) {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN'
  }).format(amount);
}

// ── Formatear fecha legible ───────────────────────────────
export function formatFecha(isoString) {
  return new Date(isoString).toLocaleDateString('es-PE', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
}

// ── Mostrar Toast Bootstrap ───────────────────────────────
export function showToast(mensaje, tipo = 'success') {
  const toastEl = document.getElementById('appToast');
  const toastBody = document.getElementById('toastBody');
  if (!toastEl || !toastBody) return;
  toastEl.className = `toast align-items-center text-white bg-${tipo} border-0`;
  toastBody.textContent = mensaje;
  // asume que bootstrap está cargado globalmente en el HTML
  bootstrap.Toast.getOrCreateInstance(toastEl, { delay: 4000 }).show();
}

// ── Mostrar / ocultar spinner ─────────────────────────────
export function setLoading(show) {
  const el = document.getElementById('loadingSpinner');
  if (el) el.classList.toggle('d-none', !show);
}