// ═══════════════════════════════════════
// 3D BRAIN VISUALIZATION ENGINE v2
// Three.js — Organic brain with 13 regions
// ═══════════════════════════════════════

import * as THREE from 'three';
import { BrainRegion } from '../engine/emotions';

export interface RegionConfig {
  id: BrainRegion;
  label: string;
  description: string;
  funFact: string;
  position: THREE.Vector3;
  size: number;
  restColor: THREE.Color;
  activeColor: THREE.Color;
  connections: BrainRegion[];
}

export const REGION_CONFIGS: Record<BrainRegion, RegionConfig> = {
  prefrontal: {
    id: 'prefrontal',
    label: 'Prefrontal Cortex',
    description: 'The seat of executive function — decision making, planning, complex thought, and impulse control. It is what makes us human.',
    funFact: 'The prefrontal cortex is not fully developed until age 25, which explains adolescent decision-making.',
    position: new THREE.Vector3(0, 1.4, 2.2),
    size: 0.55,
    restColor: new THREE.Color(0x050510),
    activeColor: new THREE.Color(0x0066ff),
    connections: ['acc', 'dmn', 'hippocampus', 'thalamus', 'broca']
  },
  amygdala: {
    id: 'amygdala',
    label: 'Amygdala',
    description: 'The brain\'s alarm system. It processes fear, anger, and emotional memory. It speaks before logic can intervene.',
    funFact: 'The amygdala can trigger a fear response in 12 milliseconds — before you are even consciously aware of a threat.',
    position: new THREE.Vector3(1.2, 0.0, 0.3),
    size: 0.28,
    restColor: new THREE.Color(0x100000),
    activeColor: new THREE.Color(0xdd0022),
    connections: ['hippocampus', 'prefrontal', 'brainstem', 'insula', 'acc']
  },
  hippocampus: {
    id: 'hippocampus',
    label: 'Hippocampus',
    description: 'The brain\'s memory architect. It forms, consolidates, and retrieves memories. It gives the past its emotional weight.',
    funFact: 'London taxi drivers have significantly larger hippocampi — it physically grows with use.',
    position: new THREE.Vector3(1.1, -0.1, 0.8),
    size: 0.32,
    restColor: new THREE.Color(0x0d0800),
    activeColor: new THREE.Color(0xffaa00),
    connections: ['amygdala', 'prefrontal', 'dmn', 'thalamus']
  },
  broca: {
    id: 'broca',
    label: 'Broca\'s Area',
    description: 'Language production. It translates thought into speech, coordinates the complex muscle movements of speaking and writing.',
    funFact: 'Discovered in 1861 by Paul Broca through a patient who could only say the word "tan."',
    position: new THREE.Vector3(1.8, 0.7, 1.5),
    size: 0.3,
    restColor: new THREE.Color(0x001010),
    activeColor: new THREE.Color(0x00ccee),
    connections: ['wernicke', 'prefrontal', 'thalamus']
  },
  wernicke: {
    id: 'wernicke',
    label: 'Wernicke\'s Area',
    description: 'Language comprehension. It decodes incoming words into meaning, connecting sound to understanding.',
    funFact: 'Damage here causes "word salad" — fluent but meaningless speech that the speaker cannot recognize as wrong.',
    position: new THREE.Vector3(1.9, 0.4, 0.8),
    size: 0.28,
    restColor: new THREE.Color(0x001010),
    activeColor: new THREE.Color(0x00bb99),
    connections: ['broca', 'thalamus', 'hippocampus']
  },
  acc: {
    id: 'acc',
    label: 'Anterior Cingulate Cortex',
    description: 'The bridge between emotion and reason. It mediates conflict, empathy, emotional regulation, and the pain of loss.',
    funFact: 'The ACC activates both when you feel pain yourself and when you watch someone you love in pain.',
    position: new THREE.Vector3(0, 1.0, 1.8),
    size: 0.3,
    restColor: new THREE.Color(0x080010),
    activeColor: new THREE.Color(0x9900ff),
    connections: ['prefrontal', 'amygdala', 'insula', 'dmn']
  },
  insula: {
    id: 'insula',
    label: 'Insula',
    description: 'The felt sense of being alive. It maps the body\'s internal state — love, disgust, gut feelings, physical sensation.',
    funFact: 'The insula may be the closest thing the brain has to a seat of subjective feeling.',
    position: new THREE.Vector3(1.6, 0.3, 1.1),
    size: 0.3,
    restColor: new THREE.Color(0x100500),
    activeColor: new THREE.Color(0xff6600),
    connections: ['acc', 'amygdala', 'nucleus_accumbens', 'thalamus']
  },
  nucleus_accumbens: {
    id: 'nucleus_accumbens',
    label: 'Nucleus Accumbens',
    description: 'The brain\'s reward center. Floods with dopamine at pleasure, joy, love, and novelty. The engine of desire.',
    funFact: 'All addictive substances and behaviors converge on this tiny structure — it is the reason we want things.',
    position: new THREE.Vector3(0.5, 0.3, 1.0),
    size: 0.22,
    restColor: new THREE.Color(0x0f0d00),
    activeColor: new THREE.Color(0xffee00),
    connections: ['amygdala', 'prefrontal', 'insula', 'acc']
  },
  dmn: {
    id: 'dmn',
    label: 'Default Mode Network',
    description: 'The self-referential network. Active during daydreaming, self-reflection, and imagining the future. It is your inner narrator.',
    funFact: 'The DMN is overactive in depression — the mind that cannot stop thinking about itself.',
    position: new THREE.Vector3(0, 0.5, -0.5),
    size: 0.45,
    restColor: new THREE.Color(0x080808),
    activeColor: new THREE.Color(0xcccccc),
    connections: ['prefrontal', 'hippocampus', 'acc', 'thalamus']
  },
  cerebellum: {
    id: 'cerebellum',
    label: 'Cerebellum',
    description: 'Coordination, rhythm, and the flow state. It fine-tunes movement, timing, and the elegant automation of skill.',
    funFact: 'The cerebellum contains more neurons than the rest of the brain combined.',
    position: new THREE.Vector3(0, -1.4, -1.8),
    size: 0.55,
    restColor: new THREE.Color(0x001000),
    activeColor: new THREE.Color(0x00dd44),
    connections: ['brainstem', 'thalamus']
  },
  visual_cortex: {
    id: 'visual_cortex',
    label: 'Visual Cortex',
    description: 'Processes sight, imagery, and visualization. In psychedelic states, it generates visuals without external input.',
    funFact: 'The visual cortex takes up more space than any other sensory system — humans are vision-dominant creatures.',
    position: new THREE.Vector3(0, 0.2, -2.2),
    size: 0.45,
    restColor: new THREE.Color(0x080012),
    activeColor: new THREE.Color(0xbb00ff),
    connections: ['thalamus', 'dmn']
  },
  thalamus: {
    id: 'thalamus',
    label: 'Thalamus',
    description: 'The gatekeeper of consciousness. Routes all sensory information to the cortex. Dimming it is how sleep begins.',
    funFact: 'Thalamic strokes can produce coma. Every conscious sensation you have passed through here.',
    position: new THREE.Vector3(0, 0.2, 0.4),
    size: 0.35,
    restColor: new THREE.Color(0x080808),
    activeColor: new THREE.Color(0xffffff),
    connections: ['prefrontal', 'amygdala', 'hippocampus', 'visual_cortex', 'insula', 'cerebellum']
  },
  brainstem: {
    id: 'brainstem',
    label: 'Brainstem',
    description: 'The ancient core. Controls breathing, heart rate, the fight-or-flight cascade. It predates thought by millions of years.',
    funFact: 'The brainstem is the only part of the brain that cannot be replaced — it is where life itself is regulated.',
    position: new THREE.Vector3(0, -0.9, -0.4),
    size: 0.3,
    restColor: new THREE.Color(0x0d0000),
    activeColor: new THREE.Color(0x880000),
    connections: ['amygdala', 'thalamus', 'cerebellum']
  }
};

interface ArcData {
  from: BrainRegion;
  to: BrainRegion;
  strength: number;
  line: THREE.Line | null;
  active: boolean;
  phase: number;
}

export class BrainVisualization {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private regionMeshes: Map<BrainRegion, THREE.Mesh> = new Map();
  private regionGlows: Map<BrainRegion, THREE.Mesh> = new Map();
  private regionCores: Map<BrainRegion, THREE.Mesh> = new Map(); // bright inner core
  private activationLevels: Map<BrainRegion, number> = new Map();
  private targetActivations: Map<BrainRegion, number> = new Map();
  private arcPool: ArcData[] = [];
  private brainGroup: THREE.Group;
  private cortexMesh!: THREE.Mesh;
  private neuralArcsGroup: THREE.Group;
  private clock: THREE.Clock;
  private animationId: number | null = null;
  private onRegionClick: (region: BrainRegion) => void;
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2 = new THREE.Vector2();
  private rotationEnabled: boolean = true;
  private baseRotationY: number = 0;
  private breathPhase: number = 0;
  private trustGlow: number = 0;
  private griefIntensity: number = 0;
  private labels: Map<BrainRegion, HTMLDivElement> = new Map();
  private labelsVisible: boolean = false;
  private container: HTMLElement;
  private ambientParticles!: THREE.Points;
  private neuralSparks: THREE.Points[] = [];
  private pointLights: THREE.PointLight[] = [];
  private mouseTarget = new THREE.Vector2();
  private mouseCurrent = new THREE.Vector2();
  private isDragging = false;
  private lastMouseX = 0;
  private dragDelta = 0;

  constructor(container: HTMLElement, onRegionClick: (region: BrainRegion) => void) {
    this.container = container;
    this.onRegionClick = onRegionClick;
    this.clock = new THREE.Clock();
    this.raycaster = new THREE.Raycaster();

    // Scene setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x020408);
    this.scene.fog = new THREE.FogExp2(0x020408, 0.055);

    // Camera
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 100);
    this.camera.position.set(0, 0.8, 8);
    this.camera.lookAt(0, 0, 0);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance'
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.4;
    container.appendChild(this.renderer.domElement);

    // Groups
    this.brainGroup = new THREE.Group();
    this.scene.add(this.brainGroup);
    this.neuralArcsGroup = new THREE.Group();
    this.scene.add(this.neuralArcsGroup);

    // Build everything
    this.setupLighting();
    this.buildCortexShell();
    this.buildBrainRegions();
    this.buildParticleField();
    this.buildArcPool();
    this.setupEvents(container);

    // Init activations
    for (const region of Object.keys(REGION_CONFIGS) as BrainRegion[]) {
      this.activationLevels.set(region, 0);
      this.targetActivations.set(region, 0);
    }
  }

  private setupLighting() {
    // Very dark ambient
    this.scene.add(new THREE.AmbientLight(0x040408, 3));

    // Main atmospheric lights
    const colors = [
      { color: 0x2244aa, pos: [5, 4, 6], intensity: 2 },
      { color: 0x110022, pos: [-5, -2, -4], intensity: 1.5 },
      { color: 0x002211, pos: [0, -4, 3], intensity: 1 },
      { color: 0x221100, pos: [3, 2, -5], intensity: 1 },
    ];

    for (const c of colors) {
      const light = new THREE.PointLight(c.color, c.intensity, 20);
      light.position.set(...c.pos as [number, number, number]);
      this.scene.add(light);
    }

    // Dynamic region point lights (will follow activations)
    for (let i = 0; i < 4; i++) {
      const pl = new THREE.PointLight(0x0000ff, 0, 8);
      this.scene.add(pl);
      this.pointLights.push(pl);
    }
  }

  private buildCortexShell() {
    // Organic brain outer shape using icosahedron + displacement
    const geo = new THREE.IcosahedronGeometry(2.8, 4);
    // Displace vertices for organic brain shape
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);

      // Squash into brain shape: wider sideways, shorter vertically at front
      const xFactor = 1.15;
      const yFactor = 0.85;
      const zFactor = z > 0 ? 1.1 : 0.9; // longer toward front

      // Add cortical folding noise
      const noise = 0.12 * Math.sin(x * 3.7 + y * 2.1) * Math.cos(z * 2.9 + x * 1.8);
      const r = Math.sqrt(x * x + y * y + z * z);
      const scale = (1 + noise) / r;

      pos.setXYZ(i, x * xFactor * scale * r, y * yFactor * scale * r, z * zFactor * scale * r);
    }
    geo.computeVertexNormals();

    const mat = new THREE.MeshPhongMaterial({
      color: 0x060a14,
      emissive: 0x010208,
      emissiveIntensity: 1,
      transparent: true,
      opacity: 0.15,
      side: THREE.BackSide,
      shininess: 10,
      specular: new THREE.Color(0x112244)
    });

    this.cortexMesh = new THREE.Mesh(geo, mat);
    this.brainGroup.add(this.cortexMesh);

    // Outer glow shell
    const outerGeo = geo.clone();
    const outerPts = outerGeo.attributes.position;
    for (let i = 0; i < outerPts.count; i++) {
      const x = outerPts.getX(i);
      const y = outerPts.getY(i);
      const z = outerPts.getZ(i);
      outerPts.setXYZ(i, x * 1.04, y * 1.04, z * 1.04);
    }

    const outerMat = new THREE.MeshBasicMaterial({
      color: 0x0a0f22,
      transparent: true,
      opacity: 0.08,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const outerMesh = new THREE.Mesh(outerGeo, outerMat);
    this.brainGroup.add(outerMesh);

    // Wireframe for neural network feel
    const wireGeo = new THREE.IcosahedronGeometry(2.85, 2);
    const wireMat = new THREE.MeshBasicMaterial({
      color: 0x0a1428,
      wireframe: true,
      transparent: true,
      opacity: 0.04,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this.brainGroup.add(new THREE.Mesh(wireGeo, wireMat));
  }

  private buildBrainRegions() {
    for (const [regionId, config] of Object.entries(REGION_CONFIGS)) {
      const rid = regionId as BrainRegion;

      // Outer glow halo
      const glowGeo = new THREE.SphereGeometry(config.size * 2.5, 12, 12);
      const glowMat = new THREE.MeshBasicMaterial({
        color: config.activeColor,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.BackSide
      });
      const glow = new THREE.Mesh(glowGeo, glowMat);
      glow.position.copy(config.position);
      this.brainGroup.add(glow);
      this.regionGlows.set(rid, glow);

      // Main region sphere — organic shape
      const geo = new THREE.IcosahedronGeometry(config.size, 2);
      // Distort slightly for organic look
      const pts = geo.attributes.position;
      for (let i = 0; i < pts.count; i++) {
        const x = pts.getX(i), y = pts.getY(i), z = pts.getZ(i);
        const jitter = 0.06;
        pts.setXYZ(i,
          x + (Math.random() - 0.5) * jitter,
          y + (Math.random() - 0.5) * jitter,
          z + (Math.random() - 0.5) * jitter
        );
      }
      geo.computeVertexNormals();

      const mat = new THREE.MeshPhongMaterial({
        color: config.restColor,
        emissive: config.restColor.clone().multiplyScalar(2),
        emissiveIntensity: 0.8,
        transparent: true,
        opacity: 0.9,
        shininess: 120,
        specular: new THREE.Color(0x224466)
      });

      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(config.position);
      mesh.userData = { regionId: rid };
      this.brainGroup.add(mesh);
      this.regionMeshes.set(rid, mesh);

      // Bright inner core
      const coreGeo = new THREE.SphereGeometry(config.size * 0.4, 8, 8);
      const coreMat = new THREE.MeshBasicMaterial({
        color: config.activeColor,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const core = new THREE.Mesh(coreGeo, coreMat);
      core.position.copy(config.position);
      this.brainGroup.add(core);
      this.regionCores.set(rid, core);
    }
  }

  private buildArcPool() {
    for (const [regionId, config] of Object.entries(REGION_CONFIGS)) {
      for (const connId of config.connections) {
        const existing = this.arcPool.find(a =>
          (a.from === regionId && a.to === connId) ||
          (a.from === connId && a.to === regionId as BrainRegion)
        );
        if (!existing) {
          this.arcPool.push({
            from: regionId as BrainRegion,
            to: connId,
            strength: 0,
            line: null,
            active: false,
            phase: Math.random() * Math.PI * 2
          });
        }
      }
    }
  }

  private buildParticleField() {
    // Dense neural particle cloud
    const count = 1200;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      // Distribute in brain-shaped volume
      const r = 1.5 + Math.random() * 4.5;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.75;
      positions[i * 3 + 2] = r * Math.cos(phi);

      const b = 0.02 + Math.random() * 0.08;
      colors[i * 3] = b * 0.3;
      colors[i * 3 + 1] = b * 0.5;
      colors[i * 3 + 2] = b;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.04,
      vertexColors: true,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
      depthWrite: false
    });

    this.ambientParticles = new THREE.Points(geo, mat);
    this.scene.add(this.ambientParticles);
  }

  private createArcLine(from: THREE.Vector3, to: THREE.Vector3, color: THREE.Color): THREE.Line {
    const mid = new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5);
    const dist = from.distanceTo(to);
    const offset = new THREE.Vector3(
      (Math.random() - 0.5) * 0.5,
      dist * (0.2 + Math.random() * 0.3),
      (Math.random() - 0.5) * 0.5
    );
    mid.add(offset);

    const curve = new THREE.QuadraticBezierCurve3(from, mid, to);
    const points = curve.getPoints(40);
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    return new THREE.Line(geo, mat);
  }

  public setActivations(activations: Array<{ region: BrainRegion; level: number }>) {
    for (const [r] of this.targetActivations) {
      this.targetActivations.set(r, 0);
    }
    for (const { region, level } of activations) {
      this.targetActivations.set(region, Math.max(0, Math.min(1, level)));
    }
    this.updateNeuralArcs(activations);
  }

  private updateNeuralArcs(activations: Array<{ region: BrainRegion; level: number }>) {
    while (this.neuralArcsGroup.children.length > 0) {
      const child = this.neuralArcsGroup.children[0];
      this.neuralArcsGroup.remove(child);
    }

    const activeMap = new Map<BrainRegion, number>();
    for (const { region, level } of activations) {
      if (level > 0.25) activeMap.set(region, level);
    }

    for (const arc of this.arcPool) {
      const levelA = activeMap.get(arc.from) ?? 0;
      const levelB = activeMap.get(arc.to) ?? 0;
      const strength = Math.sqrt(levelA * levelB);
      arc.strength = strength;

      if (strength > 0.15) {
        const fromPos = REGION_CONFIGS[arc.from].position;
        const toPos = REGION_CONFIGS[arc.to].position;
        const colorA = REGION_CONFIGS[arc.from].activeColor;
        const colorB = REGION_CONFIGS[arc.to].activeColor;
        const blendColor = colorA.clone().lerp(colorB, 0.5);

        const line = this.createArcLine(fromPos, toPos, blendColor);
        arc.line = line;
        arc.active = true;
        arc.phase = Math.random() * Math.PI * 2;
        this.neuralArcsGroup.add(line);
      } else {
        arc.active = false;
        arc.line = null;
      }
    }
  }

  public setTrustGlow(trustScore: number) {
    this.trustGlow = trustScore;
  }

  public setGriefIntensity(grief: number) {
    this.griefIntensity = grief;
  }

  public toggleLabels(visible: boolean) {
    this.labelsVisible = visible;
    for (const label of this.labels.values()) {
      label.style.display = visible ? 'block' : 'none';
    }
  }

  private updateRegionVisuals(elapsed: number, delta: number) {
    const lerpSpeed = 2.5 * delta;
    let lightIdx = 0;

    for (const [regionId, mesh] of this.regionMeshes) {
      const config = REGION_CONFIGS[regionId];
      const target = this.targetActivations.get(regionId) ?? 0;
      const current = this.activationLevels.get(regionId) ?? 0;

      const newLevel = current + (target - current) * Math.min(1, lerpSpeed);
      this.activationLevels.set(regionId, newLevel);

      const mat = mesh.material as THREE.MeshPhongMaterial;
      const glow = this.regionGlows.get(regionId)!;
      const glowMat = glow.material as THREE.MeshBasicMaterial;
      const core = this.regionCores.get(regionId)!;
      const coreMat = core.material as THREE.MeshBasicMaterial;

      const restBase = this.trustGlow * 0.08;

      if (newLevel > 0.01) {
        // Active region
        const activeCol = config.activeColor;
        mat.color.lerpColors(config.restColor, activeCol, newLevel);
        mat.emissive.lerpColors(config.restColor, activeCol, newLevel);
        mat.emissiveIntensity = 1.5 + newLevel * 4;

        // Glow halo
        glowMat.color.copy(activeCol);
        glowMat.opacity = newLevel * 0.25 + 0.02;

        // Core spark
        coreMat.color.copy(activeCol);
        coreMat.opacity = newLevel * 0.8;

        // Pulse scale
        const pulseFreq = 5 + newLevel * 8;
        const pulseAmt = newLevel * 0.08;
        const pulseScale = 1 + pulseAmt * Math.sin(elapsed * pulseFreq + mesh.position.x * 3);
        mesh.scale.setScalar(pulseScale);
        glow.scale.setScalar(pulseScale * 1.2);

        // Drive dynamic lights
        if (lightIdx < this.pointLights.length && newLevel > 0.5) {
          const pl = this.pointLights[lightIdx++];
          pl.color.copy(activeCol);
          pl.intensity = newLevel * 3;
          pl.position.copy(config.position).applyMatrix4(this.brainGroup.matrixWorld);
        }
      } else {
        // Resting — subtle ember
        const emberIntensity = restBase + 0.1;
        mat.color.lerpColors(new THREE.Color(0x000000), config.restColor, emberIntensity);
        mat.emissive.copy(config.restColor);
        mat.emissiveIntensity = 0.3 + restBase * 2;

        glowMat.opacity = restBase * 0.15;
        coreMat.opacity = 0;
        mesh.scale.setScalar(1 + 0.005 * Math.sin(elapsed * 0.3));
      }
    }

    // Turn off unused lights
    for (; lightIdx < this.pointLights.length; lightIdx++) {
      this.pointLights[lightIdx].intensity *= 0.9;
    }
  }

  private updateArcAnimations(elapsed: number) {
    for (const arc of this.arcPool) {
      if (!arc.active || !arc.line) continue;
      const mat = arc.line.material as THREE.LineBasicMaterial;
      // Traveling pulse along arc
      const speed = 1.5 + arc.strength * 3;
      const wave = 0.3 + 0.7 * Math.abs(Math.sin(elapsed * speed + arc.phase));
      mat.opacity = arc.strength * 0.55 * wave;
    }
  }

  private updateParticles(elapsed: number) {
    this.ambientParticles.rotation.y = elapsed * 0.015;
    this.ambientParticles.rotation.x = Math.sin(elapsed * 0.008) * 0.04;

    const mat = this.ambientParticles.material as THREE.PointsMaterial;
    // Increase particle brightness with trust
    const baseOpacity = 0.5 + this.trustGlow * 0.3;
    mat.opacity = baseOpacity;
  }

  public animate() {
    this.animationId = requestAnimationFrame(() => this.animate());
    const delta = Math.min(0.05, this.clock.getDelta());
    const elapsed = this.clock.getElapsedTime();

    // Smooth mouse-driven rotation
    this.mouseCurrent.x += (this.mouseTarget.x - this.mouseCurrent.x) * 0.05;
    this.mouseCurrent.y += (this.mouseTarget.y - this.mouseCurrent.y) * 0.05;

    // Auto rotation + drag
    if (!this.isDragging && this.rotationEnabled) {
      this.baseRotationY += delta * 0.1;
    }
    this.brainGroup.rotation.y = this.baseRotationY + this.mouseCurrent.x * 0.3;

    // Breathing
    this.breathPhase += delta * 0.3 * Math.PI * 2;
    const breathScale = 1 + 0.012 * Math.sin(this.breathPhase);
    const griefFactor = 1 - this.griefIntensity * 0.04;
    this.brainGroup.scale.setScalar(breathScale * griefFactor);

    // Subtle tilt from mouse
    this.brainGroup.rotation.x = this.mouseCurrent.y * 0.2 + Math.sin(elapsed * 0.1) * 0.02;

    // Grief effect
    this.renderer.toneMappingExposure = 1.4 - this.griefIntensity * 0.4;

    this.updateRegionVisuals(elapsed, delta);
    this.updateArcAnimations(elapsed);
    this.updateParticles(elapsed);
    this.updateLabelsPosition();

    this.renderer.render(this.scene, this.camera);
  }

  private updateLabelsPosition() {
    if (!this.labelsVisible) return;
    for (const [regionId, label] of this.labels) {
      const config = REGION_CONFIGS[regionId];
      const pos = config.position.clone();
      // Apply brain group transforms
      pos.applyMatrix4(this.brainGroup.matrixWorld);
      const projected = pos.project(this.camera);
      if (projected.z > 1) { label.style.display = 'none'; continue; }
      const x = (projected.x * 0.5 + 0.5) * this.container.clientWidth;
      const y = (-projected.y * 0.5 + 0.5) * this.container.clientHeight;
      const activation = this.activationLevels.get(regionId) ?? 0;
      label.style.display = 'block';
      label.style.left = `${x}px`;
      label.style.top = `${y}px`;
      label.style.opacity = `${0.3 + activation * 0.7}`;
      const col = `#${REGION_CONFIGS[regionId].activeColor.getHexString()}`;
      label.style.color = activation > 0.2 ? col : '#5566aa';
    }
  }

  public createLabels(container: HTMLElement) {
    for (const [regionId, config] of Object.entries(REGION_CONFIGS)) {
      const div = document.createElement('div');
      div.className = 'brain-label';
      div.textContent = config.label;
      div.style.cssText = `
        position: absolute; pointer-events: none;
        transform: translate(-50%, -50%);
        font-size: 9px; font-family: 'Space Mono', monospace;
        color: #334466;
        text-shadow: 0 0 8px rgba(100,120,255,0.5);
        display: none; white-space: nowrap;
        letter-spacing: 0.08em; text-transform: uppercase;
        transition: color 0.3s, opacity 0.3s;
      `;
      container.appendChild(div);
      this.labels.set(regionId as BrainRegion, div);
    }
  }

  private setupEvents(container: HTMLElement) {
    container.addEventListener('mousemove', (e) => {
      const rect = container.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      this.mouse.set(nx, ny);
      this.mouseTarget.set(nx, ny);

      if (this.isDragging) {
        const dx = e.clientX - this.lastMouseX;
        this.baseRotationY += dx * 0.008;
        this.lastMouseX = e.clientX;
      }
    });

    container.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.lastMouseX = e.clientX;
      this.rotationEnabled = false;
    });

    container.addEventListener('mouseup', (e) => {
      this.isDragging = false;
      // Check for click on region
      if (Math.abs(this.dragDelta) < 3) {
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const meshes = Array.from(this.regionMeshes.values());
        const intersects = this.raycaster.intersectObjects(meshes, false);
        if (intersects.length > 0) {
          const regionId = intersects[0].object.userData.regionId as BrainRegion;
          this.onRegionClick(regionId);
        }
      }
      this.dragDelta = 0;
      // Resume rotation after 4 seconds
      setTimeout(() => { this.rotationEnabled = true; }, 4000);
    });

    container.addEventListener('mouseleave', () => {
      this.isDragging = false;
      this.dragDelta = 0;
    });

    // Touch support
    container.addEventListener('touchstart', (e) => {
      this.lastMouseX = e.touches[0].clientX;
      this.isDragging = true;
      this.rotationEnabled = false;
    }, { passive: true });

    container.addEventListener('touchmove', (e) => {
      const dx = e.touches[0].clientX - this.lastMouseX;
      this.baseRotationY += dx * 0.008;
      this.lastMouseX = e.touches[0].clientX;
    }, { passive: true });

    container.addEventListener('touchend', () => {
      this.isDragging = false;
      setTimeout(() => { this.rotationEnabled = true; }, 4000);
    });

    window.addEventListener('resize', () => {
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    });
  }

  public flashLifeReview() {
    const cascade: BrainRegion[] = ['hippocampus', 'amygdala', 'dmn', 'prefrontal', 'visual_cortex', 'thalamus', 'acc', 'insula'];
    let delay = 0;
    for (const region of cascade) {
      setTimeout(() => {
        const prev = this.targetActivations.get(region) ?? 0;
        this.targetActivations.set(region, Math.min(1, prev + 0.8));
        setTimeout(() => {
          this.targetActivations.set(region, prev);
        }, 1200);
      }, delay);
      delay += 120;
    }
  }

  public dispose() {
    if (this.animationId !== null) cancelAnimationFrame(this.animationId);
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
    for (const label of this.labels.values()) label.remove();
  }
}
