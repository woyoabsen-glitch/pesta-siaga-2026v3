(function () {

  // Kalau sudah login, langsung lempar ke dashboard.
  if (Session.isLoggedIn()) {
    window.location.href = 'dashboard.html';
    return;
  }

  const form = document.getElementById('loginForm');
  const errorBox = document.getElementById('errorBox');
  const submitBtn = document.getElementById('submitBtn');

  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.classList.add('show');
  }

  function hideError() {
    errorBox.classList.remove('show');
  }

  form.addEventListener('submit', async function (e) {

    e.preventDefault();
    hideError();

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Memeriksa…';

    try {

      const result = await callApi('login', [username, password], false);

      if (!result.success) {
        showError(result.message || 'Login gagal.');
        return;
      }

      Session.save(result.token, result.user);

      // Operator sekolah -> portal sekolah (Fase 5), panitia -> dashboard.
      if (result.user.role === 'Sekolah') {
        window.location.href = 'dashboard.html'; // sementara sama, portal sekolah menyusul di Fase 5
      } else {
        window.location.href = 'dashboard.html';
      }

    } catch (err) {

      showError(err.message || 'Tidak dapat terhubung ke server.');

    } finally {

      submitBtn.disabled = false;
      submitBtn.textContent = 'Masuk ke Sistem';
    }
  });

})();
