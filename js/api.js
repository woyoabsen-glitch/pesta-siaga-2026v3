/**
 * =========================================================
 *  PESTA SIAGA 2026 — Konfigurasi & Wrapper API
 * =========================================================
 *  GANTI nilai di bawah ini dengan URL Web App hasil Deploy
 *  Apps Script Anda (Fase 1 + Fase 2).
 *  Formatnya: https://script.google.com/macros/s/XXXXXXXX/exec
 * ========================================================= */

const CONFIG = {
  API_URL: 'GANTI_DENGAN_URL_WEB_APP_ANDA'
};

const Session = {

  KEY_TOKEN: 'psiaga_token',
  KEY_USER: 'psiaga_user',

  save(token, user) {
    sessionStorage.setItem(this.KEY_TOKEN, token);
    sessionStorage.setItem(this.KEY_USER, JSON.stringify(user));
  },

  getToken() {
    return sessionStorage.getItem(this.KEY_TOKEN);
  },

  getUser() {
    const raw = sessionStorage.getItem(this.KEY_USER);
    return raw ? JSON.parse(raw) : null;
  },

  clear() {
    sessionStorage.removeItem(this.KEY_TOKEN);
    sessionStorage.removeItem(this.KEY_USER);
  },

  isLoggedIn() {
    return !!this.getToken();
  }
};

/**
 * Panggil satu action ke backend Apps Script.
 * @param {string} action - nama fungsi backend, misal 'login'
 * @param {Array} params - array argumen sesuai urutan handler
 * @param {boolean} withToken - true kalau butuh sesi login
 */
async function callApi(action, params, withToken = true) {

  if (CONFIG.API_URL.indexOf('GANTI_DENGAN') > -1) {
    throw new Error('CONFIG.API_URL belum diisi. Buka js/api.js dan isi URL Web App Anda.');
  }

  const body = {
    action: action,
    params: params || []
  };

  if (withToken) {
    body.token = Session.getToken();
  }

  const res = await fetch(CONFIG.API_URL, {
    method: 'POST',
    body: JSON.stringify(body)
  });

  const json = await res.json();

  if (json.status === 'ERROR') {

    // Sesi habis / tidak valid -> paksa kembali ke halaman login
    if (/[Ss]esi/.test(json.message)) {
      Session.clear();
      window.location.href = 'index.html';
    }

    throw new Error(json.message);
  }

  return json.data;
}

function requireLoginOrRedirect(allowedRoles) {

  if (!Session.isLoggedIn()) {
    window.location.href = 'index.html';
    return null;
  }

  const user = Session.getUser();

  if (allowedRoles && allowedRoles.indexOf(user.role) === -1) {
    alert('Halaman ini tidak tersedia untuk role Anda.');
    window.location.href = 'index.html';
    return null;
  }

  return user;
}

const ROLE_LABEL = {
  PenanggungJawab: 'Penanggung Jawab',
  Ketua: 'Ketua',
  Sekretaris: 'Sekretaris',
  Sekolah: 'Operator Sekolah'
};

const STATUS_LABEL = {
  PENDING: 'Menunggu Dokumen',
  VERIFIED: 'Terverifikasi',
  NEED_REVIEW: 'Perlu Ditinjau',
  NEED_CORRECTION: 'Perlu Diperbaiki',
  NOT_ELIGIBLE: 'Tidak Memenuhi Syarat'
};

const STATUS_COLOR = {
  PENDING: '#94a3b8',
  VERIFIED: '#22c55e',
  NEED_REVIEW: '#f59e0b',
  NEED_CORRECTION: '#f97316',
  NOT_ELIGIBLE: '#dc2626'
};
