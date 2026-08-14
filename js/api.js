/**
 * =========================================================
 *  PESTA SIAGA 2026 — Konfigurasi & Wrapper API
 * =========================================================
 *  GANTI nilai di bawah ini dengan URL Web App hasil Deploy
 *  Apps Script Anda (Fase 1 + Fase 2).
 *  Formatnya: https://script.google.com/macros/s/XXXXXXXX/exec
 * ========================================================= */

const CONFIG = {
  API_URL: 'https://script.google.com/macros/s/AKfycbyThXG-e88ZOMLXznF9V2BuS-dUF4jjTFlAiOr9meHkZdrvap8sORf98sbZiGT9E-VeAg/exec'
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
  SuperAdmin: 'Super Admin',
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

const PANITIA_ROLES_FE = ['SuperAdmin', 'PenanggungJawab', 'Ketua', 'Sekretaris'];

const WARNA_BARUNG_OPTIONS = [
  'Merah', 'Hijau', 'Abu-abu', 'Jingga', 'Coklat', 'Kuning',
  'Pink Lady', 'Ungu', 'Putih', 'Biru', 'Cappucino'
];

const WARNA_BARUNG_HEX = {
  'Merah': '#dc2626',
  'Hijau': '#16a34a',
  'Abu-abu': '#6b7280',
  'Jingga': '#f97316',
  'Coklat': '#7c4a1e',
  'Kuning': '#eab308',
  'Pink Lady': '#ec4899',
  'Ungu': '#7c3aed',
  'Putih': '#f8fafc',
  'Biru': '#2563eb',
  'Cappucino': '#b08968'
};

function warnaTeksKontras(hex) {
  // Putih & Kuning perlu teks gelap supaya tetap terbaca, sisanya teks putih.
  const terang = ['Putih', 'Kuning'];
  return terang.indexOf(Object.keys(WARNA_BARUNG_HEX).find(function (k) { return WARNA_BARUNG_HEX[k] === hex; })) > -1
    ? '#14261f' : '#ffffff';
}

const JABATAN_OPTIONS = ['Pinrung', 'Wapinrung', 'Anggota'];
const JABATAN_LABEL = { Pinrung: 'Pinrung (Pemimpin Barung)', Wapinrung: 'Wapinrung (Wakil Pemimpin)', Anggota: 'Anggota' };
const JABATAN_ORDER = { Pinrung: 0, Wapinrung: 1, Anggota: 2 };

function fileToBase64(file) {
  return new Promise(function (resolve, reject) {
    const reader = new FileReader();
    reader.onload = function () {
      const result = reader.result; // format: data:mime;base64,XXXX
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function formatTanggalPendek(tgl) {
  try {
    return new Date(tgl).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch (e) {
    return tgl || '-';
  }
}
