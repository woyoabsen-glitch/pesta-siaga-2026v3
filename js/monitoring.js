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

  document.getElementById('btnRefresh').addEventListener('click', loadData);

  await loadData();

  // Auto-refresh tiap 20 detik supaya panitia lain lihat progres real-time.
  setInterval(loadData, 20000);

})();

function escapeHtml(str) {
  return String(str == null ? '' : str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function loadData() {

  try {

    const list = await callApi('getRegistrationList', []);

    const terdaftar = list.filter(function (b) { return b.Terdaftar; }).length;
    const totalHadir = list.reduce(function (sum, b) { return sum + (b.JumlahHadir || 0); }, 0);
    const totalTidakHadir = list.reduce(function (sum, b) { return sum + (b.JumlahTidakHadir || 0); }, 0);
    const totalPeserta = list.reduce(function (sum, b) { return sum + (b.JumlahPeserta || 0); }, 0);

    document.getElementById('pageSub').textContent = terdaftar + ' dari ' + list.length + ' barung sudah registrasi Hari H.';

    document.getElementById('statGrid').innerHTML = [
      { icon: '🎪', bg: '#e0f2f1', color: '#0f766e', label: 'Barung Terdaftar', value: terdaftar + ' / ' + list.length },
      { icon: '🧒', bg: '#dbeafe', color: '#1d4ed8', label: 'Total Peserta Terdaftar', value: totalPeserta },
      { icon: '✅', bg: '#dcfce7', color: '#15803d', label: 'Hadir', value: totalHadir },
      { icon: '⚠️', bg: '#fee2e2', color: '#b91c1c', label: 'Tidak Hadir', value: totalTidakHadir }
    ].map(function (c) {
      return '<div class="stat-card"><div class="icon" style="background:' + c.bg + ';color:' + c.color + '">' + c.icon + '</div>' +
        '<div class="value">' + c.value + '</div><div class="label">' + c.label + '</div></div>';
    }).join('');

    document.getElementById('content').innerHTML =
      '<table class="data-table"><thead><tr>' +
        '<th>Barung</th><th>Sekolah</th><th>Status</th><th>Waktu</th><th>Petugas</th><th>Hadir / Total</th>' +
      '</tr></thead><tbody>' +
      list.map(function (b) {
        return (
          '<tr>' +
            '<td><b>' + escapeHtml(b.NamaBarung) + '</b><br><span style="font-size:11px;color:var(--ink-400)">' + escapeHtml(b.WarnaBarung) + '</span></td>' +
            '<td>' + escapeHtml(b.NamaSekolah) + '</td>' +
            '<td>' + (b.Terdaftar
              ? '<span class="pill" style="background:#dcfce7;color:#15803d">Terdaftar</span>'
              : '<span class="pill" style="background:#f1f5f4;color:var(--ink-600)">Belum</span>') + '</td>' +
            '<td>' + (b.Waktu ? formatTanggalPendek(b.Waktu) : '-') + '</td>' +
            '<td>' + escapeHtml(b.Petugas || '-') + '</td>' +
            '<td>' + b.JumlahHadir + ' / ' + b.JumlahPeserta + '</td>' +
          '</tr>'
        );
      }).join('') +
      '</tbody></table>';

  } catch (e) {
    document.getElementById('content').innerHTML = '<div class="empty-note">Gagal memuat: ' + escapeHtml(e.message) + '</div>';
  }
}
