let STATE = {
  sekolahId: null, isPanitia: false,
  barungPutra: null, barungPutri: null,
  pendampingAll: [], pesertaList: []
};

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

  await loadProfil();
  await loadBarung();       // harus selesai dulu supaya STATE.barungPutra/Putri terisi
  await loadPendamping();
  await loadPeserta();
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
 *  BARUNG — Putra & Putri, warna otomatis jadi background
 * ========================================================= */

async function loadBarung() {

  const el = document.getElementById('barungContent');

  try {

    const list = await callApi('getBarungList', [STATE.isPanitia ? STATE.sekolahId : null]);
    const milikSekolah = list.filter(function (b) { return String(b.SekolahID) === String(STATE.sekolahId); });

    STATE.barungPutra = milikSekolah.find(function (b) { return b.JenisKelamin === 'Putra'; }) || null;
    STATE.barungPutri = milikSekolah.find(function (b) { return b.JenisKelamin === 'Putri'; }) || null;

    el.innerHTML =
      '<div class="pendamping-grid">' +
        '<div id="barungPutraSlot"></div>' +
        '<div id="barungPutriSlot"></div>' +
      '</div>';

    renderBarungSlot('barungPutraSlot', 'Putra', STATE.barungPutra);
    renderBarungSlot('barungPutriSlot', 'Putri', STATE.barungPutri);

  } catch (e) {
    el.innerHTML = '<div class="empty-note">Gagal memuat: ' + escapeHtml(e.message) + '</div>';
  }
}

function renderBarungSlot(slotId, jenisKelamin, barung) {

  const slot = document.getElementById(slotId);

  if (!barung) {

    slot.innerHTML =
      '<div class="pendamping-card">' +
        '<div class="role-tag">Barung ' + jenisKelamin + '</div>' +
        '<form id="formBarung' + jenisKelamin + '" class="form-grid single" style="margin-top:10px">' +
          '<div><label>Pilih Warna Barung</label>' +
            '<select id="fWarna' + jenisKelamin + '" required onchange="updateSwatch(\'' + jenisKelamin + '\')">' +
              '<option value="">— Pilih warna —</option>' +
              WARNA_BARUNG_OPTIONS.map(function (w) { return '<option value="' + w + '">' + w + '</option>'; }).join('') +
            '</select>' +
          '</div>' +
          '<div id="swatch' + jenisKelamin + '" style="height:34px;border-radius:8px;border:1.5px solid var(--line)"></div>' +
          '<div><button type="submit" class="btn-primary" style="width:auto;padding:10px 18px">Buat Barung ' + jenisKelamin + '</button></div>' +
        '</form>' +
      '</div>';

    document.getElementById('formBarung' + jenisKelamin).addEventListener('submit', function (e) {
      onCreateBarung(e, jenisKelamin);
    });

  } else {

    const hex = WARNA_BARUNG_HEX[barung.WarnaBarung] || '#0f766e';
    const textColor = warnaTeksKontras(hex);

    slot.innerHTML =
      '<div class="pendamping-card" style="background:' + hex + ';color:' + textColor + ';border-color:' + hex + '">' +
        '<div class="role-tag" style="color:' + textColor + ';opacity:0.85">Barung ' + jenisKelamin + '</div>' +
        '<div class="name" style="color:' + textColor + '">' + escapeHtml(barung.NamaBarung) + '</div>' +
        '<div class="phone" style="color:' + textColor + ';opacity:0.85">Warna: ' + escapeHtml(barung.WarnaBarung) + '</div>' +
        '<div class="phone" style="color:' + textColor + ';opacity:0.85">Status QR: ' + escapeHtml(barung.StatusQR || 'BELUM_DIBUAT') + '</div>' +
      '</div>';
  }
}

function updateSwatch(jenisKelamin) {

  const val = document.getElementById('fWarna' + jenisKelamin).value;
  const swatch = document.getElementById('swatch' + jenisKelamin);

  swatch.style.background = val ? (WARNA_BARUNG_HEX[val] || '#e2ebe8') : 'transparent';
}

async function onCreateBarung(e, jenisKelamin) {

  e.preventDefault();

  const warna = document.getElementById('fWarna' + jenisKelamin).value;

  if (!warna) {
    toast('Pilih warna barung dulu.', true);
    return;
  }

  try {

    await callApi('saveBarung', [{
      SekolahID: STATE.sekolahId,
      NamaBarung: 'Barung ' + warna,
      WarnaBarung: warna,
      JenisKelamin: jenisKelamin
    }]);

    toast('Barung ' + jenisKelamin + ' berhasil dibuat.');
    await loadBarung();
    await loadPendamping();
    await loadPeserta();

  } catch (err) {
    toast(err.message, true);
  }
}

/* =========================================================
 *  PENDAMPING — 2 orang per barung (Putra & Putri terpisah)
 * ========================================================= */

async function loadPendamping() {

  const el = document.getElementById('pendampingContent');

  const barungAktif = [STATE.barungPutra, STATE.barungPutri].filter(Boolean);

  if (barungAktif.length === 0) {
    el.innerHTML = '<div class="empty-note">Buat Barung Putra dan/atau Putri terlebih dahulu di tab Barung.</div>';
    return;
  }

  try {

    const results = await Promise.all(
      barungAktif.map(function (b) { return callApi('getPendampingList', [b.ID]); })
    );

    STATE.pendampingAll = [].concat.apply([], results);

    el.innerHTML = barungAktif.map(function (barung) {
      return renderPendampingGroup(barung);
    }).join('<div style="height:22px"></div>');

  } catch (e) {
    el.innerHTML = '<div class="empty-note">Gagal memuat: ' + escapeHtml(e.message) + '</div>';
  }
}

function renderPendampingGroup(barung) {

  const list = STATE.pendampingAll.filter(function (p) { return String(p.BarungID) === String(barung.ID); });

  const cards = ['Pendamping1', 'Pendamping2'].map(function (peran) {

    const p = list.find(function (x) { return x.Peran === peran; });

    return (
      '<div class="pendamping-card">' +
        (p && p.FotoURL ? '<img src="' + escapeHtml(p.FotoURL) + '" style="width:56px;height:56px;border-radius:50%;object-fit:cover;margin-bottom:8px">' : '') +
        '<div class="role-tag">' + peran.replace('Pendamping', 'Pendamping ') + '</div>' +
        (p
          ? ('<div class="name">' + escapeHtml(p.Nama) + '</div><div class="phone">' + escapeHtml(p.NomorHP || '-') + '</div>' +
             (p.Biodata ? '<div class="phone" style="margin-top:4px;font-style:italic">' + escapeHtml(p.Biodata) + '</div>' : '') +
             '<div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap">' +
               '<button class="btn-secondary btn-sm" onclick="openPendampingForm(\'' + barung.ID + '\',\'' + peran + '\',\'' + p.ID + '\',\'' + encodeURIComponent(p.Nama) + '\',\'' + encodeURIComponent(p.NomorHP || '') + '\',\'' + encodeURIComponent(p.Biodata || '') + '\')">Edit</button>' +
               '<button class="btn-secondary btn-sm" onclick="openUploadFotoPendamping(\'' + p.ID + '\')">📷 Foto</button>' +
             '</div>')
          : ('<div class="empty">Belum diisi</div>' +
             '<div style="margin-top:10px"><button class="btn-secondary btn-sm" onclick="openPendampingForm(\'' + barung.ID + '\',\'' + peran + '\',null,\'\',\'\',\'\')">+ Isi</button></div>')
        ) +
      '</div>'
    );
  }).join('');

  return (
    '<div style="font-weight:700;font-size:13.5px;margin-bottom:10px">Barung ' + barung.JenisKelamin + ' — ' + escapeHtml(barung.NamaBarung) + '</div>' +
    '<div class="pendamping-grid">' + cards + '</div>'
  );
}

function openPendampingForm(barungId, peran, id, namaEnc, hpEnc, bioEnc) {

  const nama = namaEnc ? decodeURIComponent(namaEnc) : '';
  const hp = hpEnc ? decodeURIComponent(hpEnc) : '';
  const bio = bioEnc ? decodeURIComponent(bioEnc) : '';

  openModal(peran.replace('Pendamping', 'Pendamping '), (
    '<form id="modalForm" class="form-grid single">' +
      '<div><label>Nama Lengkap</label><input id="mNama" value="' + escapeHtml(nama) + '" required></div>' +
      '<div><label>Nomor HP</label><input id="mHp" value="' + escapeHtml(hp) + '" placeholder="08xxxxxxxxxx"></div>' +
      '<div><label>Biodata Singkat</label><input id="mBio" value="' + escapeHtml(bio) + '" placeholder="mis. Guru Kelas 2 / Pembina Pramuka"></div>' +
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
        BarungID: barungId,
        SekolahID: STATE.sekolahId,
        Nama: document.getElementById('mNama').value.trim(),
        Peran: peran,
        NomorHP: document.getElementById('mHp').value.trim(),
        Biodata: document.getElementById('mBio').value.trim()
      }]);

      closeModal();
      toast('Data pendamping tersimpan.');
      await loadPendamping();

    } catch (err) {
      toast(err.message, true);
    }
  });
}

function openUploadFotoPendamping(pendampingId) {

  openModal('Upload Foto Pendamping', (
    '<div class="form-grid single">' +
      '<div class="file-drop" id="dropZonePendamping">Klik untuk pilih foto (JPG/PNG/WebP)<input type="file" id="mFotoPendamping" accept=".jpg,.jpeg,.png,.webp" style="display:none"></div>' +
      '<div id="fotoPendampingStatus"></div>' +
      '<div class="modal-actions"><button type="button" class="btn-secondary" onclick="closeModal()">Tutup</button></div>' +
    '</div>'
  ));

  const dropZone = document.getElementById('dropZonePendamping');
  const fileInput = document.getElementById('mFotoPendamping');
  const statusEl = document.getElementById('fotoPendampingStatus');

  dropZone.addEventListener('click', function () { fileInput.click(); });

  fileInput.addEventListener('change', async function () {

    const file = fileInput.files[0];
    if (!file) return;

    statusEl.innerHTML = '<div class="loading-note">Mengunggah foto…</div>';

    try {

      const base64 = await fileToBase64(file);

      await callApi('uploadFotoPendamping', [{
        PendampingID: pendampingId,
        base64Data: base64,
        mimeType: file.type,
        filename: file.name
      }]);

      statusEl.innerHTML = '<div class="usia-preview ok">✅ Foto berhasil diunggah.</div>';
      await loadPendamping();

    } catch (err) {
      statusEl.innerHTML = '<div class="usia-preview bad">Gagal upload: ' + escapeHtml(err.message) + '</div>';
    }
  });
}

/* =========================================================
 *  PESERTA — roster per barung: Pinrung, Wapinrung, Anggota
 * ========================================================= */

async function loadPeserta() {

  const el = document.getElementById('pesertaContent');

  try {

    const list = await callApi('getPesertaList', [{ sekolahId: STATE.isPanitia ? STATE.sekolahId : undefined }]);
    STATE.pesertaList = list;

    const barungAktif = [STATE.barungPutra, STATE.barungPutri].filter(Boolean);

    if (barungAktif.length === 0) {
      el.innerHTML = '<div class="empty-note">Buat Barung terlebih dahulu di tab Barung sebelum menambahkan peserta.</div>';
      return;
    }

    el.innerHTML = barungAktif.map(function (barung) {
      return renderRosterBarung(barung);
    }).join('<div style="height:26px"></div>');

  } catch (e) {
    el.innerHTML = '<div class="empty-note">Gagal memuat: ' + escapeHtml(e.message) + '</div>';
  }
}

function renderRosterBarung(barung) {

  const hex = WARNA_BARUNG_HEX[barung.WarnaBarung] || '#0f766e';
  const textColor = warnaTeksKontras(hex);

  const pendampingBarung = STATE.pendampingAll.filter(function (p) { return String(p.BarungID) === String(barung.ID); });

  const pesertaBarung = STATE.pesertaList
    .filter(function (p) { return String(p.BarungID) === String(barung.ID); })
    .sort(function (a, b) {
      const oa = JABATAN_ORDER[a.Jabatan] != null ? JABATAN_ORDER[a.Jabatan] : 2;
      const ob = JABATAN_ORDER[b.Jabatan] != null ? JABATAN_ORDER[b.Jabatan] : 2;
      return oa - ob || String(a.NamaLengkap).localeCompare(String(b.NamaLengkap));
    });

  const header =
    '<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-radius:12px 12px 0 0;background:' + hex + ';color:' + textColor + '">' +
      '<div><b>Barung ' + barung.JenisKelamin + '</b> — ' + escapeHtml(barung.NamaBarung) + '</div>' +
      '<button class="btn-secondary btn-sm" style="background:rgba(255,255,255,0.9)" onclick="openPesertaForm(null,\'' + barung.ID + '\')">+ Tambah Peserta</button>' +
    '</div>';

  const pendampingRows = pendampingBarung.length === 0
    ? '<div class="action-item"><span class="meta">Pendamping belum diisi</span></div>'
    : pendampingBarung.map(function (p) {
        return (
          '<div class="action-item">' +
            '<div style="display:flex;align-items:center;gap:10px">' +
              (p.FotoURL ? '<img src="' + escapeHtml(p.FotoURL) + '" style="width:32px;height:32px;border-radius:50%;object-fit:cover">' : '<span style="width:32px;height:32px;border-radius:50%;background:var(--line);display:inline-block"></span>') +
              '<div><div class="who">' + escapeHtml(p.Nama) + '</div><div class="meta">' + p.Peran.replace('Pendamping', 'Pendamping ') + '</div></div>' +
            '</div>' +
            '<span class="badge" style="background:var(--teal-100);color:var(--teal-700)">Pendamping</span>' +
          '</div>'
        );
      }).join('');

  const pesertaRows = pesertaBarung.length === 0
    ? '<div class="empty-note">Belum ada peserta di barung ini.</div>'
    : pesertaBarung.map(function (p) {
        return (
          '<div class="action-item">' +
            '<div style="display:flex;align-items:center;gap:10px">' +
              (p.FotoURL ? '<img src="' + escapeHtml(p.FotoURL) + '" style="width:32px;height:32px;border-radius:50%;object-fit:cover;cursor:pointer" onclick="openUploadFoto(\'' + p.ID + '\')">' : '<button class="btn-secondary btn-sm" style="padding:4px 7px" onclick="openUploadFoto(\'' + p.ID + '\')">📷</button>') +
              '<div><div class="who">' + escapeHtml(p.NamaLengkap) + '</div><div class="meta">' + formatTanggalPendek(p.TanggalLahir) + ' · ' + p.UsiaTahun + ' th ' + p.UsiaBulan + ' bl</div></div>' +
            '</div>' +
            '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">' +
              '<span class="badge" style="background:var(--forest-800)11;color:var(--forest-800)">' + (JABATAN_LABEL[p.Jabatan] || 'Anggota') + '</span>' +
              '<span class="pill" style="background:' + STATUS_COLOR[p.StatusVerifikasi] + '22;color:' + STATUS_COLOR[p.StatusVerifikasi] + '">' + STATUS_LABEL[p.StatusVerifikasi] + '</span>' +
              '<button class="btn-secondary btn-sm" onclick="openUploadDokumen(\'' + p.ID + '\')">📄</button>' +
              '<button class="btn-secondary btn-sm" onclick="openPesertaForm(\'' + p.ID + '\')">Edit</button>' +
              '<button class="btn-secondary btn-sm btn-danger-outline" onclick="onDeletePeserta(\'' + p.ID + '\')">Hapus</button>' +
            '</div>' +
          '</div>'
        );
      }).join('');

  return (
    '<div style="border:1.5px solid var(--line);border-radius:12px;overflow:hidden">' +
      header +
      '<div style="padding:8px 16px">' + pendampingRows + pesertaRows + '</div>' +
    '</div>'
  );
}

function openPesertaForm(pesertaId, defaultBarungId) {

  const barungAktif = [STATE.barungPutra, STATE.barungPutri].filter(Boolean);

  if (barungAktif.length === 0) {
    toast('Buat Barung terlebih dahulu sebelum menambahkan peserta.', true);
    return;
  }

  const existing = pesertaId ? STATE.pesertaList.find(function (p) { return String(p.ID) === String(pesertaId); }) : null;
  const barungTerpilih = existing ? existing.BarungID : (defaultBarungId || barungAktif[0].ID);

  openModal(existing ? 'Edit Peserta' : 'Tambah Peserta', (
    '<form id="modalForm" class="form-grid">' +
      '<div class="field-full"><label>Nama Lengkap</label><input id="mNama" value="' + escapeHtml(existing ? existing.NamaLengkap : '') + '" required></div>' +
      '<div><label>Barung</label><select id="mBarung" required>' +
        barungAktif.map(function (b) {
          return '<option value="' + b.ID + '"' + (b.ID === barungTerpilih ? ' selected' : '') + '>Barung ' + b.JenisKelamin + ' — ' + escapeHtml(b.NamaBarung) + '</option>';
        }).join('') +
      '</select></div>' +
      '<div><label>Jabatan</label><select id="mJabatan">' +
        JABATAN_OPTIONS.map(function (j) {
          return '<option value="' + j + '"' + (existing && existing.Jabatan === j ? ' selected' : '') + '>' + JABATAN_LABEL[j] + '</option>';
        }).join('') +
      '</select></div>' +
      '<div><label>Tempat Lahir</label><input id="mTempat" value="' + escapeHtml(existing ? existing.TempatLahir : '') + '" required></div>' +
      '<div><label>Tanggal Lahir</label><input id="mTanggal" type="date" value="' + (existing ? existing.TanggalLahir.substring(0, 10) : '') + '" required></div>' +
      '<div class="field-full"><label>Jenis Kelamin</label><select id="mJk"><option value="Laki-laki"' + (existing && existing.JenisKelamin === 'Laki-laki' ? ' selected' : '') + '>Laki-laki</option><option value="Perempuan"' + (existing && existing.JenisKelamin === 'Perempuan' ? ' selected' : '') + '>Perempuan</option></select></div>' +
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
        BarungID: document.getElementById('mBarung').value,
        SekolahID: STATE.sekolahId,
        NamaLengkap: document.getElementById('mNama').value.trim(),
        TempatLahir: document.getElementById('mTempat').value.trim(),
        TanggalLahir: tglInput.value,
        JenisKelamin: document.getElementById('mJk').value,
        Jabatan: document.getElementById('mJabatan').value
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

function openUploadFoto(pesertaId) {

  openModal('Upload Foto Peserta', (
    '<div class="form-grid single">' +
      '<div class="file-drop" id="fotoDropZone">Klik untuk pilih foto (JPG/PNG/WebP)<input type="file" id="mFoto" accept=".jpg,.jpeg,.png,.webp" style="display:none"></div>' +
      '<div id="fotoStatus"></div>' +
      '<div class="modal-actions">' +
        '<button type="button" class="btn-secondary" onclick="closeModal()">Tutup</button>' +
      '</div>' +
    '</div>'
  ));

  const dropZone = document.getElementById('fotoDropZone');
  const fileInput = document.getElementById('mFoto');
  const statusEl = document.getElementById('fotoStatus');

  dropZone.addEventListener('click', function () { fileInput.click(); });

  fileInput.addEventListener('change', async function () {

    const file = fileInput.files[0];
    if (!file) return;

    statusEl.innerHTML = '<div class="loading-note">Mengunggah foto…</div>';

    try {

      const base64 = await fileToBase64(file);

      await callApi('uploadFotoPeserta', [{
        PesertaID: pesertaId,
        base64Data: base64,
        mimeType: file.type,
        filename: file.name
      }]);

      statusEl.innerHTML = '<div class="usia-preview ok">✅ Foto berhasil diunggah.</div>';
      await loadPeserta();

    } catch (err) {
      statusEl.innerHTML = '<div class="usia-preview bad">Gagal upload: ' + escapeHtml(err.message) + '</div>';
    }
  });
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
