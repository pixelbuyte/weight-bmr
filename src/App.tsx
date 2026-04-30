import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import * as THREE from 'three';

type Gender = 'male' | 'female';
type UnitSystem = 'metric' | 'imperial';
type ActivityKey = 'sedentary' | 'light' | 'moderate' | 'very' | 'athlete';
type BmiCategory = 'slim' | 'athletic' | 'average' | 'heavier';

const activityLevels: Array<{
  key: ActivityKey;
  label: string;
  detail: string;
  factor: number;
  glow: string;
}> = [
  {
    key: 'sedentary',
    label: 'Sedentary',
    detail: 'Little to no exercise',
    factor: 1.2,
    glow: 'Low muscle activation',
  },
  {
    key: 'light',
    label: 'Lightly active',
    detail: 'Training 1-3 days/week',
    factor: 1.375,
    glow: 'Core and posture zones',
  },
  {
    key: 'moderate',
    label: 'Moderately active',
    detail: 'Training 3-5 days/week',
    factor: 1.55,
    glow: 'Balanced full-body output',
  },
  {
    key: 'very',
    label: 'Very active',
    detail: 'Training 6-7 days/week',
    factor: 1.725,
    glow: 'High metabolic demand',
  },
  {
    key: 'athlete',
    label: 'Athlete',
    detail: 'Intense training daily',
    factor: 1.725,
    glow: 'Peak performance profile',
  },
];

const initialState = {
  heightCm: 178,
  weightKg: 78,
  age: 32,
  gender: 'male' as Gender,
  unitSystem: 'metric' as UnitSystem,
  activity: 'moderate' as ActivityKey,
  keto: true,
};

const round = (value: number) => Math.round(value);
const kgToLb = (kg: number) => kg * 2.2046226218;
const lbToKg = (lb: number) => lb / 2.2046226218;
const cmToIn = (cm: number) => cm / 2.54;
const inToCm = (inch: number) => inch * 2.54;

function getBmiCategory(bmi: number): BmiCategory {
  if (bmi < 18.5) return 'slim';
  if (bmi < 25) return 'athletic';
  if (bmi < 30) return 'average';
  return 'heavier';
}

function calculateBmr(weightKg: number, heightCm: number, age: number, gender: Gender) {
  const maleBmr = 88.362 + 13.397 * weightKg + 4.799 * heightCm - 5.677 * age;
  const femaleAdjustment = 166;

  return gender === 'male' ? maleBmr : maleBmr - femaleAdjustment;
}

function formatNumber(value: number, suffix = '') {
  return `${Math.round(value).toLocaleString()}${suffix}`;
}

function AvatarCanvas({
  bmi,
  category,
  activityFactor,
  gender,
}: {
  bmi: number;
  category: BmiCategory;
  activityFactor: number;
  gender: Gender;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const muscleRefs = useRef<THREE.Mesh[]>([]);
  const morphPartsRef = useRef<{
    chest: THREE.Mesh;
    abdomen: THREE.Mesh;
    hipBlock: THREE.Mesh;
    figure: THREE.Group;
  } | null>(null);
  const targetMorphRef = useRef({ shoulder: 1, waist: 1, hip: 1, height: 1 });
  const currentMorphRef = useRef({ shoulder: 1, waist: 1, hip: 1, height: 1 });
  const activityIntensityRef = useRef(0.5);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, host.clientWidth / host.clientHeight, 0.1, 100);
    camera.position.set(0, 0.7, 7.4);
    camera.lookAt(0, 0.2, 0);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(host.clientWidth, host.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    host.appendChild(renderer.domElement);

    const hemiLight = new THREE.HemisphereLight(0x9bdcff, 0x05101e, 0.85);
    const keyLight = new THREE.DirectionalLight(0xa3e8ff, 1.1);
    keyLight.position.set(4, 6, 5);
    const rimLight = new THREE.PointLight(0x2563eb, 22, 18, 1.6);
    rimLight.position.set(-4.5, 2.5, -3);
    const fillLight = new THREE.PointLight(0x22d3ee, 8, 14, 1.8);
    fillLight.position.set(2.5, -1.5, 4);
    scene.add(hemiLight, keyLight, rimLight, fillLight);

    const skinMaterial = new THREE.MeshStandardMaterial({
      color: 0x0f2240,
      roughness: 0.42,
      metalness: 0.32,
      emissive: 0x06111f,
      emissiveIntensity: 0.55,
    });
    const trimMaterial = new THREE.MeshStandardMaterial({
      color: 0x67e8f9,
      roughness: 0.2,
      metalness: 0.55,
      emissive: 0x0891b2,
      emissiveIntensity: 1.6,
      transparent: true,
      opacity: 0.92,
    });
    const muscleMaterialBase = new THREE.MeshStandardMaterial({
      color: 0x67e8f9,
      roughness: 0.18,
      metalness: 0.15,
      emissive: 0x0891b2,
      emissiveIntensity: 1.2,
      transparent: true,
      opacity: 0.85,
    });

    const disposables: { geometry: THREE.BufferGeometry; material: THREE.Material | THREE.Material[] }[] = [];
    const trackMesh = <T extends THREE.Mesh>(mesh: T) => {
      disposables.push({ geometry: mesh.geometry, material: mesh.material });
      return mesh;
    };

    const figure = new THREE.Group();

    const hips = new THREE.Group();
    figure.add(hips);

    const hipBlock = trackMesh(
      new THREE.Mesh(new THREE.CapsuleGeometry(0.5, 0.16, 16, 32), skinMaterial),
    );
    hipBlock.position.y = -0.15;
    hipBlock.scale.set(1.05, 1, 0.85);
    hips.add(hipBlock);

    const torso = new THREE.Group();
    torso.position.y = 0.05;
    hips.add(torso);

    const abdomen = trackMesh(
      new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.36, 16, 32), skinMaterial),
    );
    abdomen.position.y = 0.3;
    abdomen.scale.set(1, 1, 0.78);
    torso.add(abdomen);

    const chest = trackMesh(
      new THREE.Mesh(new THREE.CapsuleGeometry(0.56, 0.5, 18, 36), skinMaterial),
    );
    chest.position.y = 0.92;
    chest.scale.set(1, 1, 0.78);
    torso.add(chest);

    const upperBody = new THREE.Group();
    upperBody.position.y = 1.18;
    torso.add(upperBody);

    const shoulderL = trackMesh(
      new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 24), skinMaterial),
    );
    shoulderL.position.set(-0.62, 0, 0);
    upperBody.add(shoulderL);
    const shoulderR = trackMesh(
      new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 24), skinMaterial),
    );
    shoulderR.position.set(0.62, 0, 0);
    upperBody.add(shoulderR);

    const neck = trackMesh(
      new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.18, 12, 24), skinMaterial),
    );
    neck.position.y = 0.18;
    upperBody.add(neck);

    const head = trackMesh(
      new THREE.Mesh(new THREE.SphereGeometry(0.32, 36, 36), skinMaterial),
    );
    head.position.y = 0.55;
    head.scale.set(0.92, 1, 0.92);
    upperBody.add(head);

    const buildArm = (side: -1 | 1) => {
      const armGroup = new THREE.Group();
      armGroup.position.set(0.62 * side, 0, 0);
      armGroup.rotation.z = -0.18 * side;
      upperBody.add(armGroup);

      const upperArm = trackMesh(
        new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.6, 14, 24), skinMaterial),
      );
      upperArm.position.y = -0.42;
      armGroup.add(upperArm);

      const elbow = trackMesh(
        new THREE.Mesh(new THREE.SphereGeometry(0.14, 18, 18), skinMaterial),
      );
      elbow.position.y = -0.84;
      armGroup.add(elbow);

      const forearm = trackMesh(
        new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.58, 14, 24), skinMaterial),
      );
      forearm.position.y = -1.22;
      armGroup.add(forearm);

      const hand = trackMesh(
        new THREE.Mesh(new THREE.SphereGeometry(0.13, 18, 18), skinMaterial),
      );
      hand.position.y = -1.6;
      hand.scale.set(0.85, 1.1, 0.65);
      armGroup.add(hand);
    };
    buildArm(-1);
    buildArm(1);

    const buildLeg = (side: -1 | 1) => {
      const legGroup = new THREE.Group();
      legGroup.position.set(0.26 * side, -0.32, 0);
      hips.add(legGroup);

      const thigh = trackMesh(
        new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.7, 16, 28), skinMaterial),
      );
      thigh.position.y = -0.5;
      legGroup.add(thigh);

      const knee = trackMesh(
        new THREE.Mesh(new THREE.SphereGeometry(0.2, 18, 18), skinMaterial),
      );
      knee.position.y = -0.96;
      legGroup.add(knee);

      const calf = trackMesh(
        new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.66, 16, 28), skinMaterial),
      );
      calf.position.y = -1.4;
      legGroup.add(calf);

      const foot = trackMesh(
        new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.14, 0.5), skinMaterial),
      );
      foot.position.set(0, -1.86, 0.08);
      legGroup.add(foot);
    };
    buildLeg(-1);
    buildLeg(1);

    const beltLine = trackMesh(
      new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.025, 12, 64), trimMaterial),
    );
    beltLine.position.y = 0.55;
    beltLine.rotation.x = Math.PI / 2;
    beltLine.scale.set(1, 0.78, 1);
    torso.add(beltLine);

    const collarLine = trackMesh(
      new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.022, 10, 48, Math.PI), trimMaterial),
    );
    collarLine.position.y = 1.16;
    collarLine.rotation.x = Math.PI / 2;
    torso.add(collarLine);

    const muscleZones: Array<{
      position: [number, number, number];
      scale: [number, number, number];
      parent: THREE.Object3D;
    }> = [
      { position: [-0.27, 0.95, 0.42], scale: [0.22, 0.22, 0.05], parent: torso },
      { position: [0.27, 0.95, 0.42], scale: [0.22, 0.22, 0.05], parent: torso },
      { position: [0, 0.4, 0.32], scale: [0.18, 0.34, 0.05], parent: torso },
      { position: [-0.34, -0.5, 0.18], scale: [0.18, 0.32, 0.05], parent: hips },
      { position: [0.34, -0.5, 0.18], scale: [0.18, 0.32, 0.05], parent: hips },
      { position: [-0.66, -0.42, 0.06], scale: [0.12, 0.16, 0.05], parent: upperBody },
      { position: [0.66, -0.42, 0.06], scale: [0.12, 0.16, 0.05], parent: upperBody },
    ];

    muscleRefs.current = muscleZones.map(({ position, scale, parent }) => {
      const mat = muscleMaterialBase.clone();
      const zone = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 20), mat);
      zone.position.set(...position);
      zone.scale.set(...scale);
      parent.add(zone);
      disposables.push({ geometry: zone.geometry, material: mat });
      return zone;
    });

    const outerRing = trackMesh(
      new THREE.Mesh(
        new THREE.TorusGeometry(1.45, 0.018, 16, 120),
        new THREE.MeshBasicMaterial({ color: 0x0891b2, transparent: true, opacity: 0.78 }),
      ),
    );
    outerRing.position.y = -2.1;
    outerRing.rotation.x = Math.PI / 2;
    figure.add(outerRing);

    const innerRing = trackMesh(
      new THREE.Mesh(
        new THREE.TorusGeometry(1.05, 0.012, 12, 90),
        new THREE.MeshBasicMaterial({ color: 0x67e8f9, transparent: true, opacity: 0.5 }),
      ),
    );
    innerRing.position.y = -2.08;
    innerRing.rotation.x = Math.PI / 2;
    figure.add(innerRing);

    const floorDisc = trackMesh(
      new THREE.Mesh(
        new THREE.CircleGeometry(1.4, 64),
        new THREE.MeshBasicMaterial({ color: 0x07111f, transparent: true, opacity: 0.7 }),
      ),
    );
    floorDisc.position.y = -2.11;
    floorDisc.rotation.x = -Math.PI / 2;
    figure.add(floorDisc);

    const particleGroup = new THREE.Group();
    figure.add(particleGroup);
    const particleGeom = new THREE.SphereGeometry(0.022, 8, 8);
    const particles: Array<{ mesh: THREE.Mesh; radius: number; speed: number; offset: number; y: number }> = [];
    for (let i = 0; i < 28; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? 0x67e8f9 : 0x60a5fa,
        transparent: true,
        opacity: 0.55,
      });
      const mesh = new THREE.Mesh(particleGeom, mat);
      const radius = 1.55 + Math.random() * 0.7;
      const speed = 0.35 + Math.random() * 0.55;
      const offset = Math.random() * Math.PI * 2;
      const y = -1.6 + Math.random() * 3.6;
      mesh.position.set(Math.cos(offset) * radius, y, Math.sin(offset) * radius);
      particleGroup.add(mesh);
      particles.push({ mesh, radius, speed, offset, y });
      disposables.push({ geometry: particleGeom, material: mat });
    }

    figure.position.y = 0.4;
    scene.add(figure);
    morphPartsRef.current = { chest, abdomen, hipBlock, figure };

    const clock = new THREE.Clock();
    let baseRotation = 0;
    let animationId = 0;

    const render = () => {
      animationId = window.requestAnimationFrame(render);
      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.getElapsedTime();

      baseRotation += dt * 0.32;
      figure.rotation.y = baseRotation + Math.sin(t * 0.6) * 0.08;

      const breath = 1 + Math.sin(t * 1.2) * 0.014;
      torso.scale.set(breath, 1, breath);

      upperBody.rotation.z = Math.sin(t * 0.8) * 0.02;
      head.rotation.y = Math.sin(t * 0.5) * 0.08;

      const cur = currentMorphRef.current;
      const tgt = targetMorphRef.current;
      const lerp = 1 - Math.pow(0.0008, dt);
      cur.shoulder += (tgt.shoulder - cur.shoulder) * lerp;
      cur.waist += (tgt.waist - cur.waist) * lerp;
      cur.hip += (tgt.hip - cur.hip) * lerp;
      cur.height += (tgt.height - cur.height) * lerp;
      chest.scale.set(cur.shoulder, 1, cur.shoulder * 0.78);
      abdomen.scale.set(cur.waist, 1, cur.waist * 0.78);
      hipBlock.scale.set(cur.hip * 1.05, 1, cur.hip * 0.85);
      figure.scale.y = cur.height;

      const intensity = activityIntensityRef.current;
      const pulse = 0.85 + Math.sin(t * 2.2) * 0.15;
      muscleRefs.current.forEach((zone, i) => {
        const mat = zone.material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity = intensity * pulse * (1 + i * 0.04);
        mat.opacity = 0.55 + intensity * 0.4;
      });

      particles.forEach((p) => {
        const angle = p.offset + t * p.speed;
        p.mesh.position.x = Math.cos(angle) * p.radius;
        p.mesh.position.z = Math.sin(angle) * p.radius;
        p.mesh.position.y = p.y + Math.sin(t * 1.2 + p.offset) * 0.06;
      });
      particleGroup.rotation.y = -baseRotation;

      renderer.render(scene, camera);
    };

    const resize = () => {
      if (!host.clientWidth || !host.clientHeight) return;
      camera.aspect = host.clientWidth / host.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(host.clientWidth, host.clientHeight);
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    render();

    return () => {
      window.cancelAnimationFrame(animationId);
      resizeObserver.disconnect();
      if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement);
      renderer.dispose();
      const seenGeom = new Set<THREE.BufferGeometry>();
      const seenMat = new Set<THREE.Material>();
      const disposeMat = (m: THREE.Material) => {
        if (seenMat.has(m)) return;
        seenMat.add(m);
        m.dispose();
      };
      disposables.forEach(({ geometry, material }) => {
        if (!seenGeom.has(geometry)) {
          seenGeom.add(geometry);
          geometry.dispose();
        }
        if (Array.isArray(material)) material.forEach(disposeMat);
        else disposeMat(material);
      });
      disposeMat(skinMaterial);
      disposeMat(trimMaterial);
      disposeMat(muscleMaterialBase);
      morphPartsRef.current = null;
    };
  }, []);

  useEffect(() => {
    const morphByCategory: Record<BmiCategory, { shoulder: number; waist: number; hip: number; height: number }> = {
      slim: { shoulder: 0.92, waist: 0.78, hip: 0.88, height: 1.04 },
      athletic: { shoulder: 1.06, waist: 0.88, hip: 0.94, height: 1.0 },
      average: { shoulder: 1.04, waist: 1.06, hip: 1.04, height: 0.98 },
      heavier: { shoulder: 1.16, waist: 1.32, hip: 1.22, height: 0.94 },
    };
    const m = morphByCategory[category];
    const genderShoulder = gender === 'male' ? 1.06 : 0.94;
    const genderHip = gender === 'male' ? 0.96 : 1.1;
    targetMorphRef.current = {
      shoulder: m.shoulder * genderShoulder,
      waist: m.waist,
      hip: m.hip * genderHip,
      height: m.height,
    };

    activityIntensityRef.current = Math.min(1, Math.max(0.24, (activityFactor - 1.15) / 0.58));
  }, [activityFactor, category, bmi, gender]);

  return (
    <div className="relative h-[360px] overflow-hidden rounded-[2rem] border border-cyan-300/10 bg-[#06101f]/80 sm:h-[500px]">
      <div className="orb left-4 top-6 h-32 w-32 bg-cyan-400/30" />
      <div className="orb bottom-8 right-8 h-44 w-44 bg-blue-600/30" />
      <div ref={hostRef} className="absolute inset-0" aria-label="3D body avatar preview" />
      <div className="absolute left-5 top-5 rounded-full border border-cyan-300/20 bg-black/24 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100">
        Live avatar
      </div>
      <div className="absolute bottom-5 left-5 right-5 rounded-2xl border border-white/10 bg-black/30 p-4 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">BMI build</p>
            <p className="font-display text-xl font-semibold capitalize text-white">{category}</p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">BMI</p>
            <p className="font-display text-xl font-semibold text-cyan-200">{bmi.toFixed(1)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [state, setState] = useState(initialState);

  const activeLevel = activityLevels.find((level) => level.key === state.activity) ?? activityLevels[0];
  const heightDisplay = state.unitSystem === 'metric' ? state.heightCm : cmToIn(state.heightCm);
  const weightDisplay = state.unitSystem === 'metric' ? state.weightKg : kgToLb(state.weightKg);

  const calculations = useMemo(() => {
    const bmr = calculateBmr(state.weightKg, state.heightCm, state.age, state.gender);
    const tdee = bmr * activeLevel.factor;
    const bmi = state.weightKg / (state.heightCm / 100) ** 2;
    const ketoLow = tdee * 0.7;
    const ketoHigh = tdee * 0.8;
    const ketoTarget = (ketoLow + ketoHigh) / 2;
    const macroCalories = {
      fat: ketoTarget * 0.75,
      protein: ketoTarget * 0.2,
      carbs: ketoTarget * 0.05,
    };

    return {
      bmr,
      tdee,
      bmi,
      dailyCalories: tdee,
      ketoLow,
      ketoHigh,
      ketoTarget,
      macros: {
        fatGrams: macroCalories.fat / 9,
        proteinGrams: macroCalories.protein / 4,
        carbsGrams: macroCalories.carbs / 4,
      },
      category: getBmiCategory(bmi),
    };
  }, [activeLevel.factor, state.age, state.gender, state.heightCm, state.weightKg]);

  const updateHeight = (value: string) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return;
    setState((current) => ({
      ...current,
      heightCm: current.unitSystem === 'metric' ? numeric : inToCm(numeric),
    }));
  };

  const updateWeight = (value: string) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return;
    setState((current) => ({
      ...current,
      weightKg: current.unitSystem === 'metric' ? numeric : lbToKg(numeric),
    }));
  };

  return (
    <main className="min-h-screen bg-[#050914] text-slate-100">
      <section className="relative isolate overflow-hidden px-4 py-6 sm:px-6 lg:px-8">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.22),transparent_30%),radial-gradient(circle_at_80%_10%,rgba(37,99,235,0.18),transparent_32%),linear-gradient(180deg,#050914,#09111f_48%,#050914)]" />
        <div className="absolute left-1/2 top-0 -z-10 h-px w-[80vw] -translate-x-1/2 bg-gradient-to-r from-transparent via-cyan-300/60 to-transparent" />

        <div className="mx-auto max-w-7xl">
          <motion.header
            className="mb-8 flex flex-col gap-6 pt-5 lg:flex-row lg:items-end lg:justify-between"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
          >
            <div className="max-w-3xl">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/8 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100">
                <span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_18px_#67e8f9]" />
                Premium metabolic lab
              </div>
              <h1 className="font-display text-5xl font-bold tracking-[-0.05em] text-white sm:text-6xl lg:text-7xl">
                BMR intelligence for precision training.
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
                Calculate basal metabolism, total daily energy expenditure, keto calorie ranges, and body composition
                signals with a real-time 3D avatar.
              </p>
            </div>
            <div className="glass-panel rounded-3xl p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Current target</p>
              <p className="font-display text-4xl font-bold text-cyan-100">{formatNumber(calculations.tdee)}</p>
              <p className="text-sm text-slate-400">calories/day from BMR x {activeLevel.factor}</p>
            </div>
          </motion.header>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_440px] xl:grid-cols-[minmax(0,1fr)_500px]">
            <motion.div
              className="glass-panel rounded-[2rem] p-5 sm:p-7"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.08 }}
            >
              <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.24em] text-cyan-200/80">Calculator inputs</p>
                  <h2 className="font-display text-3xl font-semibold text-white">Build your metabolic profile</h2>
                </div>
                <div className="flex rounded-full border border-white/10 bg-black/24 p-1">
                  {(['metric', 'imperial'] as UnitSystem[]).map((unit) => (
                    <button
                      key={unit}
                      type="button"
                      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                        state.unitSystem === unit
                          ? 'bg-cyan-300 text-slate-950 shadow-[0_0_24px_rgba(34,211,238,0.36)]'
                          : 'text-slate-300 hover:text-white'
                      }`}
                      onClick={() => setState((current) => ({ ...current, unitSystem: unit }))}
                    >
                      {unit === 'metric' ? 'kg / cm' : 'lbs / in'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="input-shell rounded-2xl p-4">
                  <span className="text-sm font-medium text-slate-400">
                    Weight ({state.unitSystem === 'metric' ? 'kg' : 'lbs'})
                  </span>
                  <input
                    className="mt-2 w-full bg-transparent font-display text-3xl font-semibold text-white outline-none"
                    type="number"
                    min="1"
                    step="0.1"
                    value={Number(weightDisplay.toFixed(1))}
                    onChange={(event) => updateWeight(event.target.value)}
                  />
                </label>
                <label className="input-shell rounded-2xl p-4">
                  <span className="text-sm font-medium text-slate-400">
                    Height ({state.unitSystem === 'metric' ? 'cm' : 'inches'})
                  </span>
                  <input
                    className="mt-2 w-full bg-transparent font-display text-3xl font-semibold text-white outline-none"
                    type="number"
                    min="1"
                    step="0.1"
                    value={Number(heightDisplay.toFixed(1))}
                    onChange={(event) => updateHeight(event.target.value)}
                  />
                </label>
                <label className="input-shell rounded-2xl p-4">
                  <span className="text-sm font-medium text-slate-400">Age</span>
                  <input
                    className="mt-2 w-full bg-transparent font-display text-3xl font-semibold text-white outline-none"
                    type="number"
                    min="1"
                    max="120"
                    value={state.age}
                    onChange={(event) =>
                      setState((current) => ({ ...current, age: Number(event.target.value) || current.age }))
                    }
                  />
                </label>
                <div className="input-shell rounded-2xl p-4">
                  <span className="text-sm font-medium text-slate-400">Gender</span>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {(['male', 'female'] as Gender[]).map((gender) => (
                      <button
                        key={gender}
                        type="button"
                        className={`rounded-xl px-4 py-3 text-sm font-semibold capitalize transition ${
                          state.gender === gender
                            ? 'bg-blue-500 text-white shadow-[0_0_24px_rgba(59,130,246,0.35)]'
                            : 'bg-white/5 text-slate-300 hover:bg-white/10'
                        }`}
                        onClick={() => setState((current) => ({ ...current, gender }))}
                      >
                        {gender}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <div className="mb-3 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-sm uppercase tracking-[0.24em] text-cyan-200/80">Muscle mass adjustment</p>
                    <h3 className="font-display text-2xl font-semibold text-white">How active is your muscle?</h3>
                  </div>
                  <p className="hidden text-sm text-slate-400 sm:block">BMR x activity factor</p>
                </div>
                <div className="grid gap-3 md:grid-cols-5">
                  {activityLevels.map((level) => (
                    <button
                      key={level.key}
                      type="button"
                      className={`rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 ${
                        state.activity === level.key
                          ? 'border-cyan-300/70 bg-cyan-300/12 shadow-[0_0_34px_rgba(34,211,238,0.18)]'
                          : 'border-white/10 bg-white/[0.035] hover:border-cyan-300/30'
                      }`}
                      onClick={() => setState((current) => ({ ...current, activity: level.key }))}
                    >
                      <span className="font-semibold text-white">{level.label}</span>
                      <span className="mt-1 block text-xs leading-5 text-slate-400">{level.detail}</span>
                      <span className="mt-3 block font-display text-lg font-semibold text-cyan-200">
                        {level.factor.toFixed(3).replace(/0$/, '')}x
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-6 rounded-3xl border border-cyan-300/10 bg-[#081120]/80 p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm uppercase tracking-[0.24em] text-cyan-200/80">Keto integration</p>
                    <h3 className="font-display text-2xl font-semibold text-white">On Keto Diet?</h3>
                    <p className="mt-1 text-sm text-slate-400">
                      {state.keto
                        ? 'Showing 75% fat, 20% protein, 5% carb macros at a 20-30% deficit.'
                        : 'Toggle on for keto-adjusted calorie and macro targets.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    className={`relative h-14 w-28 rounded-full border transition ${
                      state.keto ? 'border-cyan-200 bg-cyan-300/90' : 'border-white/10 bg-white/10'
                    }`}
                    onClick={() => setState((current) => ({ ...current, keto: !current.keto }))}
                    aria-pressed={state.keto}
                  >
                    <span
                      className={`absolute top-1.5 h-11 w-11 rounded-full bg-white shadow-xl transition ${
                        state.keto ? 'left-[4.7rem]' : 'left-1.5'
                      }`}
                    />
                    <span className="sr-only">Toggle keto mode</span>
                  </button>
                </div>
              </div>
            </motion.div>

            <motion.aside
              className="space-y-6"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.16 }}
            >
              <AvatarCanvas
                activityFactor={activeLevel.factor}
                bmi={calculations.bmi}
                category={calculations.category}
                gender={state.gender}
              />
              <div className="glass-panel rounded-[2rem] p-5">
                <p className="text-sm uppercase tracking-[0.24em] text-cyan-200/80">Avatar signal</p>
                <h3 className="mt-2 font-display text-2xl font-semibold text-white">{activeLevel.glow}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Body shape morphs from BMI while cyan muscle zones brighten with your selected activity factor.
                </p>
              </div>
            </motion.aside>
          </div>

          <motion.section
            className="mt-6 grid gap-4 lg:grid-cols-4"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.24 }}
          >
            <MetricCard label="BMR" value={formatNumber(calculations.bmr)} detail="Resting calories/day" />
            <MetricCard
              label="Daily calorie needs"
              value={formatNumber(calculations.dailyCalories)}
              detail={`${activeLevel.label} maintenance`}
            />
            <MetricCard label="TDEE" value={formatNumber(calculations.tdee)} detail="Total energy expenditure" />
            <MetricCard
              label={state.keto ? 'Keto target' : 'Keto mode'}
              value={state.keto ? `${formatNumber(calculations.ketoLow)}-${formatNumber(calculations.ketoHigh)}` : 'Off'}
              detail={state.keto ? '20-30% below TDEE' : 'Enable for deficit macros'}
            />
          </motion.section>

          {state.keto && (
            <motion.section
              className="mt-6 grid gap-4 lg:grid-cols-3"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
            >
              <MacroCard label="Fat" grams={calculations.macros.fatGrams} percent={75} color="from-cyan-300 to-blue-500" />
              <MacroCard
                label="Protein"
                grams={calculations.macros.proteinGrams}
                percent={20}
                color="from-blue-400 to-indigo-500"
              />
              <MacroCard label="Carbs" grams={calculations.macros.carbsGrams} percent={5} color="from-emerald-300 to-cyan-400" />
            </motion.section>
          )}
        </div>
      </section>
    </main>
  );
}

function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="metric-card rounded-3xl p-5">
      <p className="text-xs uppercase tracking-[0.24em] text-slate-400">{label}</p>
      <p className="mt-3 font-display text-3xl font-semibold text-white">{value}</p>
      <p className="mt-2 text-sm text-slate-400">{detail}</p>
    </div>
  );
}

function MacroCard({
  label,
  grams,
  percent,
  color,
}: {
  label: string;
  grams: number;
  percent: number;
  color: string;
}) {
  return (
    <div className="metric-card rounded-3xl p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-[0.24em] text-slate-400">{label}</p>
        <span className="rounded-full bg-white/8 px-3 py-1 text-xs font-semibold text-cyan-100">{percent}%</span>
      </div>
      <p className="mt-3 font-display text-3xl font-semibold text-white">{formatNumber(grams, 'g')}</p>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/8">
        <div className={`h-full rounded-full bg-gradient-to-r ${color}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

export default App;
