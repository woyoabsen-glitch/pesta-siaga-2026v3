let SCANNER = null;
let SCAN_LOCK = false;

(async function init() {

  const user = requireLoginOrRedirect(PANITIA_ROLES_FE);
  if (!user) return;

  document.getElementById('roleTag').textContent = ROLE_LABEL[user.role] || user.role;
  document.getElementById('avatar').textContent = (user.nama || '?').charAt(0).toUpperCase();

  document.getElementById('logoutBtn').addEventListener('click', async function () {
    try { await callApi('logoutSession', []); } catch (e) {}
    Session.clear();
    window.location.href = 'index.html';
  });

  document.querySelectorAll('.sidebar .nav-item[data-href]').forEach(function (el) {
    el.addEventListener('click', function () { window.location.href = el.dataset.href; });
  });

  document.getElementById('btnManual').addEventListener('click', function () {
    const code = document.getElementById('manualCode').value.trim();
    if (code) handleScanResult(code);
  });

  startScanner();

})();

function escapeHtml(str) {
  return String(str == null ? '' : str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function startScanner() {

  try {

    SCANNER = new Html5Qrcode('qrReader');

    SCANNER.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 240, height: 240 } },
      function (decodedText) { handleScanResult(decodedText); },
      function () { /* frame tanpa QR, abaikan */ }
    ).catch(function (err) {
      document.getElementById('qrReader').innerHTML =
        '<div class="empty-note">Tidak bisa mengakses kamera: ' + escapeHtml(err.toString ? err.toString() : err) +
        '<br>Pastikan Anda mengizinkan akses kamera di browser, dan situs dibuka lewat HTTPS (GitHub Pages sudah HTTPS otomatis). Anda tetap bisa pakai kolom input manual di bawah.</div>';
    });

  } catch (e) {
    document.getElementById('qrReader').innerHTML = '<div class="empty-note">Kamera tidak didukung di perangkat/browser ini. Gunakan input manual.</div>';
  }
}

async function handleScanResult(qrValue) {

  if (SCAN_LOCK) return;
  SCAN_LOCK = true;

  if (SCANNER) {
    try { await SCANNER.pause(true); } catch (e) {}
  }

  const previewArea = document.getElementById('previewArea');
  previewArea.innerHTML = '<div class="loading-note">Memeriksa kode…</div>';

  try {

    const data = await callApi('scanQrBarung', [qrValue]);
    renderPreview(data);

  } catch (e) {

    previewArea.innerHTML = '<div class="preview-card" style="border-color:var(--red);background:#fef2f2">' + escapeHtml(e.message) + '</div>' +
      '<div style="text-align:center;margin-top:14px"><button class="btn-secondary" onclick="resumeScanner()">Scan Lagi</button></div>';
  }
}

function renderPreview(data) {

  const previewArea = document.getElementById('previewArea');

  const statusBadge = data.sudahTerdaftar
    ? '<span class="pill" style="background:#dcfce7;color:#15803d">Sudah Terdaftar</span>'
    : '<span class="pill" style="background:#fef3c7;color:#b45309">Belum Terdaftar</span>';

  previewArea.innerHTML =
    '<div class="preview-card">' +
      '<div class="row"><b>' + escapeHtml(data.namaBarung) + '</b>' + statusBadge + '</div>' +
      '<div class="row"><span>Sekolah</span><span>' + escapeHtml(data.namaSekolah) + '</span></div>' +
      '<div class="row"><span>Warna Barung</span><span>' + escapeHtml(data.warnaBarung) + '</span></div>' +
      '<div class="row"><span>Ketua Barung</span><span>' + escapeHtml(data.ketuaBarung) + '</span></div>' +
      '<div class="row"><span>Pendamping</span><span>' + escapeHtml(data.pendamping.join(', ') || '-') + '</span></div>' +
      '<div class="row"><span>Peserta</span><span>' + data.totalPeserta + ' (Terverifikasi: ' + data.verified + ')</span></div>' +
      (data.sudahTerdaftar ? '<div class="row"><span>Waktu Registrasi</span><span>' + formatTanggalPendek(data.waktuTerdaftar) + '</span></div>' : '') +
    '</div>' +
    '<div style="text-align:center;margin-top:14px;display:flex;gap:10px;justify-content:center">' +
      (data.sudahTerdaftar
        ? '<button class="btn-primary" style="width:auto;padding:12px 22px" onclick="bukaKehadiran(\'' + data.barungId + '\',\'' + escapeHtml(data.namaBarung).replace(/'/g, "\\'") + '\')">📋 Catat Kehadiran</button>'
        : '<button class="btn-primary" style="width:auto;padding:12px 22px" onclick="konfirmasiRegistrasi(\'' + data.barungId + '\')">✅ Konfirmasi Registrasi</button>') +
      '<button class="btn-secondary" onclick="resumeScanner()">Scan Lagi</button>' +
    '</div>' +
    '<div id="kehadiranArea"></div>';
}

async function konfirmasiRegistrasi(barungId) {

  try {

    await callApi('confirmRegistrasiHariH', [barungId]);
    toast('Barung berhasil didaftarkan hadir.');
    handleScanResult(barungId);

  } catch (e) {
    toast(e.message, true);
  }
}

async function bukaKehadiran(barungId, namaBarung) {

  const area = document.getElementById('kehadiranArea');
  area.innerHTML = '<div class="loading-note">Memuat daftar peserta…</div>';

  try {

    const list = await callApi('getAttendanceByBarung', [barungId]);

    area.innerHTML =
      '<h4 style="font-size:13.5px;margin:16px 0 8px">Kehadiran Peserta — ' + escapeHtml(namaBarung) + '</h4>' +
      '<div class="doc-list">' +
      list.map(function (p) {
        return (
          '<div class="doc-item">' +
            '<span>' + escapeHtml(p.Nama) + '</span>' +
            '<span style="display:flex;gap:6px">' +
              '<button class="btn-sm ' + (p.Kehadiran === 'Hadir' ? 'btn-primary' : 'btn-secondary') + '" style="padding:5px 10px" onclick="setKehadiran(\'' + p.ID + '\',\'Hadir\',\'' + barungId + '\',\'' + namaBarung.replace(/'/g, "\\'") + '\')">Hadir</button>' +
              '<button class="btn-sm ' + (p.Kehadiran === 'TidakHadir' ? 'btn-danger-outline' : 'btn-secondary') + '" style="padding:5px 10px" onclick="setKehadiran(\'' + p.ID + '\',\'TidakHadir\',\'' + barungId + '\',\'' + namaBarung.replace(/'/g, "\\'") + '\')">Tidak Hadir</button>' +
            '</span>' +
          '</div>'
        );
      }).join('') +
      '</div>';

  } catch (e) {
    area.innerHTML = '<div class="empty-note">Gagal memuat: ' + escapeHtml(e.message) + '</div>';
  }
}

async function setKehadiran(pesertaId, status, barungId, namaBarung) {

  try {
    await callApi('markKehadiran', [pesertaId, status]);
    await bukaKehadiran(barungId, namaBarung);
  } catch (e) {
    toast(e.message, true);
  }
}

async function resumeScanner() {

  document.getElementById('previewArea').innerHTML = '';
  SCAN_LOCK = false;

  if (SCANNER) {
    try { await SCANNER.resume(); } catch (e) {}
  }
}

function toast(msg, isError) {
  const el = document.createElement('div');
  el.className = 'toast' + (isError ? ' error' : '');
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(function () { el.remove(); }, 3800);
}
