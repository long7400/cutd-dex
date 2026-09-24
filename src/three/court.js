import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

const HALF = 10.56;
const ROW_Z = [-3.6, -1.7, 0.2, 2.6];

export async function mountCourt(canvas, { court, monster, team, creeps, view }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#141a28');
  scene.fog = new THREE.Fog('#141a28', 38, 95);
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 400);
  camera.position.set(...view.pos);
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(...view.target);
  Object.assign(controls, { enableDamping: true, enableZoom: false, enablePan: false, minPolarAngle: 0.9, maxPolarAngle: 1.45, rotateSpeed: 0.6 });
  canvas.style.touchAction = 'pan-y';

  scene.add(new THREE.AmbientLight('#dfe6ff', 1.15));
  const sun = new THREE.DirectionalLight('#ffe9c7', 2.1);
  sun.position.set(-10, 18, 12);
  scene.add(sun);
  const rim = new THREE.DirectionalLight('#9fb6ff', 1.1);
  rim.position.set(12, 8, -16);
  scene.add(rim);

  const loader = new GLTFLoader();
  const load = url => new Promise((res, rej) => loader.load(url, res, undefined, rej));
  scene.add((await load(court)).scene);

  const cache = new Map();
  const proto = name => { if (!cache.has(name)) cache.set(name, load(monster(name))); return cache.get(name); };
  const mixers = [];
  const spawn = async (name, x, z, scale, face) => {
    const g = await proto(name);
    const obj = cloneSkinned(g.scene);
    obj.scale.setScalar(scale);
    obj.position.set(x, 0.167, z);
    obj.rotation.y = face;
    scene.add(obj);
    const mixer = new THREE.AnimationMixer(obj);
    mixers.push(mixer);
    const clips = Object.fromEntries(g.animations.map(a => [a.name, a]));
    let current = null;
    const play = (clip, once = false) => {
      if (!clips[clip]) return 0;
      const a = mixer.clipAction(clips[clip]);
      if (current === a && !once) return clips[clip].duration;
      a.reset();
      a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity);
      a.clampWhenFinished = once;
      current?.fadeOut(0.18);
      a.fadeIn(0.18).play();
      current = a;
      return clips[clip].duration;
    };
    play('idle');
    return { obj, play, clips };
  };

  const settled = await Promise.allSettled([
    ...team.map(async p => ({ kind: 'pet', ...await spawn(p.model, p.slot * 1.7, ROW_Z[p.row], 0.7, 0), range: p.range, cd: 1 + Math.random() * 1.5, busy: 0 })),
    ...creeps.map(async (c, i) => {
      const m = await spawn(c, (i % 3 - 1) * 1.5, -HALF - 1 - i * 2.2, 0.62, 0);
      m.play('move');
      return { kind: 'creep', ...m, hp: 4, speed: 1.6 + (i % 3) * 0.2, dead: 0, busy: 0, stopZ: -5.3 - (i % 4) * 0.45, hit: Math.random() * 2 };
    }),
  ]);
  const actors = settled.filter(r => r.status === 'fulfilled').map(r => r.value);
  const pets = actors.filter(a => a.kind === 'pet'), walkers = actors.filter(a => a.kind === 'creep');

  const petals = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.11, 0.075), new THREE.MeshBasicMaterial({ color: '#f4b8cf', side: THREE.DoubleSide, transparent: true, opacity: 0.9 }), 360);
  const pd = Array.from({ length: 360 }, () => ({ x: (Math.random() - 0.5) * 40, y: Math.random() * 12, z: (Math.random() - 0.5) * 36, s: 0.4 + Math.random() * 0.8, r: Math.random() * 6, w: 0.5 + Math.random() }));
  scene.add(petals);
  const dummy = new THREE.Object3D();

  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w / h < 0.8 ? 62 : w / h < 1.2 ? 46 : 34;
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
    const dt = Math.min(0.05, clock.getDelta()), t = clock.elapsedTime;
    if (!visible || document.hidden) return;
    controls.update();
    for (const m of mixers) m.update(dt);
    for (const p of pets) {
      if (p.busy > 0) { p.busy -= dt; if (p.busy <= 0) p.play('idle'); continue; }
      p.obj.rotation.y += (0 - p.obj.rotation.y) * Math.min(1, dt * 3);
      p.cd -= dt;
      if (p.cd > 0) continue;
      const target = walkers.find(c => !c.dead && c.obj.visible && p.obj.position.distanceTo(c.obj.position) < p.range);
      if (!target) continue;
      p.cd = 1.4 + Math.random();
      p.obj.rotation.y = Math.atan2(target.obj.position.x - p.obj.position.x, target.obj.position.z - p.obj.position.z);
      p.busy = p.play(Math.random() < 0.25 && p.clips.skill1 ? 'skill1' : 'attack', true);
      target.hp -= 1;
      if (target.hp <= 0) { target.dead = 1.5; target.play('dead', true); } else target.busy = target.play('hurt', true);
    }
    for (const c of walkers) {
      if (c.dead) {
        c.dead -= dt;
        if (c.dead < 0.3) c.obj.visible = false;
        if (c.dead <= 0) { c.dead = 0; c.hp = 4; c.obj.position.z = -HALF - 3; c.obj.visible = true; c.play('move'); }
        continue;
      }
      if (c.busy > 0) { c.busy -= dt; continue; }
      if (c.obj.position.z < c.stopZ) { c.obj.position.z += c.speed * dt; c.play('move'); }
      else { c.hit -= dt; if (c.hit <= 0) { c.hit = 1.3 + Math.random(); c.busy = c.play('attack', true); } else c.play('idle'); }
    }
    pd.forEach((p, i) => {
      p.y -= dt * 0.55 * p.w; p.x += Math.sin(t * p.w + p.r) * dt * 0.4; p.r += dt * p.w;
      if (p.y < -1) { p.y = 11; p.x = (Math.random() - 0.5) * 40; p.z = (Math.random() - 0.5) * 36; }
      dummy.position.set(p.x, p.y, p.z); dummy.rotation.set(p.r, p.r * 0.7, p.r * 0.3); dummy.scale.setScalar(p.s); dummy.updateMatrix();
      petals.setMatrixAt(i, dummy.matrix);
    });
    petals.instanceMatrix.needsUpdate = true;
    renderer.render(scene, camera);
  };
  tick();

  return () => {
    alive = false;
    ro.disconnect(); io.disconnect(); controls.dispose();
    scene.traverse(o => { o.geometry?.dispose?.(); for (const m of [o.material].flat()) { if (!m) continue; for (const v of Object.values(m)) v?.isTexture && v.dispose(); m.dispose?.(); } });
    renderer.dispose();
  };
}
