// Determine API base URL. If running on Render (production), point to the same origin;
// otherwise use relative path for local development.
const API_BASE = window.location.hostname.includes('onrender.com')
  ? 'https://stebio.onrender.com'
  : '';
