let DOK_ALL = { sekolah: [], barung: [], pendamping: [], peserta: [], event: null, settings: {} };
let DOK_MODE_SEMUA = false;

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

  document.getElementById('printBtn').addEventListener('click', function () { window.print(); });

  try {

    const [sekolahList, barungList, pendampingList, pesertaList, event, settings] = await Promise.all([
      callApi('getSekolahList', []),
      callApi('getBarungList', [null]),
      callApi('getPendampingList', [null]),
      callApi('getPesertaList', [{}]),
      callApi('getEventInfo', []),
      callApi('getPengaturan', [])
    ]);

    DOK_ALL = { sekolah: sekolahList, barung: barungList, pendamping: pendampingList, peserta: pesertaList, event: event, settings: settings };

  } catch (e) {
    document.getElementById('reportRoot').innerHTML = '<div class="empty-note">Gagal memuat data: ' + e.message + '</div>';
    return;
  }

  const isPanitia = PANITIA_ROLES_FE.indexOf(user.role) > -1;

  if (isPanitia) {

    const select = document.getElementById('sekolahSelect');
    select.style.display = 'inline-block';
    select.innerHTML = DOK_ALL.sekolah.map(function (s) {
      return '<option value="' + s.ID + '">' + escapeHtml(s.NamaSekolah) + '</option>';
    }).join('');

    document.getElementById('btnUnduhSemua').style.display = 'inline-block';

    select.addEventListener('change', function () {
      DOK_MODE_SEMUA = false;
      document.getElementById('pageSub').textContent = 'Menampilkan arsip: ' + select.options[select.selectedIndex].text;
      renderReport([select.value]);
    });

    document.getElementById('btnUnduhSemua').addEventListener('click', function () {
      DOK_MODE_SEMUA = true;
      document.getElementById('pageSub').textContent = 'Menampilkan arsip lengkap ' + DOK_ALL.sekolah.length + ' sekolah — klik Unduh PDF (bisa cukup panjang).';
      renderReport(DOK_ALL.sekolah.map(function (s) { return s.ID; }));
    });

    document.getElementById('pageSub').textContent = 'Pilih sekolah, atau unduh arsip lengkap semua sekolah.';

    if (DOK_ALL.sekolah.length > 0) {
      renderReport([DOK_ALL.sekolah[0].ID]);
    }

  } else {

    document.getElementById('pageSub').textContent = 'Arsip data sekolah Anda, siap diunduh sebagai PDF.';
    renderReport([user.sekolahId]);
  }

})();

function escapeHtml(str) {
  return String(str == null ? '' : str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderReport(sekolahIds) {

  const root = document.getElementById('reportRoot');
  const event = DOK_ALL.event || {};
  const settings = DOK_ALL.settings || {};

  const tanggal = event.Tanggal ? new Date(event.Tanggal) : null;
  const tglText = tanggal && !isNaN(tanggal)
    ? tanggal.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
    : '-';

  const sekolahTerpilih = DOK_ALL.sekolah.filter(function (s) {
    return sekolahIds.indexOf(s.ID) > -1;
  });

  const judulTarget = sekolahIds.length === 1
    ? (sekolahTerpilih[0] ? sekolahTerpilih[0].NamaSekolah : '-')
    : 'Seluruh Sekolah Peserta (' + sekolahTerpilih.length + ' Sekolah)';

  const cover =
    '<div class="report-page">' +
      '<div class="report-cover">' +
        '<img class="cover-logo" src="assets/logo.png" alt="Logo">' +
        '<h1>' + escapeHtml(settings.NamaAplikasi || event.NamaEvent || 'Pesta Siaga 2026') + '</h1>' +
        '<div class="cover-sub">' + escapeHtml(settings.Penyelenggara || 'KKMI Bondowoso') + ' — ' + escapeHtml(settings.Tagline || '') + '</div>' +
        '<div class="cover-doctype">Dokumen Arsip Kegiatan</div>' +
        '<div class="cover-target">' + escapeHtml(judulTarget) + '</div>' +
        '<table>' +
          '<tr><td><b>Tanggal Kegiatan</b></td><td>: ' + tglText + '</td></tr>' +
          '<tr><td><b>Lokasi</b></td><td>: ' + escapeHtml(event.Lokasi || '-') + '</td></tr>' +
          '<tr><td><b>Rentang Usia</b></td><td>: ' + (event.UsiaMinTahun || 7) + ' – &lt;' + (event.UsiaMaksTahun || 11) + ' tahun</td></tr>' +
        '</table>' +
        '<div class="cover-footer">Dicetak pada ' + new Date().toLocaleString('id-ID') + '<br>' + escapeHtml(settings.Developer || 'Edoy D Hagane') + ' — Pesta Siaga 2026 Digital Management System</div>' +
      '</div>' +
    '</div>';

  const sections = sekolahTerpilih.map(function (s, idx) {
    return renderSekolahSection(s, idx === sekolahTerpilih.length - 1);
  }).join('');

  root.innerHTML = cover + sections;
}

function renderSekolahSection(sekolah, isLast) {

  const barungSekolah = DOK_ALL.barung.filter(function (b) { return String(b.SekolahID) === String(sekolah.ID); });

  const barungHtml = barungSekolah.length === 0
    ? '<div class="empty-note">Belum ada barung untuk sekolah ini.</div>'
    : barungSekolah.map(function (b) { return renderBarungBlock(b); }).join('');

  return (
    '<div class="report-page' + (isLast ? '' : '') + '" style="' + (isLast ? '' : 'page-break-after:always;') + '">' +
      '<div class="sekolah-section">' +
        '<h2>' + escapeHtml(sekolah.NamaSekolah) + '</h2>' +
        '<div class="sekolah-meta">Kecamatan ' + escapeHtml(sekolah.Kecamatan || '-') + ' · ' + escapeHtml(sekolah.Alamat || '-') + '</div>' +
        barungHtml +
      '</div>' +
    '</div>'
  );
}

function renderBarungBlock(barung) {

  const hex = (typeof WARNA_BARUNG_HEX !== 'undefined' && WARNA_BARUNG_HEX[barung.WarnaBarung]) || '#0f766e';
  const textColor = (typeof warnaTeksKontras === 'function') ? warnaTeksKontras(hex) : '#ffffff';

  const pendampingBarung = DOK_ALL.pendamping.filter(function (p) { return String(p.BarungID) === String(barung.ID); });
  const pesertaBarung = DOK_ALL.peserta.filter(function (p) { return String(p.BarungID) === String(barung.ID); });

  const jabatanOrder = { Pinrung: 1, Wapinrung: 2, Anggota: 3 };
  pesertaBarung.sort(function (a, b) {
    return (jabatanOrder[a.Jabatan] || 9) - (jabatanOrder[b.Jabatan] || 9);
  });

  const peranOrder = { KetuaBarung: 1, Pendamping1: 2, Pendamping2: 3 };
  pendampingBarung.sort(function (a, b) {
    return (peranOrder[a.Peran] || 9) - (peranOrder[b.Peran] || 9);
  });

  const pendampingRows = pendampingBarung.length === 0
    ? '<tr><td colspan="5" style="color:var(--ink-400);font-style:italic">Belum ada data pendamping</td></tr>'
    : pendampingBarung.map(function (p) {
        return (
          '<tr>' +
            '<td>' + (p.FotoURL ? '<img class="doc-photo" src="' + escapeHtml(p.FotoURL) + '">' : '<span class="doc-photo-empty"></span>') + '</td>' +
            '<td><b>' + escapeHtml(p.Nama) + '</b></td>' +
            '<td>' + escapeHtml((p.Peran || '').replace('Pendamping', 'Pendamping ').replace('KetuaBarung', 'Ketua Barung')) + '</td>' +
            '<td>' + escapeHtml(p.NomorHP || '-') + '</td>' +
            '<td>' + escapeHtml(p.Biodata || '-') + '</td>' +
          '</tr>'
        );
      }).join('');

  const pesertaRows = pesertaBarung.length === 0
    ? '<tr><td colspan="6" style="color:var(--ink-400);font-style:italic">Belum ada peserta</td></tr>'
    : pesertaBarung.map(function (p) {
        const jabatanText = { Pinrung: 'Pinrung', Wapinrung: 'Wapinrung', Anggota: 'Anggota' }[p.Jabatan] || 'Anggota';
        return (
          '<tr>' +
            '<td>' + (p.FotoURL ? '<img class="doc-photo" src="' + escapeHtml(p.FotoURL) + '">' : '<span class="doc-photo-empty"></span>') + '</td>' +
            '<td><b>' + escapeHtml(p.NamaLengkap) + '</b></td>' +
            '<td>' + escapeHtml(p.TempatLahir || '-') + ', ' + formatTanggalPendek(p.TanggalLahir) + '</td>' +
            '<td>' + (p.UsiaTahun != null ? (p.UsiaTahun + ' th ' + p.UsiaBulan + ' bl') : '-') + '</td>' +
            '<td>' + jabatanText + '</td>' +
            '<td>' + (STATUS_LABEL[p.StatusVerifikasi] || p.StatusVerifikasi) + '</td>' +
          '</tr>'
        );
      }).join('');

  return (
    '<div class="barung-block">' +
      '<div class="bb-head" style="background:' + hex + ';color:' + textColor + '">' +
        'Barung ' + escapeHtml(barung.JenisKelamin || '') + ' — ' + escapeHtml(barung.NamaBarung || '') +
      '</div>' +
      '<div class="group-label">Pendamping</div>' +
      '<table><thead><tr><th>Foto</th><th>Nama</th><th>Peran</th><th>No. HP</th><th>Biodata</th></tr></thead><tbody>' + pendampingRows + '</tbody></table>' +
      '<div class="group-label">Peserta</div>' +
      '<table><thead><tr><th>Foto</th><th>Nama</th><th>Tempat, Tgl Lahir</th><th>Usia</th><th>Jabatan</th><th>Status</th></tr></thead><tbody>' + pesertaRows + '</tbody></table>' +
    '</div>'
  );
}
