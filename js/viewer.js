import * as THREE from 'three';
import { OrbitControls } from '../vendor/OrbitControls.js';

/**
 * Minimal Y-up viewer: build plate, three-point-ish lighting, orbit camera.
 * Deliberately plain so the geometry (and the print orientation) is what you judge.
 */
export function createViewer(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 1, 4000);
  camera.position.set(150, 130, 210);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.09;
  controls.minDistance = 40;
  controls.maxDistance = 900;
  controls.target.set(0, 20, 0);
  controls.maxPolarAngle = Math.PI * 0.52;

  scene.add(new THREE.HemisphereLight(0xdff0ff, 0x1a1e24, 1.05));

  const key = new THREE.DirectionalLight(0xffffff, 2.0);
  key.position.set(-120, 220, 160);
  scene.add(key);

  const fill = new THREE.DirectionalLight(0x9fc6ff, 0.7);
  fill.position.set(180, 90, -140);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xffe9c9, 0.55);
  rim.position.set(60, 40, -220);
  scene.add(rim);

  // Build plate, sized for an A1 mini.
  const bed = new THREE.Mesh(
    new THREE.PlaneGeometry(180, 180),
    new THREE.MeshStandardMaterial({
      color: 0x22262c,
      roughness: 0.95,
      metalness: 0.0,
      transparent: true,
      opacity: 0.9,
    }),
  );
  bed.rotation.x = -Math.PI / 2;
  bed.position.y = -0.15;
  scene.add(bed);

  const grid = new THREE.GridHelper(180, 18, 0x3a4048, 0x2c3138);
  grid.position.y = -0.05;
  scene.add(grid);

  const plastic = new THREE.MeshStandardMaterial({
    color: 0xf2f2ee,
    roughness: 0.72,
    metalness: 0.0,
  });
  const ink = new THREE.MeshStandardMaterial({
    color: 0x1b1b20,
    roughness: 0.45,
    metalness: 0.0,
  });

  const root = new THREE.Group();
  scene.add(root);

  let dirty = true;
  const invalidate = () => {
    dirty = true;
  };

  function resize() {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    invalidate();
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  let running = true;
  function tick() {
    if (!running) return;
    requestAnimationFrame(tick);
    const moved = controls.update();
    if (dirty || moved) {
      renderer.render(scene, camera);
      dirty = false;
    }
  }
  tick();

  function frame(margin = 1.55) {
    const box = new THREE.Box3().setFromObject(root);
    if (box.isEmpty()) return;
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const radius = Math.max(size.x, size.y, size.z) * 0.5;
    const dist = (radius * margin) / Math.tan((camera.fov * Math.PI) / 360);
    const dir = new THREE.Vector3(0.62, 0.55, 0.78).normalize();
    camera.position.copy(center).addScaledVector(dir, dist * 1.35);
    controls.target.copy(center);
    controls.update();
    invalidate();
  }

  function clear() {
    for (const child of [...root.children]) {
      root.remove(child);
      child.traverse((o) => {
        if (o.isMesh && o.geometry) o.geometry.dispose();
      });
    }
  }

  function add(obj) {
    obj.traverse((o) => {
      if (o.isMesh) {
        o.material = o.userData.ink ? ink : plastic;
        o.castShadow = false;
        o.receiveShadow = false;
      }
    });
    root.add(obj);
    invalidate();
  }

  return { scene, camera, renderer, controls, add, clear, frame, invalidate };
}
