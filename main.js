// ==============================================================================
// JJK VIZ: MALEVOLENT SHRINE (FINAL GRAVITY & STRUCTURE FIX)
// ==============================================================================

// --- CONFIGURATION ---
const CONFIG = {
    colors: {
        blood: 0x990000,    
        bone: 0xe8e0d5,     
        teeth: 0xffffff,    
        roof: 0x4a0a0a,     
        voidFog: 0x020000,  
        domainFog: 0x330000,
        aura: 0x880000      
    },
    counts: {
        blood: 20000, 
        skulls: 8000,
        pillars: 5000, 
        teeth: 8000,       
        roof: 14000,
        aura: 6000         
    },
    timing: {
        formDuration: 6.0,  
        abortSpeed: 3.0
    }
};


// ==============================================================================
// 1. THREE.JS SCENE SETUP
// ==============================================================================
const scene = new THREE.Scene();
let currentFogColor = new THREE.Color(CONFIG.colors.voidFog);
scene.fog = new THREE.FogExp2(currentFogColor, 0.025);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 2, 14); 
camera.lookAt(0, 1, 0); 

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(currentFogColor, 1); 
document.getElementById('canvas-container').appendChild(renderer.domElement);

// --- Post-Processing ---
const renderScene = new THREE.RenderPass(scene, camera);
const bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
bloomPass.threshold = 0.2; bloomPass.strength = 1.2; bloomPass.radius = 0.4;
const composer = new THREE.EffectComposer(renderer);
composer.addPass(renderScene); composer.addPass(bloomPass);

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
});


// ==============================================================================
// 2. SENSOR & HAND TRACKING
// ==============================================================================
const videoElement = document.querySelector('.input_video');
const canvasElement = document.querySelector('.output_canvas');
const canvasCtx = canvasElement.getContext('2d');

let sensorState = { handsDetected: 0, handsDistance: 999, isTriggered: false };
let wasTwoFingersUp = false;
let dismantleQueued = false;
let wasFist = false;
let closeQueued = false;

function onHandsResults(results) {
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    if (results.image) {
        canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
    }
    sensorState.handsDetected = results.multiHandLandmarks ? results.multiHandLandmarks.length : 0;
    sensorState.isTriggered = false;
    let twoFingersUpNow = false;
    let fistNow = false;
    if (sensorState.handsDetected > 0) {
        results.multiHandLandmarks.forEach((landmarks) => {
            drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {color: '#440000', lineWidth: 2}); 
            drawLandmarks(canvasCtx, landmarks, {color: '#ff0000', lineWidth: 1, radius: 2});

            // Dismantle gesture: index + middle up, ring + pinky down
            const indexUp = landmarks[8].y < landmarks[6].y;
            const middleUp = landmarks[12].y < landmarks[10].y;
            const ringDown = landmarks[16].y > landmarks[14].y;
            const pinkyDown = landmarks[20].y > landmarks[18].y;
            if (indexUp && middleUp && ringDown && pinkyDown) {
                twoFingersUpNow = true;
            }

            // Close gesture: fist
            const indexFolded = landmarks[8].y > landmarks[6].y;
            const middleFolded = landmarks[12].y > landmarks[10].y;
            const ringFolded = landmarks[16].y > landmarks[14].y;
            const pinkyFolded = landmarks[20].y > landmarks[18].y;
            const thumbFolded =
                Math.abs(landmarks[4].x - landmarks[2].x) < 0.10 &&
                landmarks[4].y > landmarks[3].y;
            if (indexFolded && middleFolded && ringFolded && pinkyFolded && thumbFolded) {
                fistNow = true;
            }
        });
        if (sensorState.handsDetected === 2) {
            const p1 = results.multiHandLandmarks[0][9]; const p2 = results.multiHandLandmarks[1][9];
            sensorState.handsDistance = Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
            if (sensorState.handsDistance < 0.2) sensorState.isTriggered = true;
        } else { sensorState.handsDistance = 999; }
    } else {
        sensorState.handsDistance = 999;
    }
    if (twoFingersUpNow && !wasTwoFingersUp) {
        dismantleQueued = true;
    }
    wasTwoFingersUp = twoFingersUpNow;
    if (fistNow && !wasFist) {
        closeQueued = true;
    }
    wasFist = fistNow;
    canvasCtx.restore();
}

const hands = new Hands({locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`});
hands.setOptions({ maxNumHands: 2, modelComplexity: 1, minDetectionConfidence: 0.7, minTrackingConfidence: 0.7 });
hands.onResults(onHandsResults);
const camera_util = new Camera(videoElement, { onFrame: async () => { await hands.send({image: videoElement}); }, width: 320, height: 240 });
camera_util.start();


// ==============================================================================
// 3. SHRINE ARCHITECTURE DEFINITION
// ==============================================================================
const shrineGroup = new THREE.Group();
scene.add(shrineGroup);

function createParticleSystem(name, count, color, size, opacity, shapeGeneratorStr) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const base = new Float32Array(count * 3);
    const generator = new Function('i', 'count', 'u', 'v', shapeGeneratorStr);
    let idx = 0;
    for(let i=0; i<count; i++) {
        const u = Math.random(); const v = Math.random();
        const p = generator(i, count, u, v);
        pos[idx] = p.x; pos[idx+1] = p.y; pos[idx+2] = p.z;
        base[idx] = p.x; base[idx+1] = p.y; base[idx+2] = p.z;
        idx += 3;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('basePosition', new THREE.BufferAttribute(base, 3));
    const mat = new THREE.PointsMaterial({
        color: color, size: size, transparent: true, opacity: 0, 
        blending: THREE.AdditiveBlending, depthWrite: false, name: name + '_mat'
    });
    return new THREE.Points(geo, mat);
}


// --- COMPONENT A: THE BLOOD LAKE (Floor Spill) ---
const bloodLake = createParticleSystem('blood', CONFIG.counts.blood, CONFIG.colors.blood, 0.1, 0.9, `
    const r = Math.sqrt(u) * 40; // Wider spill
    const theta = v * 2 * Math.PI;
    return { x: r * Math.cos(theta), y: -10.0, z: r * Math.sin(theta) };
`);
shrineGroup.add(bloodLake);

// --- NEW COMPONENT: RISING GRAVITY AURA ---
const aura = createParticleSystem('aura', CONFIG.counts.aura, CONFIG.colors.aura, 0.05, 0.7, `
    const r = Math.sqrt(u) * 35; 
    const theta = v * 2 * Math.PI;
    const yStart = -4.5 + (Math.random() * 10); // Spread vertically initially
    return { x: r * Math.cos(theta), y: yStart, z: r * Math.sin(theta) };
`);
shrineGroup.add(aura);


// --- COMPONENT B: THE PILE OF SKULLS (Base) ---
const skulls = createParticleSystem('skulls', CONFIG.counts.skulls, CONFIG.colors.bone, 0.08, 0.9, `
    const r = u * 9; 
    const theta = v * 2 * Math.PI;
    const pileHeight = Math.max(0, 5 - r) * 0.9; 
    const y = -4.5 + Math.random() * pileHeight;
    return { x: r * Math.cos(theta), y: y, z: r * Math.sin(theta) * 0.6 };
`);
shrineGroup.add(skulls);


// --- COMPONENT C: THE PILLARS (Structure) ---
const pillars = createParticleSystem('pillars', CONFIG.counts.pillars, CONFIG.colors.bone, 0.09, 1.0, `
    const corner = Math.floor(u * 4);
    let px = (corner % 2 === 0 ? 1 : -1) * 6.5; // Wider stance
    let pz = (corner < 2 ? 1 : -1) * 6.5;
    px += (Math.random() - 0.5) * 1.5; pz += (Math.random() - 0.5) * 1.5;
    const y = -4.5 + v * 9.0;
    return { x: px, y: y, z: pz };
`);
shrineGroup.add(pillars);


// --- COMPONENT D: THE MAW (FIXED WIDE ARCH) ---
const teeth = createParticleSystem('teeth', CONFIG.counts.teeth, CONFIG.colors.teeth, 0.07, 1.0, `
    const width = 8.0; // Much wider mouth
    const x = (u - 0.5) * width;
    
    // Smooth Arch
    const archHeight = 5.0;
    const archBaseY = -2.0;
    const archY = archBaseY + (1.0 - Math.pow((x / (width*0.5)), 2)) * archHeight;
    
    // Distinct Fangs
    // Use modulo to create sharp, separated teeth instead of a sine wave
    const toothIndex = Math.floor(x * 2.0); 
    const toothPhase = (x * 2.0) - toothIndex; // 0 to 1 per tooth
    const toothShape = 1.0 - Math.abs(toothPhase - 0.5) * 2.0; // Pyramid shape
    const fangLength = 0.8 + Math.random() * 0.4;
    
    const isTop = v > 0.5;
    // Top teeth hang, bottom teeth poke
    const y = isTop ? archY - (toothShape * fangLength) : -4.0 + (toothShape * fangLength);
    
    // Slight curve in Z for depth
    const z = Math.cos(u * Math.PI) * 2.5;
    return { x: x, y: y, z: z };
`);
shrineGroup.add(teeth);


// --- COMPONENT E: THE SHRINE ROOF (Lower & Wider) ---
const roof = createParticleSystem('roof', CONFIG.counts.roof, CONFIG.colors.roof, 0.09, 0.95, `
    const layer = Math.floor(u * 3); 
    const layerBaseY = 3.5 + (layer * 2.0); // Lowered slightly to sit ON the pillars
    const scale = 1.0 - (layer * 0.25);
    const angle = v * Math.PI * 2;
    
    const cornerSqueeze = Math.pow(Math.abs(Math.sin(angle * 2)), 0.6); 
    // Wider roof radius to overhang pillars
    const r = (2.5 + cornerSqueeze * 7) * scale * Math.sqrt(Math.random()); 
    const curveUp = cornerSqueeze * 2.5; 
    
    return { x: r * Math.cos(angle), y: layerBaseY + curveUp, z: r * Math.sin(angle) * 0.6 };
`);
shrineGroup.add(roof);


// ==============================================================================
// 4. VFX: CLEAVE (SLASHES)
// ==============================================================================
const slashGeo = new THREE.BufferGeometry();
const slashPos = new Float32Array(50 * 2 * 3); 
slashGeo.setAttribute('position', new THREE.BufferAttribute(slashPos, 3));
const slashMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending });
const slashLines = new THREE.LineSegments(slashGeo, slashMat);
scene.add(slashLines);

// Gesture-fired direct dismantle slashes
const DISMANTLE_MAX = 16;
const dismantleGeo = new THREE.BufferGeometry();
const dismantlePos = new Float32Array(DISMANTLE_MAX * 2 * 3);
dismantleGeo.setAttribute('position', new THREE.BufferAttribute(dismantlePos, 3));
const dismantleMat = new THREE.LineBasicMaterial({
    color: 0xffdddd,
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending
});
const dismantleLines = new THREE.LineSegments(dismantleGeo, dismantleMat);
scene.add(dismantleLines);

const dismantlePool = Array.from({ length: DISMANTLE_MAX }, () => ({
    active: false,
    pos: new THREE.Vector3(),
    dir: new THREE.Vector3(),
    vel: new THREE.Vector3(),
    life: 0,
    maxLife: 0,
    len: 0
}));

function updateSlashes(active, time) {
    if (!active) { slashMat.opacity = 0; return; }
    slashMat.opacity = 0.6 + Math.sin(time * 25) * 0.4; 
    const arr = slashLines.geometry.attributes.position.array;
    let idx = 0;
    for(let i=0; i<50; i++) {
        if(Math.random() > 0.08) { idx += 6; continue; } 
        const cx = (Math.random()-0.5)*30; const cy = (Math.random()-0.5)*20; const cz = (Math.random()-0.5)*10;
        const len = 5 + Math.random()*8; const ang = Math.random() * Math.PI * 2;
        arr[idx++] = cx - Math.cos(ang)*len; arr[idx++] = cy - Math.sin(ang)*len; arr[idx++] = cz;
        arr[idx++] = cx + Math.cos(ang)*len; arr[idx++] = cy + Math.sin(ang)*len; arr[idx++] = cz;
    }
    slashLines.geometry.attributes.position.needsUpdate = true;
}

let shakeLevel = 0;
const baseCam = new THREE.Vector3(0, 2, 14);

function spawnDismantleSlash() {
    let slot = dismantlePool.find((s) => !s.active);
    if (!slot) slot = dismantlePool[0];

    slot.active = true;
    slot.life = 0.32 + Math.random() * 0.12;
    slot.maxLife = slot.life;
    slot.pos.set(0, 0.8, -1.2);
    const target = new THREE.Vector3(
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 6,
        camera.position.z - 0.3
    );
    slot.dir.copy(target.sub(slot.pos).normalize());
    slot.vel.copy(slot.dir).multiplyScalar(32 + Math.random() * 20);
    slot.len = 3.5 + Math.random() * 3.5;

    shakeLevel = Math.min(shakeLevel + 0.35, 1.8);
}

function updateDismantleSlashes(dt) {
    const arr = dismantleLines.geometry.attributes.position.array;
    let idx = 0;
    let anyActive = false;

    for (const slash of dismantlePool) {
        if (slash.active) {
            anyActive = true;
            slash.life -= dt;
            if (slash.life <= 0) {
                slash.active = false;
            } else {
                slash.pos.addScaledVector(slash.vel, dt);
            }
        }

        if (slash.active) {
            const half = slash.len * 0.5;
            const sx = slash.pos.x - slash.dir.x * half;
            const sy = slash.pos.y - slash.dir.y * half;
            const sz = slash.pos.z - slash.dir.z * half;
            const ex = slash.pos.x + slash.dir.x * half;
            const ey = slash.pos.y + slash.dir.y * half;
            const ez = slash.pos.z + slash.dir.z * half;
            arr[idx++] = sx; arr[idx++] = sy; arr[idx++] = sz;
            arr[idx++] = ex; arr[idx++] = ey; arr[idx++] = ez;
        } else {
            arr[idx++] = 0; arr[idx++] = 0; arr[idx++] = 0;
            arr[idx++] = 0; arr[idx++] = 0; arr[idx++] = 0;
        }
    }

    dismantleMat.opacity = anyActive ? 0.95 : 0;
    dismantleLines.geometry.attributes.position.needsUpdate = true;
}


// ==============================================================================
// 5. ANIMATION LOOP & STATE MACHINE
// ==============================================================================
let gameState = 'WAITING'; // WAITING -> FORMING -> ACTIVE -> ABORTING
const clock = new THREE.Clock();
let animTimer = 0;

const voidColor = new THREE.Color(CONFIG.colors.voidFog);
const domainColor = new THREE.Color(CONFIG.colors.domainFog);

function animate() {
    requestAnimationFrame(animate);
    const dt = clock.getDelta();
    const time = clock.getElapsedTime();

    // --- State Logic ---
    switch(gameState) {
        case 'WAITING':
            currentFogColor.lerp(voidColor, 0.05);
            scene.fog.color.copy(currentFogColor); renderer.setClearColor(currentFogColor);
            bloomPass.strength = THREE.MathUtils.lerp(bloomPass.strength, 0, 0.1);
            bloodLake.material.opacity = 0; skulls.material.opacity = 0; pillars.material.opacity = 0;
            teeth.material.opacity = 0; roof.material.opacity = 0; aura.material.opacity = 0;
            updateSlashes(false, time);
            closeQueued = false;
            dismantleQueued = false;
            if (sensorState.isTriggered) { gameState = 'FORMING'; animTimer = 0; }
            break;

        case 'FORMING':
            animTimer += dt;
            currentFogColor.lerp(domainColor, 0.02);
            scene.fog.color.copy(currentFogColor); renderer.setClearColor(currentFogColor);
            bloomPass.strength = THREE.MathUtils.lerp(bloomPass.strength, 1.0, 0.05);

            // Phase 1: Blood Spills slowly across full formation
            const bloodProg = Math.min(animTimer / CONFIG.timing.formDuration, 1.0);
            const bloodEase = bloodProg * bloodProg * (3 - 2 * bloodProg);
            bloodLake.material.opacity = bloodProg * 0.85;
            const currentSpillRadius = bloodEase * 40; 
            const bPos = bloodLake.geometry.attributes.position.array;
            const bBase = bloodLake.geometry.attributes.basePosition.array;
            for(let i=0; i<bPos.length; i+=3) {
                const dx = bBase[i]; const dz = bBase[i+2];
                const dist = Math.sqrt(dx*dx + dz*dz);
                // Simple spill logic: raise to -4.5
                if(dist < currentSpillRadius) bPos[i+1] = -4.5; else bPos[i+1] = -10.0;
            }
            bloodLake.geometry.attributes.position.needsUpdate = true;

            // Rising Aura Fade In
            aura.material.opacity = Math.min(animTimer / 2.0, 0.7);

            // Phase 2: Skulls Rise (1.5s - 3.5s)
            if (animTimer > 1.5) {
                const prog = Math.min((animTimer - 1.5) / 2.0, 1.0);
                skulls.material.opacity = prog * 0.9; skulls.position.y = -3 * (1 - prog);
            }
             // Phase 3: Pillars Rise (2.0s - 4.0s)
             if (animTimer > 2.0) {
                const prog = Math.min((animTimer - 2.0) / 2.0, 1.0);
                pillars.material.opacity = prog * 1.0; pillars.position.y = -6 * (1 - prog);
            }
            // Phase 4: Teeth Snap (3.0s - 4.5s)
            if (animTimer > 3.0) {
                const prog = Math.min((animTimer - 3.0) / 1.5, 1.0);
                teeth.material.opacity = prog * 1.0; teeth.scale.set(1, prog, 1);
            }
            // Phase 5: Roof Descends (4.0s - 6.0s)
            if (animTimer > 4.0) {
                const prog = Math.min((animTimer - 4.0) / 2.0, 1.0);
                roof.material.opacity = prog * 0.9; roof.position.y = 7 * (1 - prog);
            }
            if (animTimer > CONFIG.timing.formDuration) gameState = 'ACTIVE';
            break;

        case 'ACTIVE':
            bloomPass.strength = 1.35 + Math.sin(time * 10) * 0.45;
            shrineGroup.rotation.y = Math.sin(time * 0.3) * 0.02; // Very slight sway
            updateSlashes(true, time);
            if (dismantleQueued) {
                spawnDismantleSlash();
                dismantleQueued = false;
            }
            if (closeQueued) {
                closeQueued = false;
                gameState = 'ABORTING';
                shakeLevel = Math.min(shakeLevel + 0.5, 2.0);
            }
            break;

        case 'ABORTING':
            animTimer -= dt * CONFIG.timing.abortSpeed;
            currentFogColor.lerp(voidColor, 0.1);
            scene.fog.color.copy(currentFogColor); renderer.setClearColor(currentFogColor);
            updateSlashes(false, time);
            bloomPass.strength = THREE.MathUtils.lerp(bloomPass.strength, 0, 0.1);
            
            bloodLake.material.opacity = Math.min(animTimer, 0.8);
            skulls.material.opacity = Math.min(animTimer, 0.9);
            pillars.material.opacity = Math.min(animTimer, 1.0);
            teeth.material.opacity = Math.min(animTimer, 1.0);
            roof.material.opacity = Math.min(animTimer, 0.9);
            aura.material.opacity = Math.min(animTimer, 0.6);
            if (animTimer <= 0) { animTimer = 0; gameState = 'WAITING'; }
            break;
    }

    // --- Gravity Particle Physics (The "Floating" effect) ---
    if (gameState !== 'WAITING') {
        const aPos = aura.geometry.attributes.position.array;
        const aBase = aura.geometry.attributes.basePosition.array;
        
        for(let i=1; i<aPos.length; i+=3) { // Y coordinates
            // Move strictly upwards
            aPos[i] += 0.04 + Math.random() * 0.03; 

            // Gravity well pull toward domain center for heavier feel
            aPos[i - 1] += (-aPos[i - 1]) * 0.0012;
            aPos[i + 1] += (-aPos[i + 1]) * 0.0012;
            
            // If particle goes too high, reset to floor
            if (aPos[i] > 8.0) {
                aPos[i] = -4.5;
            }
        }
        aura.geometry.attributes.position.needsUpdate = true;
    }

    // Update gesture-fired slashes
    updateDismantleSlashes(dt);

    // Stronger shake profile
    const baselineShake = gameState === 'ACTIVE' ? 0.06 : (gameState === 'FORMING' ? Math.min(animTimer / 6.0, 0.12) : 0);
    shakeLevel = Math.max(shakeLevel * 0.9, baselineShake);
    if (shakeLevel > 0.001) {
        camera.position.x = baseCam.x + (Math.random() - 0.5) * shakeLevel;
        camera.position.y = baseCam.y + (Math.random() - 0.5) * shakeLevel;
    } else {
        camera.position.x = baseCam.x;
        camera.position.y = baseCam.y;
    }
    camera.position.z = baseCam.z;

    composer.render();
}
animate();
