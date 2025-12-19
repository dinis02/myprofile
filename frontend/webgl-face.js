// Three.js realistic head with GLSL background
// Model: Lee Perry-Smith head (CC-BY 3.0) – https://threejs.org/examples/#webgl_loader_gltf
// This file imports Three.js modules from a CDN. Works in modern browsers.

import * as THREE from 'https://unpkg.com/three@0.161.0/build/three.module.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.161.0/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'https://unpkg.com/three@0.161.0/examples/jsm/environments/RoomEnvironment.js';

// DOM setup: insert canvas as the first element to sit behind content
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.domElement.style.position = 'fixed';
renderer.domElement.style.inset = '0';
renderer.domElement.style.zIndex = '0';
renderer.domElement.style.pointerEvents = 'none';
document.body.prepend(renderer.domElement);

// Background scene with a full-screen quad and GLSL shader
const bgScene = new THREE.Scene();
const bgCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

const bgUniforms = {
  uTime: { value: 0 },
  uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
  uBg: { value: new THREE.Color() },
  uFg: { value: new THREE.Color() }
};

// Simple monochrome procedural grain + subtle radial gradient
const bgMaterial = new THREE.ShaderMaterial({
  uniforms: bgUniforms,
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }
  `,
  fragmentShader: /* glsl */`
    precision highp float;
    varying vec2 vUv;
    uniform vec2 uResolution;
    uniform float uTime;
    uniform vec3 uBg;
    uniform vec3 uFg;

    // hash-based noise
    float hash(vec2 p){
      p = vec2(dot(p, vec2(127.1,311.7)), dot(p, vec2(269.5,183.3)));
      return -1.0 + 2.0*fract(sin(p)*43758.5453123);
    }
    float noise(in vec2 p){
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f*f*(3.0-2.0*f);
      float n = mix(mix(hash(i + vec2(0.0,0.0)), hash(i + vec2(1.0,0.0)), u.x),
                    mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0,1.0)), u.x), u.y);
      return 0.5 + 0.5*n;
    }

    void main(){
      vec2 uv = vUv;
      // radial vignette
      float r = distance(uv, vec2(0.5));
      float vignette = smoothstep(0.9, 0.4, r);
      // animated grain
      float g = noise(uv * uResolution.xy * 0.25 + uTime*20.0);
      float grain = mix(0.96, 1.0, g);

      vec3 base = mix(uBg, uFg, 0.02*vignette);
      base *= grain;
      gl_FragColor = vec4(base, 1.0);
    }
  `,
  depthTest: false,
  depthWrite: false
});

const bgGeo = new THREE.PlaneGeometry(2, 2);
const bgMesh = new THREE.Mesh(bgGeo, bgMaterial);
bgScene.add(bgMesh);

// Foreground scene for the head
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0.05, 1.1);

// Lighting / environment
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.5).texture;

const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
scene.add(hemi);
const dir = new THREE.DirectionalLight(0xffffff, 1.0);
dir.position.set(1, 1, 1);
scene.add(dir);

// Load realistic head model
const loader = new GLTFLoader();
const HEAD_URL = 'https://threejs.org/examples/models/gltf/LeePerrySmith/LeePerrySmith.glb';
let head = null;
loader.load(HEAD_URL, (gltf) => {
  head = gltf.scene;
  // center and scale
  head.rotation.y = Math.PI; // face forward
  head.position.set(0, -0.1, 0);
  head.scale.setScalar(1.15);

  // material tweaks for realism
  head.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = false;
      o.receiveShadow = false;
      if (o.material && !o.material.isMeshPhysicalMaterial) {
        o.material = new THREE.MeshPhysicalMaterial({
          map: o.material.map || null,
          normalMap: o.material.normalMap || null,
          roughnessMap: o.material.roughnessMap || null,
          metalness: 0.0,
          roughness: 0.6,
          transmission: 0.0,
          sheen: 0.2,
          sheenRoughness: 0.6,
        });
      }
    }
  });
  scene.add(head);
}, undefined, (err) => {
  console.warn('Failed to load head model:', err);
  addFallbackHead();
});

// Fallback if model takes too long (e.g., network blocked)
setTimeout(() => { if (!head) addFallbackHead(); }, 4000);

function addFallbackHead(){
  if (head) return;
  const geo = new THREE.SphereGeometry(0.42, 64, 64);
  const mat = new THREE.MeshPhysicalMaterial({ color: 0x999999, roughness: 0.5, metalness: 0.0, clearcoat: 0.2, clearcoatRoughness: 0.8 });
  head = new THREE.Mesh(geo, mat);
  head.position.set(0, -0.05, 0);
  scene.add(head);
}

// Colors from current theme (CSS variables)
function cssVar(name){
  return getComputedStyle(document.body).getPropertyValue(name).trim();
}
function setShaderColors(){
  const bg = new THREE.Color(cssVar('--bg') || '#000');
  const fg = new THREE.Color(cssVar('--text') || '#fff');
  bgUniforms.uBg.value.copy(bg);
  bgUniforms.uFg.value.copy(fg);
}
setShaderColors();

// Listen to theme changes dispatched by script.js
window.addEventListener('theme:changed', () => setShaderColors());

// Resize
function onResize(){
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  bgUniforms.uResolution.value.set(w, h);
}
window.addEventListener('resize', onResize);

// Animate
let last = performance.now();
function tick(now){
  const dt = (now - last) / 1000; last = now;
  bgUniforms.uTime.value += dt;
  if (head) {
    head.rotation.y += dt * 0.15; // slow turn
  }
  // Render background then foreground
  renderer.autoClear = true;
  renderer.render(bgScene, bgCamera);
  renderer.autoClear = false;
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
