let QR_STATE = { sekolahId: null, barung: null, isPanitia: false };

(async function init() {

  const user = requireLoginOrRedirect();
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

  QR_STATE.isPanitia = PANITIA_ROLES_FE.indexOf(user.role) > -1;

  if (QR_STATE.isPanitia) {

    document.getElementById('navPanitiaOnly').style.display = 'block';
    document.getElementById('navRegistrasi').style.display = 'block';
    document.getElementById('navMonitoring').style.display = 'block';

    const select = document.getElementById('sekolahSelect');
    select.style.display = 'inline-block';

    const sekolahList = await callApi('getSekolahList', []);
    select.innerHTML = '<option value="">— Pilih sekolah —</option>' +
      sekolahList.map(function (s) { return '<option value="' + s.ID + '">' + escapeHtml(s.NamaSekolah) + '</option>'; }).join('');

    select.addEventListener('change', function () {
      if (select.value) { QR_STATE.sekolahId = select.value; loadBarungAndQr(); }
    });

    document.getElementById('pageSub').textContent = 'Pilih sekolah untuk melihat/membuat QR Barung-nya.';
    document.getElementById('content').innerHTML = '<div class="empty-note">Pilih sekolah di kanan atas.</div>';

  } else {

    QR_STATE.sekolahId = user.sekolahId;
    document.getElementById('pageSub').textContent = 'QR untuk registrasi Hari H, tunjukkan ke panitia saat tiba di lokasi.';
    await loadBarungAndQr();
  }

})();

function escapeHtml(str) {
  return String(str == null ? '' : str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function loadBarungAndQr() {

  const el = document.getElementById('content');
  el.innerHTML = '<div class="loading-note">Memuat…</div>';

  try {

    const barungList = await callApi('getBarungList', [QR_STATE.isPanitia ? QR_STATE.sekolahId : null]);
    const barung = barungList.find(function (b) { return String(b.SekolahID) === String(QR_STATE.sekolahId); });

    if (!barung) {
      el.innerHTML = '<div class="empty-note">Sekolah ini belum membuat Barung. Isi dulu di menu "Kelola Data Sekolah".</div>';
      return;
    }

    QR_STATE.barung = barung;

    if (!barung.QRValue) {

      el.innerHTML =
        '<div class="qr-card">' +
          '<h2>' + escapeHtml(barung.NamaBarung) + '</h2>' +
          '<div class="warna">Warna: ' + escapeHtml(barung.WarnaBarung) + '</div>' +
          '<div class="empty-note" style="margin-bottom:16px">QR belum dibuat.</div>' +
          '<button id="btnGenerate" class="btn-primary" style="width:auto;padding:12px 26px">🔳 Buat QR Barung</button>' +
        '</div>';

      document.getElementById('btnGenerate').addEventListener('click', onGenerate);

    } else {

      el.innerHTML =
        '<div class="qr-card">' +
          '<img src="' + barung.QRUrl + '" alt="QR ' + escapeHtml(barung.NamaBarung) + '">' +
          '<h2>' + escapeHtml(barung.NamaBarung) + '</h2>' +
          '<div class="warna">Warna: ' + escapeHtml(barung.WarnaBarung) + ' · Kode: ' + escapeHtml(barung.QRValue) + '</div>' +
          '<div style="display:flex;gap:10px;justify-content:center">' +
            '<button class="btn-secondary" onclick="window.print()">🖨️ Cetak</button>' +
            '<button id="btnRegenerate" class="btn-secondary">🔄 Buat Ulang</button>' +
          '</div>' +
        '</div>';

      document.getElementById('btnRegenerate').addEventListener('click', onGenerate);
    }

  } catch (e) {
    el.innerHTML = '<div class="empty-note">Gagal memuat: ' + escapeHtml(e.message) + '</div>';
  }
}

async function onGenerate() {

  try {
    await callApi('generateQrBarung', [QR_STATE.barung.ID]);
    await loadBarungAndQr();
  } catch (e) {
    alert(e.message);
  }
}
