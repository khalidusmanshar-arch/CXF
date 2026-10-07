import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  PROTAGONIST_STATES,
  URBAN_WALL_BG,
  FlamePreset,
  detectPortraitEyeUVs,
} from '../data/protagonistStates';
import {
  HYPER_REAL_VERTEX_SHADER,
  HYPER_REAL_FRAGMENT_SHADER,
} from '../shaders/hyperRealPaperShaders';
import { soundEngine } from '../utils/soundEngine';

export interface SceneTelemetry {
  eyeIgnition: number;
  tearProgress: number;
  mouseSpeed: number;
  scratchCoverage: number;
  leftEyeUV: [number, number];
  rightEyeUV: [number, number];
}

interface HyperRealScene3DProps {
  currentStateIdx: number;
  nextStateIdx: number;
  tearMode: number;
  flamePreset: FlamePreset;
  depthStrength: number;
  paperCurl: number;
  tearJaggedness: number;
  alwaysBurnEyes: boolean;
  mouseRipEnabled: boolean;
  calibrateStep: 'off' | 'left' | 'right';
  triggerTearCounter: number;
  clearScratchCounter: number;
  onTransitionComplete: (newIdx: number) => void;
  onCalibrateComplete: (side: 'left' | 'right', uv: [number, number]) => void;
  onTelemetryUpdate: (data: SceneTelemetry) => void;
}

interface PaperScrap {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  rotVelocity: THREE.Vector3;
  life: number;
  maxLife: number;
}

export const HyperRealScene3D: React.FC<HyperRealScene3DProps> = ({
  currentStateIdx,
  nextStateIdx,
  tearMode,
  flamePreset,
  depthStrength,
  paperCurl,
  tearJaggedness,
  alwaysBurnEyes,
  mouseRipEnabled,
  calibrateStep,
  triggerTearCounter,
  clearScratchCounter,
  onTransitionComplete,
  onCalibrateComplete,
  onTelemetryUpdate,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [webglError, setWebglError] = useState(false);

  // Store mutable latest props in a ref so the 60fps requestAnimationFrame loop never stutters
  const propsRef = useRef({
    currentStateIdx,
    nextStateIdx,
    tearMode,
    flamePreset,
    depthStrength,
    paperCurl,
    tearJaggedness,
    alwaysBurnEyes,
    mouseRipEnabled,
    calibrateStep,
    onTransitionComplete,
    onCalibrateComplete,
    onTelemetryUpdate,
  });

  useEffect(() => {
    propsRef.current = {
      currentStateIdx,
      nextStateIdx,
      tearMode,
      flamePreset,
      depthStrength,
      paperCurl,
      tearJaggedness,
      alwaysBurnEyes,
      mouseRipEnabled,
      calibrateStep,
      onTransitionComplete,
      onCalibrateComplete,
      onTelemetryUpdate,
    };
  }, [
    currentStateIdx,
    nextStateIdx,
    tearMode,
    flamePreset,
    depthStrength,
    paperCurl,
    tearJaggedness,
    alwaysBurnEyes,
    mouseRipEnabled,
    calibrateStep,
    onTransitionComplete,
    onCalibrateComplete,
    onTelemetryUpdate,
  ]);

  // Ref to trigger transition or scratch reset from parent controls
  const actionRef = useRef<{
    startRemoteTear: () => void;
    clearScratch: () => void;
    syncTextures: (currIdx: number, nxtIdx: number) => void;
  } | null>(null);

  useEffect(() => {
    if (triggerTearCounter > 0 && actionRef.current) {
      actionRef.current.startRemoteTear();
    }
  }, [triggerTearCounter]);

  useEffect(() => {
    if (clearScratchCounter > 0 && actionRef.current) {
      actionRef.current.clearScratch();
    }
  }, [clearScratchCounter]);

  useEffect(() => {
    if (actionRef.current) {
      actionRef.current.syncTextures(currentStateIdx, nextStateIdx);
    }
  }, [currentStateIdx, nextStateIdx]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: 'high-performance',
        alpha: false,
      });
    } catch {
      setWebglError(true);
      return;
    }

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x09090b, 1);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Handle WebGL Context Lost / Restored
    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setWebglError(true);
    };
    const handleContextRestored = () => {
      setWebglError(false);
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x09090b, 0.085);

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(0, 0, 6.7);

    // Offscreen Scratch Canvas for Interactive Mouse Paper-Tear ("Paper Fatna")
    const scratchCanvas = document.createElement('canvas');
    scratchCanvas.width = 256;
    scratchCanvas.height = 256;
    const scratchCtx = scratchCanvas.getContext('2d')!;
    scratchCtx.fillStyle = '#000000';
    scratchCtx.fillRect(0, 0, 256, 256);

    const scratchTexture = new THREE.CanvasTexture(scratchCanvas);
    scratchTexture.minFilter = THREE.LinearFilter;
    scratchTexture.magFilter = THREE.LinearFilter;

    // Create fallback procedural portrait texture so canvas is never empty while loading
    const makeFallbackTexture = (tintHex: string) => {
      const c = document.createElement('canvas');
      c.width = 512;
      c.height = 680;
      const ctx = c.getContext('2d')!;
      const grad = ctx.createRadialGradient(256, 300, 30, 256, 340, 340);
      grad.addColorStop(0, tintHex);
      grad.addColorStop(1, '#09090b');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 512, 680);
      const tex = new THREE.CanvasTexture(c);
      return tex;
    };

    const loadedTextures: THREE.Texture[] = [
      makeFallbackTexture('#27272a'),
      makeFallbackTexture('#451a03'),
      makeFallbackTexture('#1e293b'),
    ];

    const detectedEyes: Array<{ leftEye: [number, number]; rightEye: [number, number] }> =
      PROTAGONIST_STATES.map((s) => ({
        leftEye: [...s.defaultLeftEyeUV],
        rightEye: [...s.defaultRightEyeUV],
      }));

    const textureLoader = new THREE.TextureLoader();
    textureLoader.setCrossOrigin('anonymous');

    // Load all 3 Hyper-Real Boy Portrait States + Auto-Detect Eye Coordinates
    PROTAGONIST_STATES.forEach((state, idx) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const tex = new THREE.Texture(img);
        tex.needsUpdate = true;
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        loadedTextures[idx] = tex;

        // Run automatic pupil/eye-line contrast scanner on the portrait
        const autoEyes = detectPortraitEyeUVs(img);
        detectedEyes[idx] = autoEyes;

        // Update uniforms if this state is currently active
        if (idx === propsRef.current.currentStateIdx) {
          portraitMaterial.uniforms.uTexCurrent.value = tex;
          portraitMaterial.uniforms.uLeftEye.value.set(autoEyes.leftEye[0], autoEyes.leftEye[1]);
          portraitMaterial.uniforms.uRightEye.value.set(autoEyes.rightEye[0], autoEyes.rightEye[1]);
        }
        if (idx === propsRef.current.nextStateIdx) {
          portraitMaterial.uniforms.uTexNext.value = tex;
        }
      };
      img.src = state.imageUrl;
    });

    // Background 3D Urban Wall Plane for deep spatial parallax
    const bgGeo = new THREE.PlaneGeometry(18, 11, 1, 1);
    const bgMat = new THREE.MeshBasicMaterial({
      color: 0x222226,
      transparent: true,
      opacity: 0.55,
    });
    const bgMesh = new THREE.Mesh(bgGeo, bgMat);
    bgMesh.position.set(0, 0, -2.4);
    scene.add(bgMesh);

    textureLoader.load(URBAN_WALL_BG, (bgTex) => {
      bgTex.colorSpace = THREE.SRGBColorSpace;
      bgMat.map = bgTex;
      bgMat.needsUpdate = true;
    });

    // Root 3D Group for the Hyper-Real Protagonist Bust + Attached Eye Fire Emitters
    const characterGroup = new THREE.Group();
    scene.add(characterGroup);

    // Subtle Torn-Paper Backing Frame behind the main portrait sheet
    const backingGeo = new THREE.PlaneGeometry(4.18, 5.48, 32, 32);
    const backingMat = new THREE.MeshBasicMaterial({
      color: 0x18181b,
      side: THREE.DoubleSide,
    });
    const backingMesh = new THREE.Mesh(backingGeo, backingMat);
    backingMesh.position.set(0, 0, -0.08);
    characterGroup.add(backingMesh);

    // Main High-Subdivision 3D Sculptural Portrait Mesh (220 x 280 vertices for smooth 3D relief & paper curl)
    const portraitWidth = 4.1;
    const portraitHeight = 5.4;
    const portraitGeo = new THREE.PlaneGeometry(portraitWidth, portraitHeight, 210, 270);

    const portraitMaterial = new THREE.ShaderMaterial({
      vertexShader: HYPER_REAL_VERTEX_SHADER,
      fragmentShader: HYPER_REAL_FRAGMENT_SHADER,
      uniforms: {
        uTexCurrent: { value: loadedTextures[propsRef.current.currentStateIdx] },
        uTexNext: { value: loadedTextures[propsRef.current.nextStateIdx] },
        uScratchMap: { value: scratchTexture },
        uTime: { value: 0 },
        uDepthStrength: { value: propsRef.current.depthStrength },
        uEyeIgnition: { value: 0.35 },
        uTearProgress: { value: 0.0 },
        uTearMode: { value: propsRef.current.tearMode },
        uTearJaggedness: { value: propsRef.current.tearJaggedness },
        uPaperCurl: { value: propsRef.current.paperCurl },
        uMouseUV: { value: new THREE.Vector2(0.5, 0.5) },
        uMouseVelocity: { value: 0.0 },
        uLeftEye: { value: new THREE.Vector2(0.395, 0.555) },
        uRightEye: { value: new THREE.Vector2(0.605, 0.555) },
        uFlameColorPrimary: {
          value: new THREE.Vector3(...propsRef.current.flamePreset.primaryRGB),
        },
        uFlameColorSecondary: {
          value: new THREE.Vector3(...propsRef.current.flamePreset.secondaryRGB),
        },
      },
      side: THREE.DoubleSide,
    });

    const portraitMesh = new THREE.Mesh(portraitGeo, portraitMaterial);
    characterGroup.add(portraitMesh);

    // ============================================================================
    // 3D VOLUMETRIC OCULAR FIRE & SPARK PARTICLE SYSTEM ("Aankhen Bhi Jal Jaaye")
    // Spawns real 3D glowing fire/ember particles from both eyes in 3D space!
    // ============================================================================
    const fireParticleCount = 420;
    const firePositions = new Float32Array(fireParticleCount * 3);
    const fireVelocities = new Float32Array(fireParticleCount * 3);
    const fireAges = new Float32Array(fireParticleCount);
    const fireMaxAges = new Float32Array(fireParticleCount);
    const fireSizes = new Float32Array(fireParticleCount);
    const fireEyeSide = new Uint8Array(fireParticleCount); // 0 = left eye, 1 = right eye

    const resetFireParticle = (i: number, leftPos: THREE.Vector3, rightPos: THREE.Vector3, ignition: number) => {
      const isRight = i % 2 === 1;
      fireEyeSide[i] = isRight ? 1 : 0;
      const origin = isRight ? rightPos : leftPos;

      // Random offset inside the burning eye socket
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * 0.085 * (0.5 + 0.6 * ignition);
      firePositions[i * 3] = origin.x + Math.cos(angle) * radius;
      firePositions[i * 3 + 1] = origin.y + Math.sin(angle) * radius * 0.75;
      firePositions[i * 3 + 2] = origin.z + 0.12 + Math.random() * 0.08;

      // Rising + forward-projecting fiery velocity
      const speedScale = 0.4 + ignition * 1.15;
      fireVelocities[i * 3] = (Math.random() - 0.5) * 0.38 * speedScale;
      fireVelocities[i * 3 + 1] = (0.55 + Math.random() * 1.25) * speedScale;
      fireVelocities[i * 3 + 2] = (0.35 + Math.random() * 0.85) * speedScale;

      fireAges[i] = 0;
      fireMaxAges[i] = 0.28 + Math.random() * 0.65;
      fireSizes[i] = (6.0 + Math.random() * 16.0) * (0.4 + 0.85 * ignition);
    };

    const dummyLeft = new THREE.Vector3(-0.42, 0.3, 0.3);
    const dummyRight = new THREE.Vector3(0.42, 0.3, 0.3);
    for (let i = 0; i < fireParticleCount; i++) {
      resetFireParticle(i, dummyLeft, dummyRight, 0.5);
      fireAges[i] = Math.random() * fireMaxAges[i];
    }

    const fireGeo = new THREE.BufferGeometry();
    fireGeo.setAttribute('position', new THREE.BufferAttribute(firePositions, 3));
    fireGeo.setAttribute('aAge', new THREE.BufferAttribute(fireAges, 1));
    fireGeo.setAttribute('aMaxAge', new THREE.BufferAttribute(fireMaxAges, 1));
    fireGeo.setAttribute('aSize', new THREE.BufferAttribute(fireSizes, 1));

    const fireParticleMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uIgnition: { value: 0.35 },
        uColorPrimary: { value: new THREE.Vector3(...propsRef.current.flamePreset.primaryRGB) },
        uColorSecondary: { value: new THREE.Vector3(...propsRef.current.flamePreset.secondaryRGB) },
      },
      vertexShader: /* glsl */ `
        attribute float aAge;
        attribute float aMaxAge;
        attribute float aSize;
        uniform float uIgnition;
        varying float vLifeRatio;

        void main() {
          vLifeRatio = clamp(aAge / max(aMaxAge, 0.001), 0.0, 1.0);
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          float scale = sin(vLifeRatio * 3.14159);
          gl_PointSize = aSize * scale * clamp(uIgnition * 1.35, 0.0, 1.4) * (5.5 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: /* glsl */ `
        precision mediump float;
        uniform float uIgnition;
        uniform vec3 uColorPrimary;
        uniform vec3 uColorSecondary;
        varying float vLifeRatio;

        void main() {
          if (uIgnition <= 0.02) discard;
          vec2 pt = gl_PointCoord - vec2(0.5);
          float r = length(pt);
          if (r > 0.5) discard;

          float radialGlow = pow(1.0 - r * 2.0, 1.8);
          vec3 whiteHot = vec3(1.0, 0.98, 0.85);
          vec3 col = mix(whiteHot, uColorSecondary, smoothstep(0.0, 0.35, vLifeRatio));
          col = mix(col, uColorPrimary, smoothstep(0.35, 0.85, vLifeRatio));

          float alpha = radialGlow * (1.0 - vLifeRatio * 0.85) * min(1.0, uIgnition * 1.3);
          gl_FragColor = vec4(col, alpha);
        }
      `,
    });

    const firePoints = new THREE.Points(fireGeo, fireParticleMat);
    characterGroup.add(firePoints);

    // ============================================================================
    // 3D FLYING PAPER SCRAPS SYSTEM ("Ekadam Paper Fatane Jaise")
    // Bursts real 3D jagged white-edged paper shreds along the tear line!
    // ============================================================================
    const scrapsGroup = new THREE.Group();
    scene.add(scrapsGroup);
    const activeScraps: PaperScrap[] = [];

    const createPaperScrapGeometry = () => {
      const geo = new THREE.BufferGeometry();
      const s = 0.09 + Math.random() * 0.14;
      const vertices = new Float32Array([
        0, s, 0,
        -s * (0.6 + Math.random() * 0.5), -s * 0.5, 0.02,
        s * (0.6 + Math.random() * 0.5), -s * (0.3 + Math.random() * 0.5), -0.02,
        0, -s * 1.1, 0.03,
      ]);
      const indices = [0, 1, 2, 1, 3, 2];
      geo.setIndex(indices);
      geo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
      geo.computeVertexNormals();
      return geo;
    };

    const scrapMatWhite = new THREE.MeshBasicMaterial({
      color: 0xf4efe6,
      side: THREE.DoubleSide,
    });
    const scrapMatDark = new THREE.MeshBasicMaterial({
      color: 0x27272a,
      side: THREE.DoubleSide,
    });

    const spawnPaperScrapsAtUV = (uvX: number, uvY: number, count: number = 5) => {
      const worldX = (uvX - 0.5) * portraitWidth;
      const worldY = (uvY - 0.5) * portraitHeight;

      for (let i = 0; i < count; i++) {
        if (activeScraps.length > 75) {
          const oldest = activeScraps.shift();
          if (oldest) {
            scrapsGroup.remove(oldest.mesh);
            oldest.mesh.geometry.dispose();
          }
        }

        const geo = createPaperScrapGeometry();
        const mat = Math.random() > 0.3 ? scrapMatWhite : scrapMatDark;
        const mesh = new THREE.Mesh(geo, mat);

        mesh.position.set(
          worldX + (Math.random() - 0.5) * 0.35,
          worldY + (Math.random() - 0.5) * 0.35,
          0.35 + Math.random() * 0.25
        );
        mesh.rotation.set(
          Math.random() * Math.PI,
          Math.random() * Math.PI,
          Math.random() * Math.PI
        );

        scrapsGroup.add(mesh);
        activeScraps.push({
          mesh,
          velocity: new THREE.Vector3(
            (Math.random() - 0.5) * 2.4,
            0.8 + Math.random() * 1.8,
            1.2 + Math.random() * 2.2
          ),
          rotVelocity: new THREE.Vector3(
            (Math.random() - 0.5) * 12,
            (Math.random() - 0.5) * 12,
            (Math.random() - 0.5) * 12
          ),
          life: 0,
          maxLife: 0.9 + Math.random() * 0.7,
        });
      }
    };

    // ============================================================================
    // INTERACTIVE MOUSE TRACKING, EYE IGNITION & LIVE PAPER SCRATCHING
    // ============================================================================
    const targetMouseUV = new THREE.Vector2(0.5, 0.5);
    const currentMouseUV = new THREE.Vector2(0.5, 0.5);
    const prevMouseUV = new THREE.Vector2(0.5, 0.5);
    let mouseSpeedAccum = 0.0;
    let currentEyeIgnition = 0.45;
    let lastMoveTimestamp = performance.now();
    let isPointerDown = false;
    let scratchCoverageRatio = 0.0;
    let lastScratchAudioTime = 0;

    // Remote Paper Tear Animation State
    let isRemoteTearing = false;
    let remoteTearProgress = 0.0;
    let lastScrapMilestone = 0.0;

    const paintScratchAtUV = (uvX: number, uvY: number, radiusPx: number = 24) => {
      const cx = uvX * 256;
      const cy = (1.0 - uvY) * 256;

      const grad = scratchCtx.createRadialGradient(cx, cy, radiusPx * 0.2, cx, cy, radiusPx);
      grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
      grad.addColorStop(0.65, 'rgba(255, 255, 255, 0.75)');
      grad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');

      scratchCtx.fillStyle = grad;
      scratchCtx.beginPath();
      scratchCtx.arc(cx, cy, radiusPx, 0, Math.PI * 2);
      scratchCtx.fill();

      scratchTexture.needsUpdate = true;
      scratchCoverageRatio = Math.min(1.0, scratchCoverageRatio + 0.012);

      // Spawn physical 3D paper scraps along the cursor tear!
      if (Math.random() > 0.35) {
        spawnPaperScrapsAtUV(uvX, uvY, 2);
      }

      const now = performance.now();
      if (now - lastScratchAudioTime > 120) {
        soundEngine.playScratchTearGrain();
        lastScratchAudioTime = now;
      }
    };

    const raycaster = new THREE.Raycaster();
    const ndcPointer = new THREE.Vector2();

    const getIntersectUV = (clientX: number, clientY: number): [number, number] | null => {
      const rect = renderer.domElement.getBoundingClientRect();
      ndcPointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      ndcPointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndcPointer, camera);
      const hits = raycaster.intersectObject(portraitMesh);
      if (hits.length > 0 && hits[0].uv) {
        return [hits[0].uv.x, hits[0].uv.y];
      }
      return null;
    };

    const handlePointerMove = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      const normX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const normY = Math.max(0, Math.min(1, 1.0 - (e.clientY - rect.top) / rect.height));

      const dx = normX - targetMouseUV.x;
      const dy = normY - targetMouseUV.y;
      const instSpeed = Math.hypot(dx, dy);

      targetMouseUV.set(normX, normY);
      mouseSpeedAccum = Math.min(1.5, mouseSpeedAccum + instSpeed * 9.5);
      lastMoveTimestamp = performance.now();

      // If user is dragging OR has "Live Cursor Paper Rip" enabled, tear the paper along the cursor!
      if ((isPointerDown || propsRef.current.mouseRipEnabled) && propsRef.current.calibrateStep === 'off') {
        const hitUV = getIntersectUV(e.clientX, e.clientY);
        if (hitUV) {
          paintScratchAtUV(hitUV[0], hitUV[1], isPointerDown ? 28 : 22);
        }
      }
    };

    const handlePointerDown = (e: PointerEvent) => {
      isPointerDown = true;
      lastMoveTimestamp = performance.now();
      mouseSpeedAccum = Math.min(1.5, mouseSpeedAccum + 0.65);

      const hitUV = getIntersectUV(e.clientX, e.clientY);
      if (!hitUV) return;

      // Check if user is calibrating left or right eye anchor
      if (propsRef.current.calibrateStep === 'left') {
        portraitMaterial.uniforms.uLeftEye.value.set(hitUV[0], hitUV[1]);
        detectedEyes[propsRef.current.currentStateIdx].leftEye = hitUV;
        soundEngine.playRemoteClick();
        propsRef.current.onCalibrateComplete('left', hitUV);
        return;
      }
      if (propsRef.current.calibrateStep === 'right') {
        portraitMaterial.uniforms.uRightEye.value.set(hitUV[0], hitUV[1]);
        detectedEyes[propsRef.current.currentStateIdx].rightEye = hitUV;
        soundEngine.playRemoteClick();
        propsRef.current.onCalibrateComplete('right', hitUV);
        return;
      }

      // Otherwise dragging on the portrait tears the paper!
      paintScratchAtUV(hitUV[0], hitUV[1], 30);
    };

    const handlePointerUp = () => {
      isPointerDown = false;
      // If user ripped more than 45% of the sheet manually with mouse, complete the paper tear transition!
      if (scratchCoverageRatio > 0.45 && !isRemoteTearing) {
        actionRef.current?.startRemoteTear();
      }
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointerup', handlePointerUp);

    // Expose imperative handles for Remote Transition Controller
    actionRef.current = {
      startRemoteTear: () => {
        if (isRemoteTearing) return;
        isRemoteTearing = true;
        remoteTearProgress = 0.01;
        lastScrapMilestone = 0.0;
        soundEngine.playPaperRipSound(0.82, 0.95 + Math.random() * 0.2);
      },
      clearScratch: () => {
        scratchCtx.fillStyle = '#000000';
        scratchCtx.fillRect(0, 0, 256, 256);
        scratchTexture.needsUpdate = true;
        scratchCoverageRatio = 0.0;
      },
      syncTextures: (currIdx: number, nxtIdx: number) => {
        portraitMaterial.uniforms.uTexCurrent.value = loadedTextures[currIdx];
        portraitMaterial.uniforms.uTexNext.value = loadedTextures[nxtIdx];
        const eyes = detectedEyes[currIdx];
        if (eyes) {
          portraitMaterial.uniforms.uLeftEye.value.set(eyes.leftEye[0], eyes.leftEye[1]);
          portraitMaterial.uniforms.uRightEye.value.set(eyes.rightEye[0], eyes.rightEye[1]);
        }
      },
    };

    // Responsive Resize Handler
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      // Adjust camera Z slightly on narrow viewports so the full portrait fits cleanly
      camera.position.z = w < 768 ? 7.6 : 6.7;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);
    handleResize();

    // ============================================================================
    // MAIN 60FPS ANIMATION LOOP
    // ============================================================================
    const clock = new THREE.Clock();
    let frameId = 0;
    let telemetryTick = 0;

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.getElapsedTime();

      // 1. Smoothly interpolate Mouse UV & calculate velocity decay
      currentMouseUV.lerp(targetMouseUV, 0.12);
      const frameDeltaVel = currentMouseUV.distanceTo(prevMouseUV) / Math.max(dt, 0.008);
      prevMouseUV.copy(currentMouseUV);

      mouseSpeedAccum = Math.max(0, mouseSpeedAccum * 0.93);

      // 2. Calculate Eye Ignition ("Jahan per Ham apna mouse ghumaye to uski aankhen bhi jal jaaye")
      const msSinceMove = performance.now() - lastMoveTimestamp;
      const isRecentlyMoved = msSinceMove < 1400;

      // Proximity to the boy's face/eyes in the center of the viewport
      const distToFace = Math.hypot(currentMouseUV.x - 0.5, currentMouseUV.y - 0.55);
      const proximityBoost = Math.max(0, 1.0 - distToFace * 1.65);

      let targetIgnition = 0.18; // Subtle base ember
      if (propsRef.current.alwaysBurnEyes) {
        targetIgnition = 1.0;
      } else if (isRecentlyMoved) {
        // Moving the mouse immediately ignites his eyes!
        targetIgnition = Math.min(
          1.0,
          0.55 + proximityBoost * 0.45 + Math.min(0.45, mouseSpeedAccum * 0.55)
        );
      } else {
        // Even when mouse stops over the face, keep eyes glowing warmly
        targetIgnition = 0.22 + proximityBoost * 0.48;
      }

      currentEyeIgnition += (targetIgnition - currentEyeIgnition) * 0.14;
      soundEngine.updateEyeFireIntensity(currentEyeIgnition);

      // 3. Rotate the 3D Hyper-Real Boy Bust toward the user's cursor in 3D space
      const targetRotY = (currentMouseUV.x - 0.5) * 0.42;
      const targetRotX = -(currentMouseUV.y - 0.5) * 0.30;
      characterGroup.rotation.y += (targetRotY - characterGroup.rotation.y) * 0.09;
      characterGroup.rotation.x += (targetRotX - characterGroup.rotation.x) * 0.09;

      // Subtle breathing levitation
      characterGroup.position.y = Math.sin(elapsed * 1.7) * 0.045;

      // Parallax background wall opposite to head rotation
      bgMesh.position.x = -(currentMouseUV.x - 0.5) * 0.65;
      bgMesh.position.y = -(currentMouseUV.y - 0.5) * 0.45;

      // 4. Advance Remote Paper Tear Transition ("ekadam paper fatane jaise")
      if (isRemoteTearing) {
        // Non-linear hand-tear cadence: fast initial rip -> slight fibrous tug -> rapid finish
        const tearSpeed =
          remoteTearProgress < 0.35
            ? 1.35
            : remoteTearProgress < 0.55
            ? 0.78
            : 1.75;
        remoteTearProgress += dt * tearSpeed;

        // Burst 3D flying paper scraps along the tear seam as it advances!
        if (remoteTearProgress - lastScrapMilestone > 0.07 && remoteTearProgress < 0.95) {
          lastScrapMilestone = remoteTearProgress;
          const mode = propsRef.current.tearMode;
          let scrapU = 0.5;
          let scrapV = 0.5;
          if (mode === 0) {
            scrapU = remoteTearProgress;
            scrapV = 1.0 - remoteTearProgress;
          } else if (mode === 1) {
            const angle = Math.random() * Math.PI * 2;
            scrapU = 0.5 + Math.cos(angle) * remoteTearProgress * 0.45;
            scrapV = 0.55 + Math.sin(angle) * remoteTearProgress * 0.45;
          } else if (mode === 2) {
            scrapU = 0.25 + Math.random() * 0.5;
            scrapV = 1.0 - remoteTearProgress;
          } else {
            scrapU = remoteTearProgress;
            scrapV = 0.25 + Math.random() * 0.5;
          }
          spawnPaperScrapsAtUV(scrapU, scrapV, 6);
        }

        if (remoteTearProgress >= 1.0) {
          // Paper Tear Transition Finished! Swap states cleanly
          isRemoteTearing = false;
          remoteTearProgress = 0.0;
          scratchCtx.fillStyle = '#000000';
          scratchCtx.fillRect(0, 0, 256, 256);
          scratchTexture.needsUpdate = true;
          scratchCoverageRatio = 0.0;

          const landedIdx = propsRef.current.nextStateIdx;
          portraitMaterial.uniforms.uTexCurrent.value = loadedTextures[landedIdx];
          const eyes = detectedEyes[landedIdx];
          if (eyes) {
            portraitMaterial.uniforms.uLeftEye.value.set(eyes.leftEye[0], eyes.leftEye[1]);
            portraitMaterial.uniforms.uRightEye.value.set(eyes.rightEye[0], eyes.rightEye[1]);
          }
          propsRef.current.onTransitionComplete(landedIdx);
        }
      }

      // 5. Update Shader Uniforms
      portraitMaterial.uniforms.uTime.value = elapsed;
      portraitMaterial.uniforms.uEyeIgnition.value = currentEyeIgnition;
      portraitMaterial.uniforms.uTearProgress.value = remoteTearProgress;
      portraitMaterial.uniforms.uTearMode.value = propsRef.current.tearMode;
      portraitMaterial.uniforms.uDepthStrength.value = propsRef.current.depthStrength;
      portraitMaterial.uniforms.uPaperCurl.value = propsRef.current.paperCurl;
      portraitMaterial.uniforms.uTearJaggedness.value = propsRef.current.tearJaggedness;
      portraitMaterial.uniforms.uMouseUV.value.copy(currentMouseUV);
      portraitMaterial.uniforms.uMouseVelocity.value = Math.min(1.0, frameDeltaVel);
      portraitMaterial.uniforms.uFlameColorPrimary.value.set(
        ...propsRef.current.flamePreset.primaryRGB
      );
      portraitMaterial.uniforms.uFlameColorSecondary.value.set(
        ...propsRef.current.flamePreset.secondaryRGB
      );

      // 6. Update 3D Volumetric Eye Fire Particles in local head space
      const leftUV = portraitMaterial.uniforms.uLeftEye.value;
      const rightUV = portraitMaterial.uniforms.uRightEye.value;
      const gazeShiftX = (currentMouseUV.x - 0.5) * 0.06;
      const gazeShiftY = (currentMouseUV.y - 0.5) * 0.06;

      const leftEye3D = new THREE.Vector3(
        (leftUV.x - 0.5) * portraitWidth + gazeShiftX,
        (leftUV.y - 0.5) * portraitHeight + gazeShiftY,
        0.38 * propsRef.current.depthStrength
      );
      const rightEye3D = new THREE.Vector3(
        (rightUV.x - 0.5) * portraitWidth + gazeShiftX,
        (rightUV.y - 0.5) * portraitHeight + gazeShiftY,
        0.38 * propsRef.current.depthStrength
      );

      fireParticleMat.uniforms.uIgnition.value = currentEyeIgnition;
      fireParticleMat.uniforms.uColorPrimary.value.set(
        ...propsRef.current.flamePreset.primaryRGB
      );
      fireParticleMat.uniforms.uColorSecondary.value.set(
        ...propsRef.current.flamePreset.secondaryRGB
      );

      const posAttr = fireGeo.getAttribute('position') as THREE.BufferAttribute;
      const ageAttr = fireGeo.getAttribute('aAge') as THREE.BufferAttribute;

      for (let i = 0; i < fireParticleCount; i++) {
        fireAges[i] += dt * (0.85 + currentEyeIgnition * 0.75);
        if (fireAges[i] >= fireMaxAges[i]) {
          resetFireParticle(i, leftEye3D, rightEye3D, currentEyeIgnition);
        } else {
          // Turbulence + attraction toward mouse gaze direction
          const swirlX = Math.sin(elapsed * 8.0 + i * 0.7) * 0.35;
          firePositions[i * 3] += (fireVelocities[i * 3] + swirlX + gazeShiftX * 2.2) * dt;
          firePositions[i * 3 + 1] += fireVelocities[i * 3 + 1] * dt;
          firePositions[i * 3 + 2] += fireVelocities[i * 3 + 2] * dt;
        }
      }
      posAttr.needsUpdate = true;
      ageAttr.needsUpdate = true;

      // 7. Update 3D Flying Paper Scraps physics
      for (let i = activeScraps.length - 1; i >= 0; i--) {
        const scrap = activeScraps[i];
        scrap.life += dt;
        if (scrap.life >= scrap.maxLife) {
          scrapsGroup.remove(scrap.mesh);
          scrap.mesh.geometry.dispose();
          activeScraps.splice(i, 1);
          continue;
        }
        // Gravity + air flutter
        scrap.velocity.y -= 3.8 * dt;
        scrap.velocity.x += Math.sin(elapsed * 10 + i) * 1.5 * dt;
        scrap.mesh.position.addScaledVector(scrap.velocity, dt);
        scrap.mesh.rotation.x += scrap.rotVelocity.x * dt;
        scrap.mesh.rotation.y += scrap.rotVelocity.y * dt;
        scrap.mesh.rotation.z += scrap.rotVelocity.z * dt;
      }

      renderer.render(scene, camera);

      // 8. Throttled Telemetry callback for HUD meters (~12Hz)
      telemetryTick++;
      if (telemetryTick % 5 === 0) {
        propsRef.current.onTelemetryUpdate({
          eyeIgnition: currentEyeIgnition,
          tearProgress: remoteTearProgress,
          mouseSpeed: Math.min(1, mouseSpeedAccum),
          scratchCoverage: scratchCoverageRatio,
          leftEyeUV: [leftUV.x, leftUV.y],
          rightEyeUV: [rightUV.x, rightUV.y],
        });
      }
    };

    animate();

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);
      portraitGeo.dispose();
      portraitMaterial.dispose();
      fireGeo.dispose();
      fireParticleMat.dispose();
      bgGeo.dispose();
      bgMat.dispose();
      renderer.dispose();
    };
  }, []);

  const currentState = PROTAGONIST_STATES[currentStateIdx] || PROTAGONIST_STATES[0];

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#09090B]">
      {/* WebGL 3D Viewport Canvas Container */}
      <div
        ref={containerRef}
        className={`w-full h-full ${
          calibrateStep !== 'off'
            ? 'cursor-crosshair'
            : mouseRipEnabled
            ? 'cursor-grab active:cursor-grabbing'
            : 'cursor-default'
        }`}
      />

      {/* Resilient 2D Fallback if WebGL Context is unavailable */}
      {webglError && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#09090B] p-6 z-0">
          <div className="relative max-w-md w-full aspect-[3/4] rounded-xl overflow-hidden border border-white/10 shadow-2xl">
            <img
              src={currentState.imageUrl}
              alt={currentState.name}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent flex flex-col justify-end p-6">
              <p className="text-xs font-mono text-amber-400">Fallback Preview Mode</p>
              <h2 className="text-xl font-bold text-white mt-1">{currentState.name}</h2>
              <p className="text-sm text-zinc-300 mt-1">{currentState.description}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
