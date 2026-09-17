(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const q = (s,r=document)=>r.querySelector(s);
  const all = (s,r=document)=>[...r.querySelectorAll(s)];
  const SINGLE = '.card,.meal-grid > article,.page-head,.hero > *,.features > *,.ck-hero > *';
  const GROUPS = ['.ck-plans','.ck-offers','.ck-steps','.ck-stats','.ck-order','.ck-panels'];
  const io = new IntersectionObserver(entries => entries.forEach(x => {
    if (x.isIntersecting) { x.target.classList.add('is-visible'); io.unobserve(x.target); }
  }), {threshold:.08});
  const gio = new IntersectionObserver(entries => entries.forEach(x => {
    if (!x.isIntersecting) return;
    gio.unobserve(x.target);
    all(':scope > *', x.target).forEach((k, i) => {
      if (!k.classList.contains('reveal')) return;
      k.style.transitionDelay = `${i * 70}ms`;
      requestAnimationFrame(() => k.classList.add('is-visible'));
    });
    setTimeout(() => all(':scope > *', x.target).forEach(k => { k.style.transitionDelay = ''; }), 1500);
  }), {threshold:.1});
  const observe = () => {
    if (reduced) return;
    all(SINGLE).forEach(el => { if (el.classList.contains('reveal')) return; el.classList.add('reveal'); io.observe(el); });
    GROUPS.forEach(sel => all(sel).forEach(g => {
      if (g.dataset.revealed) return;
      all(':scope > *', g).forEach(k => { if (k.classList.contains('reveal')) return; k.classList.add('reveal'); });
      gio.observe(g);
      g.dataset.revealed = '1';
    }));
  };
  const isMobile = () => matchMedia('(max-width: 767px)').matches;
  const tilt = () => {
    if (reduced || !matchMedia('(pointer:fine)').matches) return;
    all('.ck-plan,.ck-offer,.ck-order__card').forEach(card => {
      if (card.dataset.tilt) return;
      card.dataset.tilt = '1';
      card.addEventListener('pointermove', e => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - .5;
        const py = (e.clientY - r.top) / r.height - .5;
        card.style.transform = `perspective(900px) rotateY(${px * 6}deg) rotateX(${-py * 6}deg) translateY(-3px)`;
      });
      card.addEventListener('pointerleave', () => { card.style.transform = ''; });
    });
  };
  const magnetic = () => {
    if (reduced || !matchMedia('(pointer:fine)').matches) return;
    all('.ck-hero__actions .btn,.ck-cta .btn').forEach(b => {
      if (b.dataset.mag) return;
      b.dataset.mag = '1';
      b.addEventListener('pointermove', e => {
        const r = b.getBoundingClientRect();
        const dx = (e.clientX - r.left - r.width / 2) / r.width;
        const dy = (e.clientY - r.top - r.height / 2) / r.height;
        b.style.transform = `translate(${dx * 10}px, ${dy * 8}px)`;
      });
      b.addEventListener('pointerleave', () => { b.style.transform = ''; });
    });
  };
  const ripple = e => {
    const b=e.target.closest('.btn'); if(!b || reduced) return;
    const r=document.createElement('span'); r.className='ripple'; const box=b.getBoundingClientRect();
    r.style.left=`${e.clientX-box.left}px`; r.style.top=`${e.clientY-box.top}px`; b.appendChild(r); setTimeout(()=>r.remove(),550);
  };
  const theme = () => {
    all('[data-theme-toggle]').forEach(b => {
      if (b.dataset.wired) return;
      b.dataset.wired = '1';
      b.onclick = () => {
        const root = document.documentElement;
        const dark = root.dataset.theme === 'dark';
        root.dataset.theme = dark ? 'light' : 'dark';
        try { localStorage.setItem('tiffin-theme', root.dataset.theme); } catch {}
        b.animate([{transform:'rotate(0)'},{transform:'rotate(180deg)'},{transform:'rotate(360deg)'}], {duration:420,easing:'ease-out'});
      };
    });
  };
  const favorites = () => {
    let fav = []; try { fav = JSON.parse(localStorage.getItem('tiffin-favs') || '[]'); } catch {}
    const save = () => { try { localStorage.setItem('tiffin-favs', JSON.stringify(fav)); } catch {} };
    const wire = () => all('[data-favorite]').forEach(b => {
      if (b.dataset.wired) return;
      b.dataset.wired = '1';
      const id = b.dataset.favorite;
      b.setAttribute('aria-pressed', fav.includes(id));
      b.textContent = fav.includes(id) ? '♥' : '♡';
      b.onclick = () => {
        fav = fav.includes(id) ? fav.filter(x => x !== id) : [...fav, id];
        b.setAttribute('aria-pressed', fav.includes(id));
        b.textContent = fav.includes(id) ? '♥' : '♡';
        b.classList.add('heart-pop');
        setTimeout(() => b.classList.remove('heart-pop'), 280);
        save();
      };
    });
    wire();
    if (!favorites._observer) {
      favorites._observer = new MutationObserver(wire);
      favorites._observer.observe(document.body, {subtree: true, childList: true});
    }
  };
  const addAmbient = () => {
    if(reduced || q('.ambient')) return;
    const host=document.createElement('div');host.className='ambient';host.setAttribute('aria-hidden','true');
    ['✦','·','✦','·','✧'].forEach((x,i)=>{const s=document.createElement('span');s.textContent=x;s.style.setProperty('--i',i);host.appendChild(s)}); document.body.appendChild(host);
  };

  const lazyLoad = () => {
    if (reduced) return;
    const lio = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-loaded');
          lio.unobserve(entry.target);
        }
      });
    }, {rootMargin: '100px', threshold: 0.05});
    all('.ck-panel, .ck-plan, .ck-offer, .ck-step, .ck-order__card, .ck-stat, .day-card, .meal-grid > article').forEach(el => {
      el.classList.add('lazy-load');
      lio.observe(el);
    });
  };
  document.addEventListener('click',ripple,{passive:true});
  window.addEventListener('load',()=>{theme();favorites();observe();tilt();magnetic();addAmbient();lazyLoad();});
  let moTimer = 0;
  const debouncedSetup = () => {
    clearTimeout(moTimer);
    moTimer = setTimeout(() => { observe(); tilt(); magnetic(); addAmbient(); lazyLoad(); }, 120);
  };
  new MutationObserver(debouncedSetup).observe(document.body,{subtree:true,childList:true});
})();
