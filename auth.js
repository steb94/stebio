// auth.js – handles nav auth link
(() => {
  const navAuth = document.querySelector('.auth-links');
  if (!navAuth) return;
  function render() {
    navAuth.innerHTML = '';
    const loggedIn = localStorage.getItem('loggedIn') === 'true';
    if (loggedIn) {
      const username = localStorage.getItem('username') || 'User';
      const span = document.createElement('span');
      span.textContent = `Hi, ${username}`;
      span.style.marginRight = '1rem';
      navAuth.appendChild(span);
      const btn = document.createElement('button');
      btn.className = 'button ghost';
      btn.textContent = 'Sign out';
      btn.onclick = () => {
        localStorage.removeItem('loggedIn');
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        localStorage.removeItem('role');
        localStorage.removeItem('storeId');
        location.reload();
      };
      navAuth.appendChild(btn);
    } else {
      const link = document.createElement('a');
      link.href = 'login.html';
      link.className = 'button ghost';
      link.textContent = 'Sign in';
      navAuth.appendChild(link);
    }
  }
  render();
})();
