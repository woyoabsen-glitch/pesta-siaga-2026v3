const PANITIA_ROLES_FE = ['PenanggungJawab', 'Ketua', 'Sekretaris'];

(async function () {

  const user = requireLoginOrRedirect();
  if (!user) return;

  setupChrome(user);
  attachNavPlaceholders();

  try {

    if (PANITIA_ROLES_FE.indexOf(user.role) > -1) {
      await loadPanitiaView();
    } else {
      await loadSekolahView(user);
    }

  } catch (err) {

    document.getElementById('pageSub').textContent = 'Gagal memuat data: ' + err.message;
    console.error(err);
  }

})();

function setupChrome(user) {

  document.getElementById('roleTag').textContent = ROLE_LABEL[user.role] || user.role;
  document.getElementById('avatar').textContent = (user.nama || '?').trim().charAt(0).toUpperCase();

  document.getElementById('logoutBtn').addEventListener('click', async function () {

    try { await callApi('logoutSession', []); } catch (e) { /* abaikan */ }

    Session.clear();
    window.location.href = 'index.html';
  });
}

function attachNavPlaceholders() {

  document.querySelectorAll('[data-nav="soon"]').forEach(function (el) {

    el.addEventListener('click', function () {
      alert('Halaman ini menyusul di fase pengembangan berikutnya (Fase 3–5).');
    });
  });
}

/* =========================================================
 *  VIEW: PANITIA (Command Center penuh)
 * ========================================================= */

async function loadPanitiaView() {

  document.getElementById('pageTitle').textContent = 'Command Center';
  document.getElementById('pageSub').textContent = 'Dashboard Panitia Pesta Siaga 2026';

  const [summary, perluTindakan, sekolahList, barungList, pesertaList, pendampingList, event] =
    await Promise.all([
      callApi('getDashboardSummary', []),
      callApi('getPesertaPerluTindakan', []),
      callApi('getSekolahList', []),
      callApi('getBarungList', [null]),
      callApi('getPesertaList', [{}]),
      callApi('getPendampingList', [null]),
      callApi('getEventInfo', [])
    ]);

  renderStatGrid([
    { icon: '🏫', bg: '#e0f2f1', color: '#0f766e', label: 'Sekolah Terdaftar', value: summary.totalSekolah + ' / 12', delta: summary.sekolahLengkap + ' sudah lengkap' },
    { icon: '🎪', bg: '#fef3c7', color: '#b45309', label: 'Jumlah Barung', value: summary.totalBarung },
    { icon: '🧒', bg: '#dbeafe', color: '#1d4ed8', label: 'Total Peserta', value: summary.totalPeserta },
    { icon: '🧑‍🤝‍🧑', bg: '#ede9fe', color: '#6d28d9', label: 'Pendamping', value: summary.totalPendamping },
    { icon: '✅', bg: '#dcfce7', color: '#15803d', label: 'Terverifikasi', value: summary.statusVerifikasi.VERIFIED, delta: pct(summary.statusVerifikasi.VERIFIED, summary.totalPeserta) + '% dari total' },
    { icon: '⚠️', bg: '#fee2e2', color: '#b91c1c', label: 'Perlu Tindakan', value: (summary.statusVerifikasi.NEED_REVIEW + summary.statusVerifikasi.NEED_CORRECTION) }
  ]);

  renderDonut(summary.statusVerifikasi, summary.totalPeserta);
  renderActionList(perluTindakan);
  renderProgressSekolah(sekolahList, barungList, pesertaList, pendampingList);
  renderEventInfo(event, summary);
}

/* =========================================================
 *  VIEW: SEKOLAH (ringkasan sekolah sendiri)
 * ========================================================= */

async function loadSekolahView(user) {

  document.getElementById('pageTitle').textContent = 'Dashboard Sekolah';
  document.getElementById('pageSub').textContent = 'Ringkasan data sekolah Anda';

  const [sekolahList, barungList, pesertaList, pendampingList, event] = await Promise.all([
    callApi('getSekolahList', []),
    callApi('getBarungList', [null]),
    callApi('getPesertaList', [{}]),
    callApi('getPendampingList', [null]),
    callApi('getEventInfo', [])
  ]);

  const sekolah = sekolahList[0] || {};
  const barung = barungList[0] || null;

  const statusCounts = { PENDING: 0, VERIFIED: 0, NEED_REVIEW: 0, NEED_CORRECTION: 0, NOT_ELIGIBLE: 0 };
  pesertaList.forEach(function (p) {
    if (statusCounts.hasOwnProperty(p.StatusVerifikasi)) statusCounts[p.StatusVerifikasi]++;
  });

  renderStatGrid([
    { icon: '🏫', bg: '#e0f2f1', color: '#0f766e', label: 'Status Profil', value: sekolah.StatusKelengkapan || '-' },
    { icon: '🎪', bg: '#fef3c7', color: '#b45309', label: 'Barung', value: barung ? barung.NamaBarung : 'Belum dibuat' },
    { icon: '🧒', bg: '#dbeafe', color: '#1d4ed8', label: 'Peserta Diinput', value: pesertaList.length },
    { icon: '🧑‍🤝‍🧑', bg: '#ede9fe', color: '#6d28d9', label: 'Pendamping', value: pendampingList.length + ' / 3' },
    { icon: '✅', bg: '#dcfce7', color: '#15803d', label: 'Terverifikasi', value: statusCounts.VERIFIED },
    { icon: '⚠️', bg: '#fee2e2', color: '#b91c1c', label: 'Perlu Diperbaiki', value: statusCounts.NEED_CORRECTION }
  ]);

  renderDonut(statusCounts, pesertaList.length);

  const actionListEl = document.getElementById('actionList');
  const perlu = pesertaList.filter(function (p) {
    return p.StatusVerifikasi === 'NEED_REVIEW' || p.StatusVerifikasi === 'NEED_CORRECTION';
  });

  if (perlu.length === 0) {
    actionListEl.innerHTML = '<div class="empty-note">Tidak ada peserta yang perlu tindakan saat ini.</div>';
  } else {
    actionListEl.innerHTML = perlu.map(function (p) {
      return actionItemHtml(p.NamaLengkap, p.CatatanVerifikasi || '-', p.StatusVerifikasi);
    }).join('');
  }

  document.getElementById('progressList').closest('.panel').querySelector('h3').textContent = 'Data Pendamping';
  document.getElementById('progressList').closest('.panel').querySelector('.panel-sub').textContent = 'Ketua Barung & Pendamping terdaftar';

  const progressEl = document.getElementById('progressList');

  if (pendampingList.length === 0) {
    progressEl.innerHTML = '<div class="empty-note">Belum ada data pendamping. Silakan lengkapi di menu Pendamping.</div>';
  } else {
    progressEl.innerHTML = pendampingList.map(function (p) {
      return '<div class="action-item"><div><div class="who">' + escapeHtml(p.Nama) + '</div>' +
        '<div class="meta">' + escapeHtml(p.Peran) + '</div></div></div>';
    }).join('');
  }

  renderEventInfo(event, null);
}

/* =========================================================
 *  RENDER HELPERS
 * ========================================================= */

function pct(n, total) {
  if (!total) return 0;
  return Math.round((n / total) * 100);
}

function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderStatGrid(cards) {

  const el = document.getElementById('statGrid');

  el.innerHTML = cards.map(function (c) {
    return (
      '<div class="stat-card">' +
        '<div class="icon" style="background:' + c.bg + ';color:' + c.color + '">' + c.icon + '</div>' +
        '<div class="value">' + c.value + '</div>' +
        '<div class="label">' + c.label + '</div>' +
        (c.delta ? '<div class="delta" style="color:' + c.color + '">' + c.delta + '</div>' : '') +
      '</div>'
    );
  }).join('');
}

function renderDonut(statusCounts, total) {

  const wrap = document.getElementById('donutWrap');

  if (!total) {
    wrap.innerHTML = '<div class="empty-note">Belum ada data peserta.</div>';
    return;
  }

  const order = ['VERIFIED', 'PENDING', 'NEED_REVIEW', 'NEED_CORRECTION', 'NOT_ELIGIBLE'];
  const r = 54;
  const circumference = 2 * Math.PI * r;

  let offsetAccum = 0;
  const segments = [];

  order.forEach(function (key) {

    const count = statusCounts[key] || 0;
    if (count === 0) return;

    const fraction = count / total;
    const dash = fraction * circumference;

    segments.push({
      key: key,
      dash: dash,
      gap: circumference - dash,
      offset: -offsetAccum,
      color: STATUS_COLOR[key]
    });

    offsetAccum += dash;
  });

  const circlesSvg = segments.map(function (s) {
    return '<circle cx="70" cy="70" r="' + r + '" fill="none" stroke="' + s.color + '" ' +
      'stroke-width="16" stroke-dasharray="' + s.dash + ' ' + s.gap + '" ' +
      'stroke-dashoffset="' + s.offset + '" stroke-linecap="butt" ' +
      'class="donut-seg" transform="rotate(-90 70 70)"></circle>';
  }).join('');

  const legend = order
    .filter(function (k) { return statusCounts[k] > 0; })
    .map(function (k) {
      return (
        '<div class="row"><span class="left"><span class="dot" style="background:' + STATUS_COLOR[k] + '"></span>' +
        STATUS_LABEL[k] + '</span><span class="val">' + statusCounts[k] + '</span></div>'
      );
    }).join('');

  wrap.innerHTML =
    '<svg width="140" height="140" viewBox="0 0 140 140">' +
      '<circle cx="70" cy="70" r="' + r + '" fill="none" stroke="#eef2f1" stroke-width="16"></circle>' +
      circlesSvg +
      '<text x="70" y="66" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="22" font-weight="700" fill="#14261f">' + total + '</text>' +
      '<text x="70" y="84" text-anchor="middle" font-family="Inter, sans-serif" font-size="10" fill="#8ea39a">PESERTA</text>' +
    '</svg>' +
    '<div class="donut-legend">' + legend + '</div>';
}

function actionItemHtml(nama, catatan, status) {
  return (
    '<div class="action-item">' +
      '<div><div class="who">' + escapeHtml(nama) + '</div><div class="meta">' + escapeHtml(catatan) + '</div></div>' +
      '<span class="badge" style="background:' + STATUS_COLOR[status] + '22;color:' + STATUS_COLOR[status] + '">' + STATUS_LABEL[status] + '</span>' +
    '</div>'
  );
}

function renderActionList(list) {

  const el = document.getElementById('actionList');

  if (!list || list.length === 0) {
    el.innerHTML = '<div class="empty-note">Tidak ada peserta yang perlu tindakan saat ini. 🎉</div>';
    return;
  }

  el.innerHTML = list.slice(0, 8).map(function (p) {
    return (
      '<div class="action-item">' +
        '<div><div class="who">' + escapeHtml(p.NamaLengkap) + '</div>' +
        '<div class="meta">' + escapeHtml(p.NamaSekolah) + ' · ' + escapeHtml(p.NamaBarung) + '</div></div>' +
        '<span class="badge" style="background:' + STATUS_COLOR[p.StatusVerifikasi] + '22;color:' + STATUS_COLOR[p.StatusVerifikasi] + '">' + STATUS_LABEL[p.StatusVerifikasi] + '</span>' +
      '</div>'
    );
  }).join('');
}

function renderProgressSekolah(sekolahList, barungList, pesertaList, pendampingList) {

  const el = document.getElementById('progressList');

  if (sekolahList.length === 0) {
    el.innerHTML = '<div class="empty-note">Belum ada data sekolah.</div>';
    return;
  }

  const rows = sekolahList.map(function (s) {

    let score = 0;

    if (s.StatusKelengkapan === 'Lengkap') score += 25;
    if (barungList.some(function (b) { return String(b.SekolahID) === String(s.ID); })) score += 25;
    if (pesertaList.some(function (p) { return String(p.SekolahID) === String(s.ID); })) score += 25;

    const pendampingSekolah = pendampingList.filter(function (p) { return String(p.SekolahID) === String(s.ID); });
    if (pendampingSekolah.length >= 3) score += 25;

    return { nama: s.NamaSekolah, score: score };
  }).sort(function (a, b) { return b.score - a.score; });

  el.innerHTML = rows.map(function (r) {
    return (
      '<div class="progress-row">' +
        '<div class="top"><span>' + escapeHtml(r.nama) + '</span><span class="pct">' + r.score + '%</span></div>' +
        '<div class="progress-track"><div class="progress-fill" style="width:' + r.score + '%"></div></div>' +
      '</div>'
    );
  }).join('');
}

function renderEventInfo(event, summary) {

  const el = document.getElementById('eventInfo');

  if (!event) {
    el.innerHTML = '<div class="empty-note">Data kegiatan tidak ditemukan.</div>';
    return;
  }

  const tanggal = new Date(event.Tanggal);
  const tglText = isNaN(tanggal) ? event.Tanggal : tanggal.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

  const rows = [
    ['Kegiatan', event.NamaEvent],
    ['Tanggal', tglText],
    ['Lokasi', event.Lokasi],
    ['Rentang Usia', event.UsiaMinTahun + ' – < ' + event.UsiaMaksTahun + ' tahun'],
    ['Status', event.Status]
  ];

  el.innerHTML = rows.map(function (r) {
    return '<div class="action-item"><span class="meta">' + r[0] + '</span><span class="who" style="font-size:13px">' + escapeHtml(r[1]) + '</span></div>';
  }).join('');
}
