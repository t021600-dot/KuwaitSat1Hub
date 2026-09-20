/* login.html — sign in and create an account.

   se-m3: there is no password anywhere on this screen except the box the
   researcher types into. We do not store one, we do not seed one, and we do
   not print one. Supabase Auth holds the hash. The demo-credentials block
   that used to sit under this form has been deleted for that reason. */

(function () {
  var mode = 'signin';
  var form = $('#auth-form');
  var banner = $('#form-banner');

  renderHeader(null);
  renderFooter();

  // Already signed in? Go straight through.
  Data.getCurrentUser().then(function (u) {
    if (u) window.location.replace('missions.html');
  }).catch(function (err) {
    setBanner(banner, 'error', failMessage(err, 'Checking your session'));
  });

  function setMode(next) {
    mode = next;
    var up = mode === 'signup';
    $('#form-title').textContent = up ? 'Create a researcher account' : 'Researcher sign in';
    $('#form-sub').textContent = up
      ? 'Your missions are private to your account from the moment you create it.'
      : 'Sign in to reach your own missions, data and reports.';
    $('#f-name').hidden = !up;
    $('#f-org').hidden = !up;
    $('#submit-btn').textContent = up ? 'Create account' : 'Sign in';
    $('#toggle').textContent = up ? 'I already have an account' : 'Create an account';
    $('#password').setAttribute('autocomplete', up ? 'new-password' : 'current-password');
    hideBanner(banner);
  }

  $('#toggle').addEventListener('click', function () {
    setMode(mode === 'signin' ? 'signup' : 'signin');
  });

  function fieldError(id, msg) {
    var input = $('#' + id), box = $('#e-' + id);
    if (msg) {
      input.setAttribute('aria-invalid', 'true');
      box.textContent = msg;
      box.hidden = false;
    } else {
      input.removeAttribute('aria-invalid');
      box.textContent = '';
      box.hidden = true;
    }
    return !msg;
  }

  function validEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }

  function validate() {
    var ok = true;
    var email = $('#email').value.trim();
    var pass = $('#password').value;
    ok = fieldError('email', email ? (validEmail(email) ? '' : 'Enter a valid email address.') : 'Email is required.') && ok;
    ok = fieldError('password', pass ? (pass.length >= 8 ? '' : 'Password must be at least 8 characters.') : 'Password is required.') && ok;
    if (mode === 'signup') {
      ok = fieldError('name', $('#name').value.trim() ? '' : 'Name is required.') && ok;
      ok = fieldError('org', $('#org').value.trim() ? '' : 'Organization is required.') && ok;
    }
    return ok;
  }

  ['email', 'password', 'name', 'org'].forEach(function (id) {
    $('#' + id).addEventListener('blur', function () {
      if (mode === 'signin' && (id === 'name' || id === 'org')) return;
      validate();
    });
  });

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    hideBanner(banner);
    if (!validate()) return;

    var btn = $('#submit-btn');
    var label = btn.textContent;
    var restore = setBusy(btn, mode === 'signup' ? 'Creating your account…' : 'Signing in…');
    setBanner(banner, 'note', mode === 'signup'
      ? 'Creating your account…' : 'Checking your details…');

    var email = $('#email').value.trim();
    var pass = $('#password').value;
    var run = mode === 'signup'
      ? Data.signUp(email, pass, $('#name').value.trim(), $('#org').value.trim())
      : Data.signIn(email, pass);

    run.then(function (result) {
      if (result && result.needsConfirmation) {
        // Not a failure, and not a success we can act on — say exactly
        // that rather than redirecting to a page that bounces back here.
        restore(label);
        setBanner(banner, 'ok',
          'Account created. Confirm your email address, then sign in here.');
        setMode('signin');
        return;
      }
      setBanner(banner, 'ok', 'Signed in. Opening your missions…');
      window.location.href = 'missions.html';
    }).catch(function (err) {
      restore(label);
      setBanner(banner, 'error',
        failMessage(err, mode === 'signup' ? 'Creating your account' : 'Sign in'));
    });
  });

  setMode('signin');
})();
