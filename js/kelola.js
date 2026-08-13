let STATE = { sekolahId: null, isPanitia: false, barung: null, pendampingList: [], pesertaList: [] };

(async function init() {

  const user = requireLoginOrRedirect();
  if (!user) return;

  document.getElementById('roleTag').textContent = ROLE_LABEL[user.role] || user.role;
  document.getElementById('avatar').textContent = (user.nama || '?').charAt(0).toUpperCase();
  document.getElementById('logoutBtn').addEventListener('click', doLogout);

  document.querySelectorAll('.sidebar .nav-item[data-href]').forEach(function (el) {
    el.addEventListener('click', function () { window.location.href = el.dataset.href; });
  });
  document.querySelectorAll('.sidebar .nav-item[data-nav="soon"]').forEach(function (el) {
    el.addEventListener('click', function () { toast('Menu ini menyusul di fase berikutnya.'); });
  });

  document.querySelectorAll('.tab-btn').forEach(function (btn) {
    btn.addEventListener('click', function () { switchTab(btn.dataset.tab); });
  });

  document.getElementById('formProfil').addEventListener('submit', onSaveProfil);
  document.getElementById('btnTambahPeserta').addEventListener('click', function () { openPesertaForm(null); });

  STATE.isPanitia = PANITIA_ROLES_FE.indexOf(user.role) > -1;

  if (STATE.isPanitia) {

    document.getElementById('navPanitiaOnly').style.display = 'block';
    const select = document.getElementById('sekolahSelect');
    select.style.display = 'inline-block';

    try {
      const sekolahList = await callApi('getSekolahList', []);
      select.innerHTML = '<option value="">— Pilih sekolah —</option>' +
        sekolahList.map(function (s) { return '<option value="' + s.ID + '">' + escapeHtml(s.NamaSekolah) + '</option>'; }).join('');
    } catch (e) {
      toast(e.message, true);
    }

    select.addEventListener('change', function () {
      if (select.value) { STATE.sekolahId = select.value; loadAllTabs(); }
    });

    document.getElementById('pageSub').textContent = 'Pilih sekolah di kanan atas untuk mulai mengelola datanya.';

  } else {

    STATE.sekolahId = user.sekolahId;
    document.getElementById('pageSub').textContent = 'Kelola profil, barung, pendamping, dan peserta sekolah Anda.';
    await loadAllTabs();
  }

})();

async function doLogout() {
  try { await callApi('logoutSession', []); } catch (e) {}
  Session.clear();
  window.location.href = 'index.html';
}

function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(function (b) { b.classList.toggle('active', b.dataset.tab === tab); });
  document.querySelectorAll('.tab-panel').forEach(function (p) { p.classList.remove('active'); });
  document.getElementById('tab' + tab.charAt(0).toUpperCase() + tab.slice(1)).classList.add('active');
}

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

/* =========================================================
 *  LOAD SEMUA TAB
 * ========================================================= */

async function loadAllTabs() {

  if (!STATE.sekolahId) return;

  await Promise.all([loadProfil(), loadBarung(), loadPendamping(), loadPeserta()]);
}

async function loadProfil() {

  try {

    const list = await callApi('getSekolahList', []);
    const sekolah = STATE.isPanitia
      ? list.find(function (s) { return String(s.ID) === String(STATE.sekolahId); })
      : list[0];

    if (!sekolah) return;

    document.getElementById('fNamaSekolah').value = (sekolah.NamaSekolah || '').replace(' (belum diisi)', '');
    document.getElementById('fKecamatan').value = sekolah.Kecamatan || '';
    document.getElementById('fAlamat').value = sekolah.Alamat || '';

  } catch (e) {
    toast(e.message, true);
  }
}

async function onSaveProfil(e) {

  e.preventDefault();

  try {

    await callApi('saveSekolah', [{
      ID: STATE.sekolahId,
      NamaSekolah: document.getElementById('fNamaSekolah').value.trim(),
      Kecamatan: document.getElementById('fKecamatan').value.trim(),
      Alamat: document.getElementById('fAlamat').value.trim()
    }]);

    toast('Profil sekolah tersimpan.');

  } catch (err) {
    toast(err.message, true);
  }
}

/* =========================================================
 *  BARUNG
 * ========================================================= */

async function loadBarung() {

  const el = document.getElementById('barungContent');

  try {

    const list = await callApi('getBarungList', [STATE.isPanitia ? STATE.sekolahId : null]);
    const barung = list.find(function (b) { return String(b.SekolahID) === String(STATE.sekolahId); }) || null;

    STATE.barung = barung;

    if (!barung) {

      el.innerHTML =
        '<form id="formBarung" class="form-grid single" style="max-width:360px">' +
          '<div><label>Nama Barung</label><input id="fNamaBarung" placeholder="mis. Barung Merah" required></div>' +
          '<div><label>Warna Barung</label><select id="fWarnaBarung" required>' +
            '<option value="">— Pilih warna —</option>' +
            WARNA_BARUNG_OPTIONS.map(function (w) { return '<option value="' + w + '">' + w + '</option>'; }).join('') +
          '</select></div>' +
          '<div><button type="submit" class="btn-primary" style="width:auto;padding:11px 22px">Buat Barung</button></div>' +
        '</form>';

      document.getElementById('formBarung').addEventListener('submit', onCreateBarung);

    } else {

      el.innerHTML =
        '<div class="pendamping-card" style="max-width:360px">' +
          '<div class="role-tag">Barung Aktif</div>' +
          '<div class="name">' + escapeHtml(barung.NamaBarung) + '</div>' +
          '<div class="phone">Warna: ' + escapeHtml(barung.WarnaBarung) + '</div>' +
          '<div class="phone">Status QR: ' + escapeHtml(barung.StatusQR || 'BELUM_DIBUAT') + '</div>' +
        '</div>';
    }

  } catch (e) {
    el.innerHTML = '<div class="empty-note">Gagal memuat: ' + escapeHtml(e.message) + '</div>';
  }
}

async function onCreateBarung(e) {

  e.preventDefault();

  try {

    await callApi('saveBarung', [{
      SekolahID: STATE.sekolahId,
      NamaBarung: document.getElementById('fNamaBarung').value.trim(),
      WarnaBarung: document.getElementById('fWarnaBarung').value
    }]);

    toast('Barung berhasil dibuat.');
    await loadBarung();
    await loadPendamping();

  } catch (err) {
    toast(err.message, true);
  }
}

/* =========================================================
 *  PENDAMPING (Ketua Barung + 2 Pendamping)
 * ========================================================= */

const PERAN_LABEL = { KetuaBarung: 'Ketua Barung', Pendamping1: 'Pendamping 1', Pendamping2: 'Pendamping 2' };

async function loadPendamping() {

  const el = document.getElementById('pendampingContent');

  if (!STATE.barung) {

    el.innerHTML = '<div class="empty-note">Buat Barung terlebih dahulu di tab Barung sebelum menambahkan pendamping.</div>';
    return;
  }

  try {

    const list = await callApi('getPendampingList', [STATE.barung.ID]);
    STATE.pendampingList = list;

    el.innerHTML = ['KetuaBarung', 'Pendamping1', 'Pendamping2'].map(function (peran) {

      const p = list.find(function (x) { return x.Peran === peran; });

      return (
        '<div class="pendamping-card">' +
          '<div class="role-tag">' + PERAN_LABEL[peran] + '</div>' +
          (p
            ? ('<div class="name">' + escapeHtml(p.Nama) + '</div><div class="phone">' + escapeHtml(p.NomorHP || '-') + '</div>' +
               '<div style="margin-top:10px"><button class="btn-secondary btn-sm" onclick="openPendampingForm(\'' + peran + '\',\'' + p.ID + '\',\'' + encodeURIComponent(p.Nama) + '\',\'' + encodeURIComponent(p.NomorHP || '') + '\')">Edit</button></div>')
            : ('<div class="empty">Belum diisi</div>' +
               '<div style="margin-top:10px"><button class="btn-secondary btn-sm" onclick="openPendampingForm(\'' + peran + '\',null,\'\',\'\')">+ Isi</button></div>')
          ) +
        '</div>'
      );
    }).join('');

  } catch (e) {
    el.innerHTML = '<div class="empty-note">Gagal memuat: ' + escapeHtml(e.message) + '</div>';
  }
}

function openPendampingForm(peran, id, namaEnc, hpEnc) {

  const nama = namaEnc ? decodeURIComponent(namaEnc) : '';
  const hp = hpEnc ? decodeURIComponent(hpEnc) : '';

  openModal(PERAN_LABEL[peran], (
    '<form id="modalForm" class="form-grid single">' +
      '<div><label>Nama Lengkap</label><input id="mNama" value="' + escapeHtml(nama) + '" required></div>' +
      '<div><label>Nomor HP</label><input id="mHp" value="' + escapeHtml(hp) + '" placeholder="08xxxxxxxxxx"></div>' +
      '<div class="modal-actions">' +
        '<button type="button" class="btn-secondary" onclick="closeModal()">Batal</button>' +
        '<button type="submit" class="btn-primary" style="width:auto;padding:10px 20px">Simpan</button>' +
      '</div>' +
    '</form>'
  ));

  document.getElementById('modalForm').addEventListener('submit', async function (e) {

    e.preventDefault();

    try {

      await callApi('savePendamping', [{
        ID: id,
        BarungID: STATE.barung.ID,
        SekolahID: STATE.sekolahId,
        Nama: document.getElementById('mNama').value.trim(),
        Peran: peran,
        NomorHP: document.getElementById('mHp').value.trim()
      }]);

      closeModal();
      toast('Data pendamping tersimpan.');
      await loadPendamping();

    } catch (err) {
      toast(err.message, true);
    }
  });
}

/* =========================================================
 *  PESERTA
 * ========================================================= */

async function loadPeserta() {

  const el = document.getElementById('pesertaContent');

  try {

    const list = await callApi('getPesertaList', [{ sekolahId: STATE.isPanitia ? STATE.sekolahId : undefined }]);
    STATE.pesertaList = list;

    if (list.length === 0) {
      el.innerHTML = '<div class="empty-note">Belum ada peserta. Klik "+ Tambah Peserta" untuk mulai.</div>';
      return;
    }

    el.innerHTML =
      '<table class="data-table"><thead><tr>' +
        '<th>Nama</th><th>Tanggal Lahir</th><th>Usia</th><th>Status</th><th>Dokumen</th><th></th>' +
      '</tr></thead><tbody>' +
      list.map(function (p) {
        return (
          '<tr>' +
            '<td><b>' + escapeHtml(p.NamaLengkap) + '</b><br><span style="color:var(--ink-400);font-size:11.5px">' + escapeHtml(p.TempatLahir) + '</span></td>' +
            '<td>' + formatTanggalPendek(p.TanggalLahir) + '</td>' +
            '<td>' + p.UsiaTahun + ' th ' + p.UsiaBulan + ' bl</td>' +
            '<td><span class="pill" style="background:' + STATUS_COLOR[p.StatusVerifikasi] + '22;color:' + STATUS_COLOR[p.StatusVerifikasi] + '">' + STATUS_LABEL[p.StatusVerifikasi] + '</span></td>' +
            '<td><button class="btn-secondary btn-sm" onclick="openUploadDokumen(\'' + p.ID + '\')">📄 Upload</button></td>' +
            '<td class="row-actions">' +
              '<button class="btn-secondary btn-sm" onclick="openPesertaForm(\'' + p.ID + '\')">Edit</button>' +
              '<button class="btn-secondary btn-sm btn-danger-outline" onclick="onDeletePeserta(\'' + p.ID + '\')">Hapus</button>' +
            '</td>' +
          '</tr>'
        );
      }).join('') +
      '</tbody></table>';

  } catch (e) {
    el.innerHTML = '<div class="empty-note">Gagal memuat: ' + escapeHtml(e.message) + '</div>';
  }
}

function openPesertaForm(pesertaId) {

  if (!STATE.barung) {
    toast('Buat Barung terlebih dahulu sebelum menambahkan peserta.', true);
    return;
  }

  const existing = pesertaId ? STATE.pesertaList.find(function (p) { return String(p.ID) === String(pesertaId); }) : null;

  openModal(existing ? 'Edit Peserta' : 'Tambah Peserta', (
    '<form id="modalForm" class="form-grid">' +
      '<div class="field-full"><label>Nama Lengkap</label><input id="mNama" value="' + escapeHtml(existing ? existing.NamaLengkap : '') + '" required></div>' +
      '<div><label>Tempat Lahir</label><input id="mTempat" value="' + escapeHtml(existing ? existing.TempatLahir : '') + '" required></div>' +
      '<div><label>Tanggal Lahir</label><input id="mTanggal" type="date" value="' + (existing ? existing.TanggalLahir.substring(0, 10) : '') + '" required></div>' +
      '<div><label>Jenis Kelamin</label><select id="mJk"><option value="Laki-laki"' + (existing && existing.JenisKelamin === 'Laki-laki' ? ' selected' : '') + '>Laki-laki</option><option value="Perempuan"' + (existing && existing.JenisKelamin === 'Perempuan' ? ' selected' : '') + '>Perempuan</option></select></div>' +
      '<div class="field-full" id="usiaPreview"></div>' +
      '<div class="field-full modal-actions">' +
        '<button type="button" class="btn-secondary" onclick="closeModal()">Batal</button>' +
        '<button type="submit" class="btn-primary" style="width:auto;padding:10px 20px">Simpan</button>' +
      '</div>' +
    '</form>'
  ));

  const tglInput = document.getElementById('mTanggal');
  const previewEl = document.getElementById('usiaPreview');

  async function updatePreview() {

    if (!tglInput.value) { previewEl.innerHTML = ''; return; }

    try {

      const hasil = await callApi('cekKelayakanUsiaPreview', [tglInput.value]);
      const cls = hasil.eligible ? 'ok' : 'bad';
      const teks = hasil.eligible
        ? ('✅ Usia ' + hasil.usia.tahun + ' tahun ' + hasil.usia.bulan + ' bulan pada hari kegiatan — memenuhi syarat.')
        : ('⛔ Usia ' + hasil.usia.tahun + ' tahun ' + hasil.usia.bulan + ' bulan pada hari kegiatan — TIDAK memenuhi syarat (' + hasil.usiaMin + '–<' + hasil.usiaMaks + ' tahun).');

      previewEl.innerHTML = '<div class="usia-preview ' + cls + '">' + teks + '</div>';

    } catch (e) {
      previewEl.innerHTML = '';
    }
  }

  tglInput.addEventListener('change', updatePreview);
  if (tglInput.value) updatePreview();

  document.getElementById('modalForm').addEventListener('submit', async function (e) {

    e.preventDefault();

    try {

      await callApi('savePeserta', [{
        ID: pesertaId || undefined,
        BarungID: STATE.barung.ID,
        SekolahID: STATE.sekolahId,
        NamaLengkap: document.getElementById('mNama').value.trim(),
        TempatLahir: document.getElementById('mTempat').value.trim(),
        TanggalLahir: tglInput.value,
        JenisKelamin: document.getElementById('mJk').value
      }]);

      closeModal();
      toast('Data peserta tersimpan.');
      await loadPeserta();

    } catch (err) {
      toast(err.message, true);
    }
  });
}

async function onDeletePeserta(pesertaId) {

  if (!confirm('Hapus peserta ini? Data yang sudah dihapus tidak dapat dikembalikan.')) return;

  try {
    await callApi('deletePeserta', [pesertaId]);
    toast('Peserta dihapus.');
    await loadPeserta();
  } catch (e) {
    toast(e.message, true);
  }
}

function openUploadDokumen(pesertaId) {

  openModal('Upload Dokumen Peserta', (
    '<div class="form-grid single">' +
      '<div><label>Jenis Dokumen</label><select id="mJenisDok">' +
        '<option value="KartuKeluarga">Kartu Keluarga</option>' +
        '<option value="AktaKelahiran">Akta Kelahiran</option>' +
        '<option value="Lainnya">Lainnya</option>' +
      '</select></div>' +
      '<div class="file-drop" id="dropZone">Klik untuk pilih file (JPG/PNG/PDF)<input type="file" id="mFile" accept=".jpg,.jpeg,.png,.pdf" style="display:none"></div>' +
      '<div id="uploadStatus"></div>' +
      '<div class="modal-actions">' +
        '<button type="button" class="btn-secondary" onclick="closeModal()">Tutup</button>' +
      '</div>' +
    '</div>'
  ));

  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('mFile');
  const statusEl = document.getElementById('uploadStatus');

  dropZone.addEventListener('click', function () { fileInput.click(); });

  fileInput.addEventListener('change', async function () {

    const file = fileInput.files[0];
    if (!file) return;

    statusEl.innerHTML = '<div class="loading-note">Mengunggah &amp; memproses OCR… bisa memakan waktu beberapa detik.</div>';

    try {

      const base64 = await fileToBase64(file);

      const result = await callApi('uploadDokumenPeserta', [{
        PesertaID: pesertaId,
        JenisDokumen: document.getElementById('mJenisDok').value,
        base64Data: base64,
        mimeType: file.type,
        filename: file.name
      }]);

      const hasil = result.hasilVerifikasi;

      statusEl.innerHTML =
        '<div class="usia-preview ' + (hasil.status === 'VERIFIED' ? 'ok' : 'bad') + '">' +
        'Status OCR: ' + result.ocrStatus + '<br>Hasil verifikasi: <b>' + STATUS_LABEL[hasil.status] + '</b><br>' + escapeHtml(hasil.alasan) +
        '</div>';

      await loadPeserta();

    } catch (err) {
      statusEl.innerHTML = '<div class="usia-preview bad">Gagal upload: ' + escapeHtml(err.message) + '</div>';
    }
  });
}

/* =========================================================
 *  MODAL HELPER
 * ========================================================= */

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
