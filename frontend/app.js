(() => {
  const BASE_URL = "https://stebio.onrender.com";

  let q = "", type = "All", sort = "newest", loading = false;

  const $ = id => document.getElementById(id);
  const grid       = $('productGrid');
  const catBar     = $('categoryBar');
  const statP      = $('stat-products');
  const statS      = $('stat-stores');
  const statO      = $('stat-orders');
  const searchInp  = $('search-input');
  const searchBtn  = $('search-button');
  const selectSort = document.getElementById('sort-select');

  const fmt = n => `$${Number(n ?? 0).toFixed(2)}`;
  const params = o => new URLSearchParams(Object.entries(o).filter(([,v]) => v!=="" && v!=null));

  const skels = (n=8) => {
    grid.innerHTML="";
    for(let i=0;i<n;i++){
      const c=document.createElement('div');
      c.className='card';
      c.innerHTML=`<div class="skel h120 r10"></div>
                   <div class="skel h16 r10"></div>
                   <div class="skel h16 r10" style="width:60%"></div>`;
      grid.appendChild(c);
    }
  };

  const renderProducts = items => {
    grid.innerHTML="";
    if(!items.length){
      grid.innerHTML=`<div class="card"><h4>No products yet</h4><p>Try a different filter.</p></div>`;
      return;
    }
    for(const p of items){
      const card=document.createElement('div');
      card.className='card';
      card.innerHTML=`
        <div class="img skel h120 r10"></div>
        <h4>${p.title ?? "Untitled"}</h4>
        <p>${(p.description ?? "").slice(0,120)}</p>
        <div class="meta"><span>${fmt(p.price)}</span><span>${p.type ?? ""}</span></div>
        <div class="actions">
          <button data-id="${p.id}">View</button>
          <a href="#" data-store="${p.storeId ?? ""}">Store</a>
        </div>`;
      card.querySelector('button').onclick=()=>location.href=`product.html?id=${p.id}`;
      card.querySelector('a').onclick=e=>{e.preventDefault();location.href=`store.html?id=${p.storeId}`;};
      grid.appendChild(card);
    }
  };

  const renderStats = s => {
    statP.textContent = s?.totalProducts ?? 0;
    statS.textContent = s?.totalStores  ?? 0;
    statO.textContent = s?.totalOrders  ?? 0;
  };

  const api = async (path, opts={}) => {
    const r = await fetch(`${BASE_URL}${path}`, {headers:{"Content-Type":"application/json"}, ...opts});
    if(!r.ok) throw new Error(`${path} -> ${r.status}`);
    return r.json();
  };

  const loadStats = async () => {
    try { renderStats(await api('/api/stats')); } catch {}
  };

  const loadProducts = async () => {
    if(loading) return; loading=true; skels();
    try{
      const p = params({
        q: q || undefined,
        type: type !== "All" ? type : undefined,
        sort
      });
      const data = await api(`/api/products/search?${p.toString()}`);
      renderProducts(data?.products || data || []);
    }catch(e){
      grid.innerHTML = `<div class="card"><h4>Couldn’t load products</h4><p>${e.message}</p></div>`;
    }finally{ loading=false; }
  };

  if(catBar){
    catBar.addEventListener('click',(e)=>{
      const btn=e.target.closest('button'); if(!btn) return;
      [...catBar.querySelectorAll('button')].forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      type = btn.dataset.category || "All";
      loadProducts();
    });
  }
  if(selectSort){
    selectSort.onchange=()=>{ sort=selectSort.value; loadProducts(); };
  }
  if(searchBtn && searchInp){
    const doSearch=()=>{ q=searchInp.value.trim(); loadProducts(); };
    searchBtn.onclick=doSearch;
    searchInp.onkeydown=e=>{ if(e.key==='Enter') doSearch(); };
  }

  (async function init(){
    await loadStats();
    await loadProducts();
  })();
})();
