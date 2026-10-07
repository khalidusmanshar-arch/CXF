/**
 * Custom GLSL Vertex & Fragment Shaders for GTASG2:
 * 1. 3D Sculptural Facial Depth Relief + Normal-Mapped Skin Specular Lighting
 * 2. Hyper-Real Eye Ignition ("Aankhen Jal Jaaye") with FBM Rising Flames, Molten Iris & Pupil Mouse Tracking
 * 3. Physical 3D Paper Tear & Peel Transition ("Paper Fatane Jaise") with Fibrous White Pulp Edge & Cast Drop Shadow
 */

export const HYPER_REAL_VERTEX_SHADER = /* glsl */ `
  uniform sampler2D uTexCurrent;
  uniform sampler2D uTexNext;
  uniform sampler2D uScratchMap;
  uniform float uTime;
  uniform float uDepthStrength;
  uniform float uEyeIgnition;
  uniform float uTearProgress;
  uniform int uTearMode;
  uniform float uTearJaggedness;
  uniform float uPaperCurl;
  uniform vec2 uMouseUV;
  uniform vec2 uLeftEye;
  uniform vec2 uRightEye;

  varying vec2 vUv;
  varying float vElevation;
  varying float vPaperCurlFactor;
  varying vec3 vViewPosition;

  // Fast 2D hash & value noise for vertex shader paper curl & cranial relief
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float fbmVertex(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 3; i++) {
      v += a * vnoise(p);
      p *= 2.04;
      a *= 0.5;
    }
    return v;
  }

  // Anatomical 3D head relief envelope so the portrait is a genuine 3D sculptural bust
  float computeAnatomicalRelief(vec2 uv) {
    // Center of face around (0.5, 0.55)
    vec2 headCenter = vec2(0.5, 0.54);
    vec2 d = (uv - headCenter) * vec2(1.25, 0.95);
    float cranium = max(0.0, 1.0 - dot(d, d) * 2.1);
    cranium = pow(cranium, 0.75) * 0.55;

    // Nose bridge and tip prominence
    float noseBridge = exp(-pow((uv.x - 0.5) * 14.0, 2.0)) *
                       exp(-pow((uv.y - 0.50) * 6.5, 2.0)) * 0.22;
    float noseTip = exp(-pow((uv.x - 0.5) * 11.0, 2.0)) *
                    exp(-pow((uv.y - 0.44) * 12.0, 2.0)) * 0.14;

    // Brow ridge & cheekbones
    float brow = exp(-pow((uv.x - 0.5) * 4.2, 2.0)) *
                 exp(-pow((uv.y - 0.61) * 16.0, 2.0)) * 0.12;
    float cheeks = (exp(-pow((uv.x - 0.36) * 8.5, 2.0)) + exp(-pow((uv.x - 0.64) * 8.5, 2.0))) *
                   exp(-pow((uv.y - 0.47) * 9.0, 2.0)) * 0.10;

    // Chin & torso shoulders
    float chin = exp(-pow((uv.x - 0.5) * 8.0, 2.0)) *
                 exp(-pow((uv.y - 0.30) * 11.0, 2.0)) * 0.12;
    float shoulders = exp(-pow((uv.x - 0.5) * 1.6, 2.0)) *
                      smoothstep(0.32, 0.0, uv.y) * 0.32;

    // Subtle eye socket recess
    float leftSocket = exp(-dot(uv - uLeftEye, uv - uLeftEye) * 320.0) * 0.06;
    float rightSocket = exp(-dot(uv - uRightEye, uv - uRightEye) * 320.0) * 0.06;

    return cranium + noseBridge + noseTip + brow + cheeks + chin + shoulders - leftSocket - rightSocket;
  }

  // Computes the paper tear signed field in vertex shader for 3D paper curling
  float computeTearFieldVertex(vec2 uv) {
    float n = (fbmVertex(uv * uTearJaggedness + vec2(1.7, 3.1)) - 0.5) * 0.26;
    float baseCoord = 0.0;

    if (uTearMode == 0) {
      // Diagonal Slash Rip (Top-Left to Bottom-Right)
      baseCoord = (uv.x * 0.65 + (1.0 - uv.y) * 0.35);
    } else if (uTearMode == 1) {
      // Center Eye Burst Rip (Radial explosion from between the burning eyes)
      vec2 eyeMid = (uLeftEye + uRightEye) * 0.5;
      baseCoord = length((uv - eyeMid) * vec2(1.0, 1.25)) * 1.15;
    } else if (uTearMode == 2) {
      // Vertical Poster Peel (Top to Bottom)
      baseCoord = 1.0 - uv.y;
    } else {
      // Horizontal Claw Rip (Left to Right with wave)
      baseCoord = uv.x + sin(uv.y * 10.0) * 0.05;
    }

    float threshold = uTearProgress * 1.38 - 0.18;
    return (baseCoord + n) - threshold;
  }

  void main() {
    vUv = uv;

    vec4 texCurr = texture2D(uTexCurrent, uv);
    vec4 texNext = texture2D(uTexNext, uv);
    float scratchVal = texture2D(uScratchMap, uv).r;

    float lumaCurr = dot(texCurr.rgb, vec3(0.299, 0.587, 0.114));
    float lumaNext = dot(texNext.rgb, vec3(0.299, 0.587, 0.114));

    float tearDist = computeTearFieldVertex(uv);
    // Combine remote transition tear and interactive mouse scratch tear
    bool isRipped = (tearDist < 0.0) || (scratchVal > 0.45);
    float activeLuma = isRipped ? lumaNext : lumaCurr;

    float anatomy = computeAnatomicalRelief(uv);
    float relief = (anatomy * 0.78 + activeLuma * 0.32) * uDepthStrength;

    // 3D Paper Peel & Curl Deformation right along the tearing edge!
    float curlZone = smoothstep(0.22, 0.0, abs(tearDist)) * step(0.0, tearDist);
    float scratchCurl = smoothstep(0.15, 0.45, scratchVal) * step(scratchVal, 0.52);
    float activeTearActive = step(0.01, uTearProgress) * step(uTearProgress, 0.99);
    float curlAmount = (curlZone * activeTearActive + scratchCurl * 0.85) * uPaperCurl;

    // Slight upward ripple on curl
    float curlWave = sin(uv.x * 18.0 + uv.y * 14.0 + uTime * 4.0) * 0.04 * curlAmount;

    // Eye socket thermal pulse when eyes ignite
    float eyeDist = min(distance(uv, uLeftEye), distance(uv, uRightEye));
    float eyePulse = exp(-eyeDist * 28.0) * uEyeIgnition * 0.045 * (0.8 + 0.2 * sin(uTime * 16.0));

    vec3 displaced = position;
    displaced.z += relief + curlAmount * 0.42 + curlWave + eyePulse;

    // Subtle 3D tilt toward mouse cursor inside vertex space
    vec2 mouseCentered = uMouseUV - 0.5;
    displaced.x += mouseCentered.x * relief * 0.12;
    displaced.y += mouseCentered.y * relief * 0.12;

    vElevation = displaced.z;
    vPaperCurlFactor = curlAmount;

    vec4 mvPosition = modelViewMatrix * vec4(displaced, 1.0);
    vViewPosition = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

export const HYPER_REAL_FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  uniform sampler2D uTexCurrent;
  uniform sampler2D uTexNext;
  uniform sampler2D uScratchMap;
  uniform float uTime;
  uniform float uEyeIgnition;
  uniform float uTearProgress;
  uniform int uTearMode;
  uniform float uTearJaggedness;
  uniform float uPaperCurl;
  uniform vec2 uMouseUV;
  uniform float uMouseVelocity;
  uniform vec2 uLeftEye;
  uniform vec2 uRightEye;
  uniform vec3 uFlameColorPrimary;
  uniform vec3 uFlameColorSecondary;

  varying vec2 vUv;
  varying float vElevation;
  varying float vPaperCurlFactor;
  varying vec3 vViewPosition;

  // High-precision 2D Simplex/Value Noise & FBM for realistic paper fibers and eye flames
  float hash(vec2 p) {
    p = fract(p * vec2(234.34, 435.345));
    p += dot(p, p + 34.23);
    return fract(p.x * p.y);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
    for (int i = 0; i < 5; i++) {
      v += a * noise(p);
      p = rot * p * 2.05 + vec2(12.4, 7.8);
      a *= 0.5;
    }
    return v;
  }

  // Computes Hyper-Real Burning Eyes ("Aankhen Jal Jaaye") for a given eye anchor UV
  vec3 computeSingleEyeFire(vec2 uv, vec2 eyeAnchor, float ignition, vec2 gazeOffset) {
    if (ignition <= 0.005) return vec3(0.0);

    // Pupil shifts slightly toward the mouse cursor so his burning gaze tracks the user!
    vec2 trackedEye = eyeAnchor + gazeOffset * 0.014;

    // Aspect-corrected vector around the eye
    vec2 delta = (uv - trackedEye) * vec2(1.0, 1.38);
    float dist = length(delta);

    // 1. White-hot molten pupil & iris core
    float core = exp(-dist * dist * 1650.0);
    float irisRing = exp(-pow((dist - 0.017) * 85.0, 2.0)) * 0.9;

    // 2. Swirling plasma turbulence inside the eye socket
    float angle = atan(delta.y, delta.x);
    float swirl = fbm(vec2(angle * 2.5 + uTime * 2.2, dist * 38.0 - uTime * 5.0));
    float socketGlow = exp(-dist * 34.0) * (0.65 + 0.55 * swirl);

    // 3. Upward-licking shader flame tongues rising from the eye ("aankhen jal jaaye")
    vec2 flameDelta = uv - trackedEye;
    // Stretch domain below/above eye so flames rise in +Y
    vec2 flameDomain = vec2(flameDelta.x * 1.35, max(0.0, flameDelta.y) * 0.62 - min(0.0, flameDelta.y) * 2.2);
    float flameDist = length(flameDomain);
    float flameTurbulence = fbm(vec2(
      flameDelta.x * 32.0 + sin(uTime * 6.0 + flameDelta.y * 20.0) * 0.6,
      flameDelta.y * 24.0 - uTime * 7.5
    ));
    float risingTongue = smoothstep(0.11 * (0.45 + 0.75 * ignition), 0.0, flameDist - flameTurbulence * 0.048 * ignition);
    // Concentrate rising flame above the eye center
    risingTongue *= smoothstep(-0.018, 0.025, flameDelta.y) * exp(-abs(flameDelta.x) * 32.0);

    // 4. Scorched magma veins radiating around eyelids at high ignition
    float veinNoise = abs(sin(angle * 9.0 + fbm(uv * 42.0) * 6.0));
    float magmaVeins = smoothstep(0.18, 0.0, veinNoise) * exp(-dist * 26.0) * smoothstep(0.012, 0.045, dist) * ignition;

    // Compose thermal color gradient: White-Hot Core -> Secondary Gold/Cyan -> Primary Inferno Red/Orange
    vec3 whiteHot = vec3(1.0, 0.98, 0.88);
    vec3 col = vec3(0.0);
    col += whiteHot * (core * 2.2 + irisRing * 0.8);
    col += uFlameColorSecondary * (irisRing * 1.4 + risingTongue * 1.25 + socketGlow * 0.85);
    col += uFlameColorPrimary * (socketGlow * 1.6 + risingTongue * 1.6 + magmaVeins * 1.4);

    // Flickering organic pulse
    float flicker = 0.88 + 0.12 * sin(uTime * 27.0 + eyeAnchor.x * 40.0) * cos(uTime * 19.0);
    return col * ignition * flicker;
  }

  // Samples surface portrait + applies 3D normal-mapped studio + eye-fire illumination
  vec3 renderPortraitState(sampler2D tex, vec2 uv, float eyeBoost) {
    // Subtle heat shimmer distortion near the eyes when burning intensely
    float distL = distance(uv, uLeftEye);
    float distR = distance(uv, uRightEye);
    float minEyeDist = min(distL, distR);
    vec2 heatShimmer = vec2(
      sin(uv.y * 80.0 + uTime * 14.0),
      cos(uv.x * 80.0 - uTime * 12.0)
    ) * 0.0018 * uEyeIgnition * exp(-minEyeDist * 18.0);

    vec2 sampleUv = clamp(uv + heatShimmer, 0.001, 0.999);
    vec3 baseColor = texture2D(tex, sampleUv).rgb;

    // Compute fine skin surface normal from luminance gradients for hyper-real 3D lighting
    float eps = 0.0022;
    float hL = dot(texture2D(tex, clamp(sampleUv - vec2(eps, 0.0), 0.0, 1.0)).rgb, vec3(0.333));
    float hR = dot(texture2D(tex, clamp(sampleUv + vec2(eps, 0.0), 0.0, 1.0)).rgb, vec3(0.333));
    float hD = dot(texture2D(tex, clamp(sampleUv - vec2(0.0, eps), 0.0, 1.0)).rgb, vec3(0.333));
    float hU = dot(texture2D(tex, clamp(sampleUv + vec2(0.0, eps), 0.0, 1.0)).rgb, vec3(0.333));

    vec3 normal = normalize(vec3((hL - hR) * 3.2, (hD - hU) * 3.2, 1.0));

    // Interactive 3D Mouse Key Light
    vec3 lightPos = vec3((uMouseUV.x - 0.5) * 1.8, (uMouseUV.y - 0.5) * 1.8, 0.75);
    vec3 lightDir = normalize(lightPos - vec3(uv - 0.5, 0.0));
    float diff = max(dot(normal, lightDir), 0.0);

    // Specular skin pore highlight
    vec3 viewDir = normalize(vec3(0.0, 0.0, 1.0));
    vec3 halfDir = normalize(lightDir + viewDir);
    float spec = pow(max(dot(normal, halfDir), 0.0), 28.0) * 0.22;

    // Dual Eye Fire Point Lights illuminating nose bridge, brow & cheeks!
    vec3 leftEyeLightDir = normalize(vec3(uLeftEye - uv, 0.08));
    vec3 rightEyeLightDir = normalize(vec3(uRightEye - uv, 0.08));
    float eyeAttenL = 1.0 / (1.0 + 45.0 * distL * distL);
    float eyeAttenR = 1.0 / (1.0 + 45.0 * distR * distR);
    float eyeDiffL = max(dot(normal, leftEyeLightDir), 0.0) * eyeAttenL;
    float eyeDiffR = max(dot(normal, rightEyeLightDir), 0.0) * eyeAttenR;

    float activeIgnition = clamp(uEyeIgnition + eyeBoost, 0.0, 1.25);
    vec3 eyeSkinBounce = (eyeDiffL + eyeDiffR) * uFlameColorPrimary * activeIgnition * 0.85;

    // Gaze offset toward mouse cursor
    vec2 gazeOffset = clamp((uMouseUV - 0.5) * 1.6, -1.0, 1.0);

    // Compute burning eyes for both Left and Right eyes
    vec3 fireLeft = computeSingleEyeFire(uv, uLeftEye, activeIgnition, gazeOffset);
    vec3 fireRight = computeSingleEyeFire(uv, uRightEye, activeIgnition, gazeOffset);

    // Combine portrait lighting + skin specular + fiery eye emission
    vec3 litColor = baseColor * (0.86 + 0.26 * diff) + vec3(spec) + eyeSkinBounce;
    litColor += fireLeft + fireRight;

    return litColor;
  }

  void main() {
    // 1. Compute Paper Tear Signed Distance Field ("ekadam paper fatane jaise")
    float coarseNoise = (fbm(vUv * uTearJaggedness + vec2(1.7, 3.1)) - 0.5) * 0.26;
    float fineFiberNoise = (fbm(vUv * (uTearJaggedness * 4.8) + vec2(8.3, 2.9)) - 0.5) * 0.055;
    float microGrain = (noise(vUv * 240.0) - 0.5) * 0.018;

    float baseCoord = 0.0;
    if (uTearMode == 0) {
      // Diagonal Slash Rip
      baseCoord = (vUv.x * 0.65 + (1.0 - vUv.y) * 0.35);
    } else if (uTearMode == 1) {
      // Center Eye Burst Rip
      vec2 eyeMid = (uLeftEye + uRightEye) * 0.5;
      baseCoord = length((vUv - eyeMid) * vec2(1.0, 1.25)) * 1.15;
    } else if (uTearMode == 2) {
      // Vertical Poster Peel
      baseCoord = 1.0 - vUv.y;
    } else {
      // Horizontal Claw Rip
      baseCoord = vUv.x + sin(vUv.y * 10.0) * 0.05;
    }

    float remoteThreshold = uTearProgress * 1.38 - 0.18;
    float remoteTearField = (baseCoord + coarseNoise + fineFiberNoise + microGrain) - remoteThreshold;

    // 2. Also sample interactive Mouse Paper-Rip Scratch Map (when user rips paper directly with cursor!)
    float scratchSample = texture2D(uScratchMap, vUv).r;
    // Add fibrous jagged noise to the mouse scratch boundary so it rips like real paper too!
    float scratchField = 0.46 - (scratchSample + fineFiberNoise * 1.35 + microGrain * 1.2);

    // Combine both tear fields (whichever is more ripped at this pixel)
    float d = min(remoteTearField, scratchField);

    // Render top sheet (Current Hyper-Real State) and bottom sheet (Next Revealed State)
    // Underlying revealed state has extra eye-fire intensity for dramatic reveal!
    vec3 colTop = renderPortraitState(uTexCurrent, vUv, 0.0);
    vec3 colBottom = renderPortraitState(uTexNext, vUv, 0.22);

    // Add 3D Paper Curl shading onto the top sheet near the tear boundary
    float curlHighlight = vPaperCurlFactor * 0.22;
    colTop += vec3(curlHighlight);

    // Paper Tear Edge Width (white fibrous paper pulp core exposed along the rip!)
    float pulpWidth = 0.032 + fineFiberNoise * 0.35;

    // Fibrous torn paper pulp texture (warm off-white cellulose fiber with subtle pulp grain)
    float fiberPattern = fbm(vUv * 95.0);
    float fineSpeckle = noise(vUv * 320.0);
    vec3 paperPulpLight = vec3(0.96, 0.94, 0.89);
    vec3 paperPulpShade = vec3(0.80, 0.76, 0.69);
    vec3 paperFiberColor = mix(paperPulpShade, paperPulpLight, fiberPattern * 0.75 + fineSpeckle * 0.25);

    // Slight scorched ember tint on paper edge if tear is near the burning eyes!
    float eyeProximity = min(distance(vUv, uLeftEye), distance(vUv, uRightEye));
    float emberScorch = exp(-eyeProximity * 8.0) * uEyeIgnition * 0.65;
    paperFiberColor = mix(paperFiberColor, uFlameColorSecondary * 1.15, emberScorch * (1.0 - fiberPattern * 0.5));

    vec3 finalColor = colTop;

    if (d < -pulpWidth) {
      // Zone C: Fully ripped open -> Reveal underlying state (colBottom) with a cast drop-shadow near the torn edge
      float shadowDist = abs(d + pulpWidth);
      float dropShadow = smoothstep(0.0, 0.055, shadowDist);
      finalColor = colBottom * (0.38 + 0.62 * dropShadow);
    } else if (d < 0.0) {
      // Zone B: Exposed White Fibrous Torn Paper Pulp Edge!
      float edgePos = abs(d) / pulpWidth; // 0 at outer paint edge, 1 at inner torn edge
      // Rough feathered outer cellulose fibers
      float outerBlend = smoothstep(0.0, 0.14, edgePos);
      float innerBevel = 1.0 - 0.25 * smoothstep(0.7, 1.0, edgePos);
      finalColor = mix(colTop, paperFiberColor * innerBevel, outerBlend);
    } else {
      // Zone A: Intact Top Sheet with subtle crease line right before the rip
      float crease = smoothstep(0.0, 0.018, d);
      finalColor = colTop * (0.88 + 0.12 * crease);
    }

    // Subtle cinematic vignette around portrait edges
    vec2 vigUv = vUv * (1.0 - vUv.yx);
    float vig = pow(max(0.0, vigUv.x * vigUv.y * 16.0), 0.18);
    finalColor *= mix(0.65, 1.0, vig);

    gl_FragColor = vec4(finalColor, 1.0);
  }
`;
