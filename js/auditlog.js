let AUDIT_LOG_ALL = [];

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

  document.getElementById('searchBox').addEventListener('input', renderTable);

  await loadLog();

})();

function escapeHtml(str) {
  return String(str == null ? '' : str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function loadLog() {

  document.getElementById('pageSub').textContent = 'Memuat riwayat aktivitas…';

  try {

    AUDIT_LOG_ALL = await callApi('getActivityLog', [300]);
    document.getElementById('pageSub').textContent = AUDIT_LOG_ALL.length + ' aktivitas tercatat (300 terbaru)';
    renderTable();

  } catch (e) {
    document.getElementById('logTable').innerHTML = '<div class="empty-note">Gagal memuat: ' + escapeHtml(e.message) + '</div>';
  }
}

function renderTable() {

  const q = document.getElementById('searchBox').value.trim().toLowerCase();

  const list = !q ? AUDIT_LOG_ALL : AUDIT_LOG_ALL.filter(function (r) {
    return (
      String(r.NamaUser).toLowerCase().indexOf(q) > -1 ||
      String(r.Aksi).toLowerCase().indexOf(q) > -1 ||
      String(r.Detail).toLowerCase().indexOf(q) > -1
    );
  });

  const el = document.getElementById('logTable');

  if (list.length === 0) {
    el.innerHTML = '<div class="empty-note">Tidak ada aktivitas yang cocok.</div>';
    return;
  }

  el.innerHTML =
    '<table class="data-table"><thead><tr>' +
      '<th>Waktu</th><th>Pengguna</th><th>Role</th><th>Aksi</th><th>Detail</th>' +
    '</tr></thead><tbody>' +
    list.map(function (r) {
      return (
        '<tr>' +
          '<td style="white-space:nowrap;font-family:var(--font-mono);font-size:11.5px">' + formatWaktuLengkap(r.Timestamp) + '</td>' +
          '<td>' + escapeHtml(r.NamaUser) + '</td>' +
          '<td>' + escapeHtml(ROLE_LABEL[r.Role] || r.Role) + '</td>' +
          '<td><span class="pill" style="background:var(--teal-100);color:var(--teal-700)">' + escapeHtml(r.Aksi) + '</span></td>' +
          '<td style="font-size:12.5px;color:var(--ink-600)">' + escapeHtml(r.Detail) + '</td>' +
        '</tr>'
      );
    }).join('') +
    '</tbody></table>';
}

function formatWaktuLengkap(t) {
  try {
    return new Date(t).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return String(t);
  }
}
