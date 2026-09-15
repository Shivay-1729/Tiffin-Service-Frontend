(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const q = (s,r=document)=>r.querySelector(s);
  const all = (s,r=document)=>[...r.querySelectorAll(s)];
  const observe = () => {
    if (reduced) return;
    const io = new IntersectionObserver(entries => entries.forEach(x => {
      if (x.isIntersecting) { x.target.classList.add('is-visible'); io.unobserve(x.target); }
    }), {threshold:.08});
    all('.card,.meal-grid > article,.page-head,.hero > *,.features > *').forEach(el=>{el.classList.add('reveal');io.observe(el)});
  };
  const ripple = e => {
    const b=e.target.closest('.btn'); if(!b || reduced) return;
    const r=document.createElement('span'); r.className='ripple'; const box=b.getBoundingClientRect();
    r.style.left=`${e.clientX-box.left}px`; r.style.top=`${e.clientY-box.top}px`; b.appendChild(r); setTimeout(()=>r.remove(),550);
  };
  const theme = () => {
    all('[data-theme-toggle]').forEach(b=>b.onclick=()=>{
      const root=document.documentElement, dark=root.dataset.theme==='dark'; root.dataset.theme=dark?'light':'dark';
      try{localStorage.setItem('tiffin-theme',root.dataset.theme)}catch{}
      b.animate([{transform:'rotate(0)'},{transform:'rotate(180deg)'},{transform:'rotate(360deg)'}],{duration:420,easing:'ease-out'});
    });
  };
  const favorites = () => {
    let fav=[]; try{fav=JSON.parse(localStorage.getItem('tiffin-favs')||'[]')}catch{}
    const save=()=>{try{localStorage.setItem('tiffin-favs',JSON.stringify(fav))}catch{}};
    const wire=()=>all('[data-favorite]').forEach(b=>{ if(b.dataset.wired)return; b.dataset.wired='1'; const id=b.dataset.favorite; b.setAttribute('aria-pressed',fav.includes(id)); b.textContent=fav.includes(id)?'♥':'♡'; b.onclick=()=>{fav=fav.includes(id)?fav.filter(x=>x!==id):[...fav,id]; b.setAttribute('aria-pressed',fav.includes(id));b.textContent=fav.includes(id)?'♥':'♡';b.classList.add('heart-pop');setTimeout(()=>b.classList.remove('heart-pop'),280);save();};});
    wire(); new MutationObserver(wire).observe(document.body,{subtree:true,childList:true});
  };
  const addAmbient = () => {
    if(reduced || q('.ambient')) return;
    const host=document.createElement('div');host.className='ambient';host.setAttribute('aria-hidden','true');
    ['✦','·','✦','·','✧'].forEach((x,i)=>{const s=document.createElement('span');s.textContent=x;s.style.setProperty('--i',i);host.appendChild(s)}); document.body.appendChild(host);
  };
  document.addEventListener('click',ripple);
  window.addEventListener('load',()=>{theme();favorites();observe();addAmbient();});
  new MutationObserver(()=>{theme();observe();favorites()}).observe(document.body,{subtree:true,childList:true});
})();
