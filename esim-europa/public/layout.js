// Elemente comune tuturor paginilor: antet cu meniu, subsol, butonul WhatsApp
// și funcții ajutătoare pentru apelurile către API.
(function () {
  const header = document.createElement('header');
  header.className = 'site';
  header.innerHTML = `
    <div class="wrap">
      <a class="logo" href="/">Mov<span>SIM</span></a>
      <button class="menu-toggle" type="button" aria-label="Deschide meniul" aria-expanded="false">☰</button>
      <nav class="main" aria-label="Meniu principal">
        <a href="/#pachete">Pachete</a>
        <a href="/#cum-functioneaza">Cum funcționează</a>
        <a href="/#acoperire">Țări</a>
        <a href="/#compatibilitate">Compatibilitate</a>
        <a href="/#intrebari">Întrebări</a>
        <a class="btn" href="/#pachete">Cumpără eSIM</a>
      </nav>
    </div>`;
  document.body.prepend(header);

  const toggle = header.querySelector('.menu-toggle');
  const nav = header.querySelector('nav.main');
  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
  });
  nav.addEventListener('click', (e) => {
    if (e.target.closest('a')) {
      nav.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    }
  });

  const footer = document.createElement('footer');
  footer.className = 'site';
  footer.innerHTML = `
    <div class="wrap">
      <div>© ${new Date().getFullYear()} MovSIM (MVP). Plată în lei, livrare instant pe email.</div>
      <nav aria-label="Legal">
        <a href="/termeni.html">Termeni și condiții</a>
        <a href="/confidentialitate.html">Confidențialitate</a>
        <a href="https://anpc.ro/" rel="noopener" target="_blank">ANPC</a>
      </nav>
    </div>`;
  document.body.append(footer);

  const wa = document.createElement('a');
  wa.className = 'whatsapp';
  wa.target = '_blank';
  wa.rel = 'noopener';
  wa.textContent = 'WhatsApp';
  wa.href = 'https://wa.me/';
  document.body.append(wa);

  window.api = async function (path, options = {}) {
    const res = await fetch(path, {
      method: options.method || 'GET',
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.error || 'Eroare'), { status: res.status, data });
    return data;
  };

  window.appConfig = api('/api/config').then((cfg) => {
    const text = encodeURIComponent('Bună! Am o întrebare despre MovSIM.');
    wa.href = `https://wa.me/${cfg.whatsapp}?text=${text}`;
    return cfg;
  }).catch(() => ({}));
})();
