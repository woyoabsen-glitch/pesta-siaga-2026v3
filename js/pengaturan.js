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

  // Info kegiatan: SuperAdmin, PenanggungJawab & Ketua boleh simpan (dibatasi backend juga)
  const boleeditEvent = ['SuperAdmin', 'PenanggungJawab', 'Ketua'].indexOf(user.role) > -1;
  toggleFormDisabled('formEvent', !boleeditEvent);

  // Identitas aplikasi: SuperAdmin & PenanggungJawab (dibatasi backend juga)
  const bolehEditSettings = ['SuperAdmin', 'PenanggungJawab'].indexOf(user.role) > -1;
  toggleFormDisabled('formSettings', !bolehEditSettings);

  document.getElementById('formEvent').addEventListener('submit', onSaveEvent);
  document.getElementById('formSettings').addEventListener('submit', onSaveSettings);

  const btnRecalc = document.getElementById('btnRecalcUsia');
  if (btnRecalc) {
    if (!boleeditEvent) {
      btnRecalc.disabled = true;
      btnRecalc.title = 'Anda tidak memiliki izin untuk aksi ini.';
    } else {
      btnRecalc.addEventListener('click', onRecalcUsia);
    }
  }

  document.getElementById('pageSub').textContent = 'Kelola informasi kegiatan dan identitas aplikasi.';

  await Promise.all([loadEvent(), loadSettings()]);

})();

function toggleFormDisabled(formId, disabled) {

  const form = document.getElementById(formId);

  form.querySelectorAll('input, select, button[type="submit"]').forEach(function (el) {
    el.disabled = disabled;
  });

  if (disabled) {
    const note = document.createElement('div');
    note.className = 'field-full';
    note.innerHTML = '<div class="usia-preview bad">Anda tidak memiliki izin mengubah bagian ini.</div>';
    form.appendChild(note);
  }
}

function toast(msg, isError) {
  const el = document.createElement('div');
  el.className = 'toast' + (isError ? ' error' : '');
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(function () { el.remove(); }, 3800);
}

async function loadEvent() {

  try {

    const event = await callApi('getEventInfo', []);
    if (!event) return;

    document.getElementById('eNama').value = event.NamaEvent || '';
    document.getElementById('eTanggal').value = new Date(event.Tanggal).toISOString().substring(0, 10);
    document.getElementById('eStatus').value = event.Status || 'Aktif';
    document.getElementById('eLokasi').value = event.Lokasi || '';
    document.getElementById('eUsiaMin').value = event.UsiaMinTahun || 7;
    document.getElementById('eUsiaMaks').value = event.UsiaMaksTahun || 11;
    document.getElementById('eTanggalCutoff').value = new Date(event.TanggalCutoffUsia || event.Tanggal).toISOString().substring(0, 10);

  } catch (e) {
    toast(e.message, true);
  }
}

async function onSaveEvent(e) {

  e.preventDefault();

  try {

    await callApi('saveEventInfo', [{
      NamaEvent: document.getElementById('eNama').value.trim(),
      Tanggal: document.getElementById('eTanggal').value,
      Status: document.getElementById('eStatus').value,
      Lokasi: document.getElementById('eLokasi').value.trim(),
      UsiaMinTahun: Number(document.getElementById('eUsiaMin').value),
      UsiaMaksTahun: Number(document.getElementById('eUsiaMaks').value),
      TanggalCutoffUsia: document.getElementById('eTanggalCutoff').value
    }]);

    toast('Informasi kegiatan tersimpan.');

  } catch (err) {
    toast(err.message, true);
  }
}

async function loadSettings() {

  try {

    const settings = await callApi('getPengaturan', []);

    document.getElementById('sNama').value = settings.NamaAplikasi || '';
    document.getElementById('sPenyelenggara').value = settings.Penyelenggara || '';
    document.getElementById('sTagline').value = settings.Tagline || '';

  } catch (e) {
    toast(e.message, true);
  }
}

async function onSaveSettings(e) {

  e.preventDefault();

  try {

    await callApi('savePengaturan', [{
      NamaAplikasi: document.getElementById('sNama').value.trim(),
      Penyelenggara: document.getElementById('sPenyelenggara').value.trim(),
      Tagline: document.getElementById('sTagline').value.trim()
    }]);

    toast('Identitas aplikasi tersimpan.');

  } catch (err) {
    toast(err.message, true);
  }
}

async function onRecalcUsia() {

  const ok = confirm(
    'Ini akan menghitung ulang usia & status kelayakan SEMUA peserta yang sudah diinput, ' +
    'berdasarkan Tanggal Cutoff Usia yang tersimpan saat ini.\n\n' +
    'Pastikan Anda sudah klik "Simpan Info Kegiatan" dulu kalau baru mengubah tanggal cutoff. Lanjutkan?'
  );

  if (!ok) return;

  const btn = document.getElementById('btnRecalcUsia');
  const resultEl = document.getElementById('recalcResult');

  btn.disabled = true;
  btn.textContent = '⏳ Memproses…';
  resultEl.innerHTML = '';

  try {

    const hasil = await callApi('recalcUsiaSemuaPeserta', []);

    resultEl.innerHTML =
      '<div class="usia-preview ok">' +
        '✅ Selesai. ' + hasil.totalDiperiksa + ' peserta diperiksa.<br>' +
        (hasil.jadiTidakMemenuhi > 0 ? hasil.jadiTidakMemenuhi + ' peserta jadi <b>Tidak Memenuhi Syarat</b> (terkunci otomatis).<br>' : '') +
        (hasil.jadiMemenuhiLagi > 0 ? hasil.jadiMemenuhiLagi + ' peserta yang tadinya terkunci kini <b>memenuhi syarat lagi</b> (kembali ke status Menunggu Dokumen).<br>' : '') +
        (hasil.jadiTidakMemenuhi === 0 && hasil.jadiMemenuhiLagi === 0 ? 'Tidak ada perubahan status.' : '') +
      '</div>';

    toast('Hitung ulang usia selesai.');

  } catch (err) {

    resultEl.innerHTML = '<div class="usia-preview bad">Gagal: ' + err.message + '</div>';

  } finally {

    btn.disabled = false;
    btn.textContent = '🔄 Hitung Ulang Usia Semua Peserta';
  }
}
