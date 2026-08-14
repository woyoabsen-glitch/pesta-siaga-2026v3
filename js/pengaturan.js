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

  // Info kegiatan: hanya PenanggungJawab & Ketua boleh simpan (dibatasi backend juga)
  const boleeditEvent = user.role === 'PenanggungJawab' || user.role === 'Ketua';
  toggleFormDisabled('formEvent', !boleeditEvent);

  // Identitas aplikasi: hanya PenanggungJawab (dibatasi backend juga)
  const bolehEditSettings = user.role === 'PenanggungJawab';
  toggleFormDisabled('formSettings', !bolehEditSettings);

  document.getElementById('formEvent').addEventListener('submit', onSaveEvent);
  document.getElementById('formSettings').addEventListener('submit', onSaveSettings);

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
      UsiaMaksTahun: Number(document.getElementById('eUsiaMaks').value)
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
