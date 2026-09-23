import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

export function mountPedestal(canvas, { monster }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
  camera.position.set(0, 2.3, 9.5);
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 1.3, 0);
  Object.assign(controls, { enableZoom: false, enablePan: false, enableDamping: true, minPolarAngle: 1.2, maxPolarAngle: 1.45, rotateSpeed: 0.7 });

  scene.add(new THREE.HemisphereLight('#f4f1ff', '#2a2233', 1.4));
  const key = new THREE.DirectionalLight('#fff1d8', 2.6);
  key.position.set(3, 6, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight('#ffffff', 2.4);
  rim.position.set(-4, 3, -5);
  scene.add(rim);

  const mat = c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.75 });
  const top = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.5, 0.22, 72), mat('#3c5680'));
  top.position.y = -0.11;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.47, 0.03, 8, 120), new THREE.MeshStandardMaterial({ color: '#ffde8f', roughness: 0.3, metalness: 0.6 }));
  ring.rotation.x = Math.PI / 2;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.8, 0.3, 72), mat('#1c2c45'));
  base.position.y = -0.37;
  scene.add(top, ring, base);

  const fade = (() => {
    const c = document.createElement('canvas'); c.width = 4; c.height = 128;
    const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 128, 0, 0);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 4, 128);
    return new THREE.CanvasTexture(c);
  })();
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.3, 4.2, 48, 1, true), new THREE.MeshBasicMaterial({ color: '#ffffff', alphaMap: fade, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
  beam.position.y = 2.1;
  const wave = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 64), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
  wave.rotation.x = -Math.PI / 2; wave.position.y = 0.02;
  const N = 90;
  const sparkGeo = new THREE.BufferGeometry();
  const sp = new Float32Array(N * 3), sv = Array.from({ length: N }, () => ({ a: Math.random() * 6.28, r: 0.3 + Math.random() * 1.1, v: 0.8 + Math.random() * 1.8 }));
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const sparks = new THREE.Points(sparkGeo, new THREE.PointsMaterial({ color: '#fff6d8', size: 0.07, transparent: true, opacity: 0, depthWrite: false }));
  scene.add(beam, wave, sparks);
  const holder = new THREE.Group();
  scene.add(holder);

  const loader = new GLTFLoader();
  const cache = new Map();
  const load = name => {
    if (!cache.has(name)) cache.set(name, new Promise((res, rej) => loader.load(monster(name), res, undefined, rej)).catch(e => { cache.delete(name); throw e; }));
    return cache.get(name);
  };
  const white = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  let mixer = null, token = 0, fx = null, burst = -1;

  const place = g => {
    const obj = cloneSkinned(g.scene);
    obj.traverse(o => { if (o.isMesh) o.frustumCulled = false; });
    obj.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(obj, true);
    const size = box.getSize(new THREE.Vector3());
    const s = Math.min(2.5 / Math.max(0.01, size.y), 2.6 / Math.max(0.01, size.x, size.z));
    obj.scale.setScalar(s);
    obj.position.set(-(box.min.x + size.x / 2) * s, -box.min.y * s, -(box.min.z + size.z / 2) * s);
    const pivot = new THREE.Group();
    pivot.add(obj);
    return pivot;
  };
  const whiten = (obj, on) => obj.traverse(o => {
    if (!o.isMesh) return;
    if (on) { o.userData.mat ??= o.material; o.material = white; } else if (o.userData.mat) o.material = o.userData.mat;
  });
  const swapIn = (next, nextMixer) => { holder.clear(); holder.add(next); mixer = nextMixer; };
  const reset = () => { fx = null; burst = -1; beam.material.opacity = 0; wave.material.opacity = 0; sparks.material.opacity = 0; };

  const show = async (name, { evolve = false, color = '#ffffff' } = {}) => {
    const my = ++token;
    reset();
    rim.color.set(color);
    beam.material.color.set(color);
    wave.material.color.set(color);
    let g;
    try { g = await load(name); } catch { return; }
    if (my !== token) return;
    const next = place(g);
    const nextMixer = new THREE.AnimationMixer(next);
    const clips = Object.fromEntries(g.animations.map(a => [a.name, a]));
    const idle = clips.idle && nextMixer.clipAction(clips.idle);
    const hello = clips.skill1 ?? clips.attack;
    const start = () => {
      if (!hello) { idle?.play(); return; }
      const a = nextMixer.clipAction(hello);
      a.setLoop(THREE.LoopOnce, 1);
      a.clampWhenFinished = true;
      a.play();
      nextMixer.addEventListener('finished', () => { a.fadeOut(0.3); idle?.reset().fadeIn(0.3).play(); });
    };
    const old = holder.children[0];
    if (!evolve || !old) { swapIn(next, nextMixer); start(); return; }
    whiten(old, true);
    fx = { t: 0, old, next, nextMixer, start, swapped: false, token: my };
  };

  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();
  let visible = true, alive = true;
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; });
  io.observe(canvas);
  const clock = new THREE.Clock();
  const tick = () => {
    if (!alive) return;
    requestAnimationFrame(tick);
    const dt = Math.min(0.05, clock.getDelta());
    if (!visible || document.hidden) return;
    if (fx && fx.token !== token) fx = null;
    if (fx) {
      fx.t += dt;
      if (!fx.swapped) {
        const k = Math.min(1, fx.t / 0.9);
        fx.old.scale.setScalar((1 + Math.sin(k * Math.PI * 6) * 0.06 * k) * (1 - 0.15 * k));
        beam.material.opacity = 0.16 * k;
        if (k >= 1) {
          whiten(fx.next, true);
          fx.next.scale.setScalar(0.6);
          swapIn(fx.next, fx.nextMixer);
          fx.swapped = true; fx.t = 0; burst = 0;
        }
      } else {
        const k = Math.min(1, fx.t / 0.6);
        fx.next.scale.setScalar(0.6 + 0.4 * (1 - Math.pow(1 - k, 3)) + Math.sin(k * Math.PI) * 0.08);
        beam.material.opacity = 0.16 * (1 - k);
        if (k > 0.35) whiten(fx.next, false);
        if (k >= 1) { fx.next.scale.setScalar(1); fx.start(); fx = null; }
      }
    }
    if (burst >= 0) {
      burst += dt;
      const k = Math.min(1, burst / 1.4);
      wave.scale.setScalar(1 + k * 1.6); wave.material.opacity = 0.8 * (1 - k);
      sparks.material.opacity = 1 - k;
      sv.forEach((p, i) => { const h = burst * p.v; sp[i * 3] = Math.cos(p.a + h * 0.6) * p.r; sp[i * 3 + 1] = h * 1.4; sp[i * 3 + 2] = Math.sin(p.a + h * 0.6) * p.r; });
      sparkGeo.attributes.position.needsUpdate = true;
      if (k >= 1) burst = -1;
    }
    mixer?.update(dt);
    ring.rotation.z += dt * 0.15;
    controls.update();
    renderer.render(scene, camera);
  };
  tick();
  return {
    show,
    destroy() {
      alive = false; ro.disconnect(); io.disconnect(); controls.dispose();
      scene.traverse(o => { o.geometry?.dispose?.(); for (const m of [o.material].flat()) m?.dispose?.(); });
      renderer.dispose();
    },
  };
}
