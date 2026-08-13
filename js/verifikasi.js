let ALL_PESERTA = [];
let ACTIVE_FILTER = 'ALL';

const FILTER_OPTIONS = [
  { key: 'ALL', label: 'Semua' },
  { key: 'PENDING', label: 'Menunggu Dokumen' },
  { key: 'NEED_REVIEW', label: 'Perlu Ditinjau' },
  { key: 'NEED_CORRECTION', label: 'Perlu Diperbaiki' },
  { key: 'VERIFIED', label: 'Terverifikasi' },
  { key: 'NOT_ELIGIBLE', label: 'Tidak Memenuhi Syarat' }
];

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
  document.querySelectorAll('.sidebar .nav-item[data-nav="soon"]').forEach(function (el) {
    el.addEventListener('click', function () { toast('Menu ini menyusul di fase berikutnya.'); });
  });

  renderFilterBar();
  await loadPeserta();

})();

function escapeHtml(str) {
  return String(str == null ? '' : str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function toast(msg, isError) {
  const el = document.createElement('div');
  el.className = 'toast' + (isError ? ' error' : '');
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(function () { el.remove(); }, 3800);
}

function renderFilterBar() {

  document.getElementById('filterBar').innerHTML = FILTER_OPTIONS.map(function (f) {
    return '<button class="filter-chip' + (f.key === ACTIVE_FILTER ? ' active' : '') + '" data-key="' + f.key + '">' + f.label + '</button>';
  }).join('');

  document.querySelectorAll('.filter-chip').forEach(function (btn) {
    btn.addEventListener('click', function () {
      ACTIVE_FILTER = btn.dataset.key;
      renderFilterBar();
      renderTable();
    });
  });
}

async function loadPeserta() {

  document.getElementById('pageSub').textContent = 'Memuat data peserta…';

  try {

    ALL_PESERTA = await callApi('getPesertaList', [{}]);
    document.getElementById('pageSub').textContent = ALL_PESERTA.length + ' peserta terdaftar dari seluruh sekolah.';
    renderTable();

  } catch (e) {
    document.getElementById('pesertaTable').innerHTML = '<div class="empty-note">Gagal memuat: ' + escapeHtml(e.message) + '</div>';
  }
}

function renderTable() {

  const el = document.getElementById('pesertaTable');

  const list = ACTIVE_FILTER === 'ALL'
    ? ALL_PESERTA
    : ALL_PESERTA.filter(function (p) { return p.StatusVerifikasi === ACTIVE_FILTER; });

  if (list.length === 0) {
    el.innerHTML = '<div class="empty-note">Tidak ada peserta pada kategori ini.</div>';
    return;
  }

  el.innerHTML =
    '<table class="data-table"><thead><tr>' +
      '<th>Nama</th><th>Sekolah / Barung</th><th>Usia</th><th>Status</th><th>Catatan</th><th></th>' +
    '</tr></thead><tbody>' +
    list.map(function (p) {
      return (
        '<tr>' +
          '<td><b>' + escapeHtml(p.NamaLengkap) + '</b></td>' +
          '<td>' + escapeHtml(p.SekolahID) + ' / ' + escapeHtml(p.BarungID) + '</td>' +
          '<td>' + p.UsiaTahun + ' th ' + p.UsiaBulan + ' bl</td>' +
          '<td><span class="pill" style="background:' + STATUS_COLOR[p.StatusVerifikasi] + '22;color:' + STATUS_COLOR[p.StatusVerifikasi] + '">' + STATUS_LABEL[p.StatusVerifikasi] + '</span></td>' +
          '<td style="max-width:220px;font-size:11.5px;color:var(--ink-600)">' + escapeHtml((p.CatatanVerifikasi || '-').substring(0, 90)) + '</td>' +
          '<td><button class="btn-secondary btn-sm" onclick="openDetail(\'' + p.ID + '\')">Detail</button></td>' +
        '</tr>'
      );
    }).join('') +
    '</tbody></table>';
}

async function openDetail(pesertaId) {

  const p = ALL_PESERTA.find(function (x) { return String(x.ID) === String(pesertaId); });
  if (!p) return;

  openModal('Detail Peserta', '<div class="loading-note">Memuat dokumen &amp; riwayat…</div>');

  try {

    const [docs, history] = await Promise.all([
      callApi('getDocumentsByPeserta', [pesertaId]),
      callApi('getVerificationHistory', [pesertaId])
    ]);

    const docsHtml = docs.length === 0
      ? '<div class="empty-note">Belum ada dokumen diunggah.</div>'
      : '<div class="doc-list">' + docs.map(function (d) {
          return '<div class="doc-item"><span>' + escapeHtml(d.JenisDokumen) + ' — ' + escapeHtml(d.OCRStatus) + '</span>' +
            '<button class="btn-secondary btn-sm" onclick="lihatDokumen(\'' + d.ID + '\')">Lihat</button></div>';
        }).join('') + '</div>';

    const historyHtml = history.length === 0
      ? '<div class="empty-note">Belum ada riwayat perubahan status.</div>'
      : '<div class="doc-list">' + history.map(function (h) {
          return '<div class="doc-item"><span>' + escapeHtml(h.StatusAwal) + ' → <b>' + escapeHtml(h.StatusAkhir) + '</b><br>' +
            '<span style="color:var(--ink-400)">' + escapeHtml(h.DiverifikasiOleh) + ' · ' + formatTanggalPendek(h.Timestamp) + '</span></span></div>';
        }).join('') + '</div>';

    const canReview = p.StatusVerifikasi !== 'NOT_ELIGIBLE';

    document.querySelector('.modal-box').innerHTML =
      '<h3>' + escapeHtml(p.NamaLengkap) + '</h3>' +
      '<p style="font-size:13px;color:var(--ink-600);margin-bottom:16px">' +
        'Usia: ' + p.UsiaTahun + ' tahun ' + p.UsiaBulan + ' bulan ' + p.UsiaHari + ' hari pada tanggal kegiatan · Status saat ini: ' +
        '<span class="pill" style="background:' + STATUS_COLOR[p.StatusVerifikasi] + '22;color:' + STATUS_COLOR[p.StatusVerifikasi] + '">' + STATUS_LABEL[p.StatusVerifikasi] + '</span>' +
      '</p>' +
      '<h4 style="font-size:13.5px;margin-bottom:8px">Dokumen</h4>' + docsHtml +
      '<h4 style="font-size:13.5px;margin:18px 0 8px">Riwayat Audit</h4>' + historyHtml +
      (canReview ? (
        '<h4 style="font-size:13.5px;margin:18px 0 8px">Review Manual</h4>' +
        '<form id="reviewForm" class="form-grid single">' +
          '<div><label>Ubah status menjadi</label><select id="rStatus">' +
            '<option value="VERIFIED">Terverifikasi</option>' +
            '<option value="NEED_REVIEW">Perlu Ditinjau</option>' +
            '<option value="NEED_CORRECTION">Perlu Diperbaiki</option>' +
          '</select></div>' +
          '<div><label>Catatan</label><input id="rCatatan" placeholder="Alasan perubahan status"></div>' +
          '<div class="modal-actions">' +
            '<button type="button" class="btn-secondary" onclick="jalankanRerun(\'' + pesertaId + '\')">🔄 Jalankan Ulang Otomatis</button>' +
            '<button type="submit" class="btn-primary" style="width:auto;padding:10px 20px">Simpan Review</button>' +
          '</div>' +
        '</form>'
      ) : '<div class="empty-note">Peserta ini tidak memenuhi syarat usia — status terkunci, tidak dapat direview manual.</div>') +
      '<div class="modal-actions"><button class="btn-secondary" onclick="closeModal()">Tutup</button></div>';

    if (canReview) {
      document.getElementById('reviewForm').addEventListener('submit', function (e) {
        e.preventDefault();
        submitReview(pesertaId, document.getElementById('rStatus').value, document.getElementById('rCatatan').value);
      });
    }

  } catch (e) {
    document.querySelector('.modal-box').innerHTML = '<div class="empty-note">Gagal memuat detail: ' + escapeHtml(e.message) + '</div>';
  }
}

async function lihatDokumen(documentId) {

  try {

    const doc = await callApi('getDokumenBase64', [documentId]);
    const win = window.open();
    win.document.write('<title>' + doc.filename + '</title>' +
      (doc.mimeType.indexOf('pdf') > -1
        ? '<embed src="data:' + doc.mimeType + ';base64,' + doc.base64 + '" width="100%" height="100%">'
        : '<img src="data:' + doc.mimeType + ';base64,' + doc.base64 + '" style="max-width:100%">'));

  } catch (e) {
    toast(e.message, true);
  }
}

async function submitReview(pesertaId, status, catatan) {

  try {

    await callApi('reviewPeserta', [pesertaId, status, catatan]);
    toast('Status berhasil diubah.');
    closeModal();
    await loadPeserta();

  } catch (e) {
    toast(e.message, true);
  }
}

async function jalankanRerun(pesertaId) {

  try {

    const hasil = await callApi('rerunVerifikasi', [pesertaId]);
    toast('Verifikasi ulang selesai: ' + STATUS_LABEL[hasil.status]);
    closeModal();
    await loadPeserta();

  } catch (e) {
    toast(e.message, true);
  }
}

function openModal(title, bodyHtml) {

  document.getElementById('modalRoot').innerHTML =
    '<div class="modal-overlay" id="modalOverlay">' +
      '<div class="modal-box"><h3>' + escapeHtml(title) + '</h3>' + bodyHtml + '</div>' +
    '</div>';

  document.getElementById('modalOverlay').addEventListener('click', function (e) {
    if (e.target.id === 'modalOverlay') closeModal();
  });
}

function closeModal() {
  document.getElementById('modalRoot').innerHTML = '';
}
