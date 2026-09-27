// Elemente comune tuturor paginilor: antet cu meniu, subsol, butonul WhatsApp
// și funcții ajutătoare pentru apelurile către API.
(function () {
  const header = document.createElement('header');
  header.className = 'site';
  header.innerHTML = `
    <div class="wrap">
      <a class="logo" href="/">Mov<span>SIM</span></a>
      <nav class="main" aria-label="Meniu principal">
        <a href="/#cum-functioneaza">Cum funcționează</a>
        <a href="/#intrebari">Întrebări</a>
        <a class="btn small" href="/#pachete">Cumpără eSIM</a>
      </nav>
    </div>`;
  document.body.prepend(header);

  const footer = document.createElement('footer');
  footer.className = 'site';
  footer.innerHTML = `
    <div class="wrap">
      <div>© ${new Date().getFullYear()} MovSIM · Plată în lei, livrare pe email</div>
      <nav aria-label="Legal">
        <a href="/termeni.html">Termeni</a>
        <a href="/confidentialitate.html">Confidențialitate</a>
        <a href="https://anpc.ro/" rel="noopener" target="_blank">ANPC</a>
      </nav>
    </div>`;
  document.body.append(footer);

  const wa = document.createElement('a');
  wa.className = 'whatsapp';
  wa.target = '_blank';
  wa.rel = 'noopener';
  wa.setAttribute('aria-label', 'Scrie-ne pe WhatsApp');
  wa.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3C7 3 3 6.6 3 11c0 2.4 1.2 4.6 3.1 6.1L5.5 21l4-2.1c.8.2 1.6.3 2.5.3 5 0 9-3.6 9-8.1S17 3 12 3z"/></svg>';
  wa.hidden = true;
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
    if (cfg.whatsapp) {
      wa.href = `https://wa.me/${cfg.whatsapp}?text=${text}`;
      wa.hidden = false;
    }
    return cfg;
  }).catch(() => ({}));
})();
