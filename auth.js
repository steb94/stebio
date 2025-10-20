/*
 * Client-side authentication helpers.
 *
 * This script manages login state in localStorage, updates navigation links
 * according to whether the user is logged in, and provides a logout function.
 */

function updateNav() {
  const token        = localStorage.getItem('token');
  const loginLink    = document.getElementById('loginLink');
  const signupLink   = document.getElementById('signupLink');
  const logoutLink   = document.getElementById('logoutLink');
  const dashboardLink= document.getElementById('dashboardLink');
  if (token) {
    if (loginLink)     loginLink.style.display     = 'none';
    if (signupLink)    signupLink.style.display    = 'none';
    if (logoutLink)    logoutLink.style.display    = 'inline';
    if (dashboardLink) dashboardLink.style.display = 'inline';
  } else {
    if (loginLink)     loginLink.style.display     = 'inline';
    if (signupLink)    signupLink.style.display    = 'inline';
    if (logoutLink)    logoutLink.style.display    = 'none';
    if (dashboardLink) dashboardLink.style.display = 'none';
  }
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('username');
  localStorage.removeItem('role');
}
