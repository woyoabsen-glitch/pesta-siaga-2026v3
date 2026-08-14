let LAPORAN_PESERTA = [];
let LAPORAN_SEKOLAH = [];

(async function init() {

  const user = requireLoginOrRedirect(PANITIA_ROLES_FE);
  if (!user) return;

  document.getElementById('roleTag').textContent = ROLE_LABEL[user.role] || user.role;
  document.getElementById('avatar').textContent = (user.nama || '?').charAt(0).toUpperCase();
  document.getElementById('printDate').textContent = new Date().toLocaleString('id-ID');

  document.getElementById('logoutBtn').addEventListener('click', async function () {
    try { await callApi('logoutSession', []); } catch (e) {}
    Session.clear();
    window.location.href = 'index.html';
  });

  document.querySelectorAll('.sidebar .nav-item[data-href]').forEach(function (el) {
    el.addEventListener('click', function () { window.location.href = el.dataset.href; });
  });

  document.getElementById('printBtn').addEventListener('click', function () { window.print(); });
  document.getElementById('exportCsvBtn').addEventListener('click', exportCsv);

  await loadData();

})();

function escapeHtml(str) {
  return String(str == null ? '' : str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function loadData() {

  document.getElementById('pageSub').textContent = 'Memuat data…';

  try {

    const [summary, sekolahList, barungList, pesertaList, pendampingList] = await Promise.all([
      callApi('getDashboardSummary', []),
      callApi('getSekolahList', []),
      callApi('getBarungList', [null]),
      callApi('getPesertaList', [{}]),
      callApi('getPendampingList', [null])
    ]);

    LAPORAN_PESERTA = pesertaList;
    LAPORAN_SEKOLAH = sekolahList;

    document.getElementById('pageSub').textContent = pesertaList.length + ' peserta dari ' + sekolahList.length + ' sekolah';

    renderSummary(summary);
    renderRekapSekolah(sekolahList, barungList, pesertaList, pendampingList);
    renderPesertaDetail(pesertaList, sekolahList, barungList);

  } catch (e) {
    document.getElementById('pageSub').textContent = 'Gagal memuat: ' + e.message;
  }
}

function renderSummary(summary) {

  document.getElementById('summaryGrid').innerHTML = [
    { icon: '🏫', bg: '#e0f2f1', color: '#0f766e', label: 'Sekolah', value: summary.totalSekolah },
    { icon: '🎪', bg: '#fef3c7', color: '#b45309', label: 'Barung', value: summary.totalBarung },
    { icon: '🧒', bg: '#dbeafe', color: '#1d4ed8', label: 'Peserta', value: summary.totalPeserta },
    { icon: '✅', bg: '#dcfce7', color: '#15803d', label: 'Terverifikasi', value: summary.statusVerifikasi.VERIFIED },
    { icon: '⚠️', bg: '#ffedd5', color: '#c2410c', label: 'Perlu Diperbaiki', value: summary.statusVerifikasi.NEED_CORRECTION },
    { icon: '🚫', bg: '#fee2e2', color: '#b91c1c', label: 'Tidak Memenuhi Syarat', value: summary.statusVerifikasi.NOT_ELIGIBLE }
  ].map(function (c) {
    return '<div class="stat-card"><div class="icon" style="background:' + c.bg + ';color:' + c.color + '">' + c.icon + '</div>' +
      '<div class="value">' + c.value + '</div><div class="label">' + c.label + '</div></div>';
  }).join('');
}

function renderRekapSekolah(sekolahList, barungList, pesertaList, pendampingList) {

  const el = document.getElementById('rekapSekolah');

  el.innerHTML =
    '<table class="data-table"><thead><tr>' +
      '<th>Sekolah</th><th>Barung</th><th>Pendamping</th><th>Peserta</th><th>Terverifikasi</th><th>Perlu Tindakan</th>' +
    '</tr></thead><tbody>' +
    sekolahList.map(function (s) {

      const barung = barungList.find(function (b) { return String(b.SekolahID) === String(s.ID); });
      const pendampingCount = pendampingList.filter(function (p) { return String(p.SekolahID) === String(s.ID); }).length;
      const pesertaSekolah = pesertaList.filter(function (p) { return String(p.SekolahID) === String(s.ID); });
      const verified = pesertaSekolah.filter(function (p) { return p.StatusVerifikasi === 'VERIFIED'; }).length;
      const perluTindakan = pesertaSekolah.filter(function (p) { return p.StatusVerifikasi === 'NEED_REVIEW' || p.StatusVerifikasi === 'NEED_CORRECTION'; }).length;

      return (
        '<tr>' +
          '<td><b>' + escapeHtml(s.NamaSekolah) + '</b></td>' +
          '<td>' + (barung ? escapeHtml(barung.NamaBarung) : '<span style="color:var(--ink-400)">Belum dibuat</span>') + '</td>' +
          '<td>' + pendampingCount + ' / 3</td>' +
          '<td>' + pesertaSekolah.length + '</td>' +
          '<td>' + verified + '</td>' +
          '<td>' + (perluTindakan > 0 ? ('<span class="pill" style="background:#fef3c722;color:#b45309">' + perluTindakan + '</span>') : '-') + '</td>' +
        '</tr>'
      );
    }).join('') +
    '</tbody></table>';
}

function renderPesertaDetail(pesertaList, sekolahList, barungList) {

  const el = document.getElementById('pesertaDetail');

  const sekolahMap = {}; sekolahList.forEach(function (s) { sekolahMap[s.ID] = s.NamaSekolah; });
  const barungMap = {}; barungList.forEach(function (b) { barungMap[b.ID] = b.NamaBarung; });

  if (pesertaList.length === 0) {
    el.innerHTML = '<div class="empty-note">Belum ada data peserta.</div>';
    return;
  }

  el.innerHTML =
    '<table class="data-table"><thead><tr>' +
      '<th>Nama</th><th>Sekolah</th><th>Barung</th><th>Tgl Lahir</th><th>Usia</th><th>Status</th>' +
    '</tr></thead><tbody>' +
    pesertaList.map(function (p) {
      return (
        '<tr>' +
          '<td>' + escapeHtml(p.NamaLengkap) + '</td>' +
          '<td>' + escapeHtml(sekolahMap[p.SekolahID] || '-') + '</td>' +
          '<td>' + escapeHtml(barungMap[p.BarungID] || '-') + '</td>' +
          '<td>' + formatTanggalPendek(p.TanggalLahir) + '</td>' +
          '<td>' + p.UsiaTahun + ' th ' + p.UsiaBulan + ' bl</td>' +
          '<td><span class="pill" style="background:' + STATUS_COLOR[p.StatusVerifikasi] + '22;color:' + STATUS_COLOR[p.StatusVerifikasi] + '">' + STATUS_LABEL[p.StatusVerifikasi] + '</span></td>' +
        '</tr>'
      );
    }).join('') +
    '</tbody></table>';
}

function exportCsv() {

  if (LAPORAN_PESERTA.length === 0) {
    alert('Belum ada data peserta untuk diexport.');
    return;
  }

  const sekolahMap = {}; LAPORAN_SEKOLAH.forEach(function (s) { sekolahMap[s.ID] = s.NamaSekolah; });

  const header = ['Nama Lengkap', 'Tempat Lahir', 'Tanggal Lahir', 'Jenis Kelamin', 'Sekolah', 'Usia (Tahun)', 'Usia (Bulan)', 'Status Verifikasi', 'Catatan'];

  const rows = LAPORAN_PESERTA.map(function (p) {
    return [
      p.NamaLengkap, p.TempatLahir, formatTanggalPendek(p.TanggalLahir), p.JenisKelamin,
      sekolahMap[p.SekolahID] || '', p.UsiaTahun, p.UsiaBulan, STATUS_LABEL[p.StatusVerifikasi], p.CatatanVerifikasi || ''
    ];
  });

  const csvLines = [header].concat(rows).map(function (row) {
    return row.map(function (cell) {
      const val = String(cell == null ? '' : cell).replace(/"/g, '""');
      return '"' + val + '"';
    }).join(',');
  });

  const csvContent = '\uFEFF' + csvLines.join('\r\n'); // BOM supaya Excel baca UTF-8 dengan benar

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = 'rekap-peserta-pesta-siaga-2026.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
