/* auth.js — JWT management and login/register UI
 * Loaded first (before game.js and ui.js).
 * Exposes globals: getToken(), getCurrentUser(), logout(), AuthUI
 */

'use strict';

// ---------------------------------------------------------------------------
// Token helpers
// ---------------------------------------------------------------------------

function getToken() {
  return localStorage.getItem('battleship_token');
}

function getCurrentUser() {
  var token = getToken();
  if (!token) return null;
  try {
    var parts = token.split('.');
    if (parts.length !== 3) return null;
    // Base64url decode the payload segment
    var payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    // Pad to multiple of 4
    while (payload.length % 4 !== 0) {
      payload += '=';
    }
    var decoded = JSON.parse(atob(payload));
    return { id: decoded.id || decoded.sub, username: decoded.username };
  } catch (e) {
    return null;
  }
}

function logout() {
  localStorage.removeItem('battleship_token');
  AuthUI.updateNav();
  // Reconnect socket with no token
  if (typeof connectSocket === 'function' && typeof socket !== 'undefined') {
    if (socket) {
      socket.disconnect();
    }
    connectSocket();
  }
}

// ---------------------------------------------------------------------------
// AuthUI
// ---------------------------------------------------------------------------

var AuthUI = {
  _currentMode: 'login',

  init: function () {
    AuthUI.updateNav();
  },

  showModal: function (mode) {
    AuthUI._currentMode = mode || 'login';
    AuthUI._renderForm();
    var modal = document.getElementById('modal-auth');
    if (modal) {
      modal.removeAttribute('hidden');
      modal.classList.add('active');
    }
  },

  hideModal: function () {
    var modal = document.getElementById('modal-auth');
    if (modal) {
      modal.classList.remove('active');
      modal.setAttribute('hidden', '');
    }
    // Clear any error messages
    var container = document.getElementById('auth-form-container');
    if (container) container.innerHTML = '';
  },

  _renderForm: function () {
    var container = document.getElementById('auth-form-container');
    if (!container) return;
    container.innerHTML = '';

    var mode = AuthUI._currentMode;

    // Title
    var title = document.createElement('h2');
    title.id = 'modal-auth-title';
    title.textContent = mode === 'login' ? 'LOGIN' : 'REGISTER';
    container.appendChild(title);

    // Error display
    var errorEl = document.createElement('div');
    errorEl.id = 'auth-error';
    errorEl.className = 'auth-error';
    errorEl.style.color = '#ff4444';
    errorEl.style.marginBottom = '10px';
    errorEl.style.minHeight = '20px';
    container.appendChild(errorEl);

    var form = document.createElement('form');
    form.id = 'auth-form';
    form.noValidate = true;

    // Username field (register only)
    if (mode === 'register') {
      var usernameGroup = document.createElement('div');
      usernameGroup.className = 'form-group';

      var usernameLabel = document.createElement('label');
      usernameLabel.textContent = 'USERNAME';
      usernameLabel.setAttribute('for', 'auth-username');
      usernameGroup.appendChild(usernameLabel);

      var usernameInput = document.createElement('input');
      usernameInput.type = 'text';
      usernameInput.id = 'auth-username';
      usernameInput.className = 'input-terminal';
      usernameInput.placeholder = 'Choose a username';
      usernameInput.required = true;
      usernameInput.autocomplete = 'username';
      usernameGroup.appendChild(usernameInput);

      form.appendChild(usernameGroup);
    }

    // Email / identifier field
    var emailGroup = document.createElement('div');
    emailGroup.className = 'form-group';

    var emailLabel = document.createElement('label');
    emailLabel.textContent = mode === 'login' ? 'USERNAME OR EMAIL' : 'EMAIL';
    emailLabel.setAttribute('for', 'auth-email');
    emailGroup.appendChild(emailLabel);

    var emailInput = document.createElement('input');
    emailInput.type = mode === 'login' ? 'text' : 'email';
    emailInput.id = 'auth-email';
    emailInput.className = 'input-terminal';
    emailInput.placeholder = mode === 'login' ? 'Username or email' : 'your@email.com';
    emailInput.required = true;
    emailInput.autocomplete = 'email';
    emailGroup.appendChild(emailInput);

    form.appendChild(emailGroup);

    // Password field
    var passwordGroup = document.createElement('div');
    passwordGroup.className = 'form-group';

    var passwordLabel = document.createElement('label');
    passwordLabel.textContent = 'PASSWORD';
    passwordLabel.setAttribute('for', 'auth-password');
    passwordGroup.appendChild(passwordLabel);

    var passwordInput = document.createElement('input');
    passwordInput.type = 'password';
    passwordInput.id = 'auth-password';
    passwordInput.className = 'input-terminal';
    passwordInput.placeholder = mode === 'login' ? 'Enter password' : 'Choose a password';
    passwordInput.required = true;
    passwordInput.autocomplete = mode === 'login' ? 'current-password' : 'new-password';
    passwordGroup.appendChild(passwordInput);

    form.appendChild(passwordGroup);

    // Submit button
    var submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.className = 'btn-terminal';
    submitBtn.style.width = '100%';
    submitBtn.style.marginTop = '12px';
    submitBtn.textContent = mode === 'login' ? 'LOGIN' : 'CREATE ACCOUNT';
    form.appendChild(submitBtn);

    // Form submit handler
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = emailInput.value.trim();
      var password = passwordInput.value;

      if (mode === 'login') {
        AuthUI.handleLogin(email, password);
      } else {
        var username = document.getElementById('auth-username');
        AuthUI.handleRegister(username ? username.value.trim() : '', email, password);
      }
    });

    container.appendChild(form);

    // Toggle link
    var toggleP = document.createElement('p');
    toggleP.style.textAlign = 'center';
    toggleP.style.marginTop = '16px';
    toggleP.style.fontSize = '0.85em';

    var toggleText = document.createTextNode(
      mode === 'login' ? 'No account? ' : 'Already have an account? '
    );
    toggleP.appendChild(toggleText);

    var toggleLink = document.createElement('a');
    toggleLink.href = '#';
    toggleLink.textContent = mode === 'login' ? 'Register' : 'Login';
    toggleLink.style.color = '#00ff80';
    toggleLink.addEventListener('click', function (e) {
      e.preventDefault();
      AuthUI.showModal(mode === 'login' ? 'register' : 'login');
    });
    toggleP.appendChild(toggleLink);

    container.appendChild(toggleP);
  },

  _showError: function (message) {
    var errorEl = document.getElementById('auth-error');
    if (errorEl) errorEl.textContent = message;
  },

  handleLogin: function (email, password) {
    fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, password: password })
    })
      .then(function (res) {
        return res.json().then(function (data) {
          return { status: res.status, data: data };
        });
      })
      .then(function (result) {
        if (result.status === 200 && result.data.token) {
          localStorage.setItem('battleship_token', result.data.token);
          AuthUI.updateNav();
          AuthUI.hideModal();
          if (typeof trackEvent === 'function') trackEvent('login');
          // Reconnect socket with new token
          if (typeof connectSocket === 'function' && typeof socket !== 'undefined') {
            if (socket) socket.disconnect();
            connectSocket();
          }
        } else {
          var msg = result.data.message || result.data.error || 'Login failed';
          AuthUI._showError(msg);
        }
      })
      .catch(function () {
        AuthUI._showError('Network error. Please try again.');
      });
  },

  handleRegister: function (username, email, password) {
    fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username, email: email, password: password })
    })
      .then(function (res) {
        return res.json().then(function (data) {
          return { status: res.status, data: data };
        });
      })
      .then(function (result) {
        if ((result.status === 200 || result.status === 201) && result.data.token) {
          localStorage.setItem('battleship_token', result.data.token);
          AuthUI.updateNav();
          AuthUI.hideModal();
          if (typeof trackEvent === 'function') trackEvent('account_created');
          // Reconnect socket with new token
          if (typeof connectSocket === 'function' && typeof socket !== 'undefined') {
            if (socket) socket.disconnect();
            connectSocket();
          }
        } else {
          var msg = result.data.message || result.data.error || 'Registration failed';
          AuthUI._showError(msg);
        }
      })
      .catch(function () {
        AuthUI._showError('Network error. Please try again.');
      });
  },

  updateNav: function () {
    var user = getCurrentUser();
    var navControls = document.querySelector('.nav-controls');
    if (!navControls) return;

    // Remove existing auth-related nav elements
    var existingLogin = document.getElementById('btn-login');
    var existingUserInfo = document.getElementById('nav-user-info');
    var existingLogout = document.getElementById('btn-logout');
    if (existingLogin) existingLogin.remove();
    if (existingUserInfo) existingUserInfo.remove();
    if (existingLogout) existingLogout.remove();

    if (user) {
      // Show username with icon
      var userInfo = document.createElement('span');
      userInfo.id = 'nav-user-info';
      userInfo.className = 'nav-username';
      var icon = document.createElement('span');
      icon.innerHTML = '<svg class="nav-user-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
      userInfo.appendChild(icon.firstChild);
      userInfo.appendChild(document.createTextNode(' ' + user.username));
      userInfo.style.cursor = 'crosshair';
      userInfo.addEventListener('click', function () {
        if (typeof showScreen === 'function') showScreen('screen-stats');
      });

      // Show logout button
      var logoutBtn = document.createElement('button');
      logoutBtn.id = 'btn-logout';
      logoutBtn.className = 'nav-btn';
      logoutBtn.textContent = 'LOGOUT';
      logoutBtn.setAttribute('aria-label', 'Logout');
      logoutBtn.addEventListener('click', function () {
        logout();
      });

      navControls.appendChild(userInfo);
      navControls.appendChild(logoutBtn);
    } else {
      // Show login button
      var loginBtn = document.createElement('button');
      loginBtn.id = 'btn-login';
      loginBtn.className = 'nav-btn';
      loginBtn.textContent = 'LOGIN';
      loginBtn.setAttribute('aria-label', 'Login or register');
      loginBtn.addEventListener('click', function () {
        AuthUI.showModal('login');
      });
      navControls.appendChild(loginBtn);
    }
  }
};
