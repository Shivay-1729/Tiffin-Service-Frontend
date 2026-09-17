import * as THREE from "../../../vendor/three.module.js";

(() => {
  const mount = document.getElementById("stage3d");
  if (!mount) return;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const DAYS = [
    { day: 1, d: "MON", n: "Aloo Gobi", e: "🍛" },
    { day: 2, d: "TUE", n: "Rajma", e: "🫘" },
    { day: 3, d: "WED", n: "Mix Veg", e: "🥗" },
    { day: 4, d: "THU", n: "Bhindi", e: "🍲" },
    { day: 5, d: "FRI", n: "Aloo Matar", e: "🥔" },
    { day: 6, d: "SAT", n: "Palak Paneer", e: "🧀" },
    { day: 7, d: "SUN", n: "Kadhi", e: "🍱" }
  ];

  const css = getComputedStyle(document.documentElement);
  const readVar = (name, fallback) => {
    const raw = (css.getPropertyValue(name) || "").trim();
    if (!raw) return fallback;
    if (/^[\d\s.,]+$/.test(raw)) return `rgb(${raw})`;
    return raw;
  };
  const C = {
    surface: readVar("--surface", "#ffffff"),
    text: readVar("--text", "#161615"),
    accent: readVar("--accent", "#E6A23C"),
    border: readVar("--border", "#ecebe5"),
    muted: readVar("--muted", "#8b8b84")
  };

  let renderer;
  try { renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true }); }
  catch (err) { return; }
  if (!renderer.getContext()) return;

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const W = mount.clientWidth || 320, H = mount.clientHeight || 320;
  renderer.setSize(W, H);
  mount.appendChild(renderer.domElement);
  const canvas = renderer.domElement;
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.touchAction = "pan-y";
  canvas.style.cursor = "grab";

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 100);
  camera.position.set(0, 1.15, 8.6);
  camera.lookAt(0, 0.2, 0);

  const cardTexture = i => {
    const { d, n, e } = DAYS[i];
    const w = 256, h = 322, r = 26;
    const cv = document.createElement("canvas");
    cv.width = w; cv.height = h;
    const ctx = cv.getContext("2d");
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.arcTo(w, 0, w, h, r); ctx.arcTo(w, h, 0, h, r); ctx.arcTo(0, h, 0, 0, r); ctx.arcTo(0, 0, w, 0, r);
    ctx.closePath();
    ctx.fillStyle = C.surface; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = C.border; ctx.stroke();
    ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    ctx.fillStyle = C.accent;
    ctx.font = "800 24px system-ui, sans-serif";
    ctx.fillText(d, w / 2, 56);
    ctx.textBaseline = "middle";
    ctx.font = "150px serif";
    ctx.fillText(e, w / 2, h / 2 + 16);
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = C.text;
    ctx.font = "650 27px system-ui, sans-serif";
    ctx.fillText(n, w / 2, h - 44);
    ctx.fillStyle = C.muted;
    ctx.font = "500 18px system-ui, sans-serif";
    ctx.fillText("₹70 tiffin", w / 2, h - 18);
    const tex = new THREE.CanvasTexture(cv);
    tex.anisotropy = 4;
    return tex;
  };

  const group = new THREE.Group();
  scene.add(group);
  const cards = [];
  const R = 3.05, STEP = (2 * Math.PI) / DAYS.length;
  DAYS.forEach((day, i) => {
    const a = i * STEP;
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1.72, 2.16),
      new THREE.MeshBasicMaterial({ map: cardTexture(i), transparent: true, side: THREE.DoubleSide })
    );
    mesh.position.set(Math.sin(a) * R, 0, Math.cos(a) * R);
    mesh.rotation.y = a;
    mesh.userData.day = day.day;
    group.add(mesh);
    cards.push(mesh);
  });

  const ringMat = new THREE.MeshBasicMaterial({
    color: C.accent, transparent: true, opacity: 0.35, side: THREE.DoubleSide
  });
  const ring = new THREE.Mesh(new THREE.RingGeometry(3.7, 3.82, 72), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = -1.15;
  scene.add(ring);

  const inner = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.92, 48), ringMat);
  inner.rotation.x = -Math.PI / 2;
  inner.position.y = -1.15;
  scene.add(inner);

  const clock = new THREE.Clock();
  let rotationTarget = null;
  let autoRotate = true;
  let dragging = false, down = false, lastX = 0, moved = 0;

  const normalize = v => { v = v % (2 * Math.PI); return v < 0 ? v + 2 * Math.PI : v; };

  const select = day => {
    const i = DAYS.findIndex(x => x.day === day);
    if (i < 0) return;
    autoRotate = false;
    rotationTarget = normalize(-i * STEP);
  };
  window.__rasoi3d = { select, active: true };

  const pick = e => {
    const rect = canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(cards, false);
    if (hits.length) {
      const day = hits[0].object.userData.day;
      select(day);
      document.dispatchEvent(new CustomEvent("rasoi:daypick", { detail: { day } }));
    }
  };

  const snapAfterDrag = () => {
    const gr = normalize(group.rotation.y);
    let best = 0, bestD = Infinity;
    DAYS.forEach((x, i) => {
      const a = normalize(i * STEP + gr);
      const d = Math.min(a, 2 * Math.PI - a);
      if (d < bestD) { bestD = d; best = i; }
    });
    rotationTarget = normalize(-best * STEP);
    document.dispatchEvent(new CustomEvent("rasoi:daypick", { detail: { day: DAYS[best].day } }));
  };

  canvas.addEventListener("pointerdown", e => {
    if (e.pointerType === "touch") return;
    down = true; dragging = true;
    autoRotate = false; rotationTarget = null;
    lastX = e.clientX; moved = 0;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", e => {
    if (!down) return;
    const dx = e.clientX - lastX;
    lastX = e.clientX;
    moved += Math.abs(dx);
    group.rotation.y += dx * 0.004;
  });
  const endPointer = e => {
    if (!down) return;
    down = false; dragging = false;
    if (moved < 6) pick(e); else snapAfterDrag();
    moved = 0;
  };
  canvas.addEventListener("pointerup", endPointer);
  canvas.addEventListener("pointercancel", endPointer);

  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    if (!dragging) {
      if (rotationTarget != null) {
        const d = Math.atan2(Math.sin(rotationTarget - group.rotation.y), Math.cos(rotationTarget - group.rotation.y));
        if (Math.abs(d) < 0.012) { group.rotation.y = rotationTarget; rotationTarget = null; autoRotate = true; }
        else group.rotation.y += d * 0.09;
      } else if (autoRotate) {
        group.rotation.y += Math.min(0.002, dt * 0.09);
      }
    }
    group.position.y = Math.sin(t * 0.55) * 0.04;
    ring.rotation.z += 0.002;
    inner.rotation.z -= 0.0035;
    renderer.render(scene, camera);
  });

  const resize = () => {
    const w = mount.clientWidth || W, h = mount.clientHeight || H;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  };
  if (window.ResizeObserver) new ResizeObserver(resize).observe(mount);
  else window.addEventListener("resize", resize);

  const themeObserver = new MutationObserver(() => {
    const c2 = getComputedStyle(document.documentElement);
    const refresh = (name, fallback) => {
      const raw = (c2.getPropertyValue(name) || "").trim();
      if (!raw) return fallback;
      return /^[\d\s.,]+$/.test(raw) ? `rgb(${raw})` : raw;
    };
    C.surface = refresh("--surface", C.surface);
    C.text = refresh("--text", C.text);
    C.accent = refresh("--accent", C.accent);
    C.border = refresh("--border", C.border);
    C.muted = refresh("--muted", C.muted);
    cards.forEach((mesh, i) => {
      const t = cardTexture(i);
      mesh.material.map = t;
      mesh.material.needsUpdate = true;
    });
  });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  document.body.classList.add("rasoi-3d");
})();