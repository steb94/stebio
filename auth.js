// auth.js
(function() {
  function updateAuthLinks() {
    const nav = document.querySelector('#top-nav .auth-links');
    if (!nav) return;
    nav.innerHTML = '';
    const loggedIn = localStorage.getItem('loggedIn') === 'true';
    const username = localStorage.getItem('username');
    if (loggedIn && username) {
      const hi = document.createElement('span');
      hi.textContent = `Hi, ${username}`;
      const logoutLink = document.createElement('a');
      logoutLink.href = '#';
      logoutLink.textContent = 'Logout';
      logoutLink.addEventListener('click', () => {
        localStorage.clear();
        window.location.href = 'index.html';
      });
      nav.appendChild(hi);
      nav.appendChild(document.createTextNode(' '));
      nav.appendChild(logoutLink);
    } else {
      const signupLink = document.createElement('a');
      signupLink.href = 'signup.html';
      signupLink.textContent = 'Sign Up';
      const signinLink = document.createElement('a');
      signinLink.href = 'login.html';
      signinLink.textContent = 'Sign In';
      nav.appendChild(signupLink);
      nav.appendChild(document.createTextNode(' '));
      nav.appendChild(signinLink);
    }
  }
  document.addEventListener('DOMContentLoaded', updateAuthLinks);
})();
