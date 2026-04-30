import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import * as THREE from 'three';

type Gender = 'male' | 'female';
type UnitSystem = 'metric' | 'imperial';
type ActivityKey = 'sedentary' | 'light' | 'moderate' | 'very' | 'athlete';
type BmiCategory = 'slim' | 'athletic' | 'average' | 'heavier';

type BodyMeasurement = {
  label: string;
  cm: number;
  note: string;
};

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

function formatMeasurement(cm: number, unitSystem: UnitSystem) {
  if (unitSystem === 'metric') return `${cm.toFixed(1)} cm`;
  return `${cmToIn(cm).toFixed(1)} in`;
}

function estimateBodyMeasurements({
  activityFactor,
  bmi,
  gender,
  heightCm,
  weightKg,
}: {
  activityFactor: number;
  bmi: number;
  gender: Gender;
  heightCm: number;
  weightKg: number;
}): BodyMeasurement[] {
  const leanBias = Math.min(1.08, Math.max(0.88, 1 + (activityFactor - 1.45) * 0.12));
  const massIndex = Math.sqrt(weightKg / 78);
  const bmiBias = Math.min(1.18, Math.max(0.86, 1 + (bmi - 23) * 0.018));
  const genderChestBias = gender === 'male' ? 1.04 : 0.98;
  const genderHipBias = gender === 'male' ? 0.97 : 1.05;

  return [
    {
      label: 'Chest',
      cm: heightCm * 0.53 * massIndex * genderChestBias * leanBias,
      note: 'Upper torso estimate',
    },
    {
      label: 'Waist',
      cm: heightCm * 0.43 * bmiBias * (gender === 'male' ? 1.02 : 0.96),
      note: 'Core circumference',
    },
    {
      label: 'Hips',
      cm: heightCm * 0.52 * massIndex * genderHipBias,
      note: 'Lower torso estimate',
    },
    {
      label: 'Shoulders',
      cm: heightCm * 0.255 * (gender === 'male' ? 1.06 : 0.98) * leanBias,
      note: 'Biacromial width',
    },
    {
      label: 'Upper arm',
      cm: heightCm * 0.17 * massIndex * leanBias,
      note: 'Flexed circumference',
    },
    {
      label: 'Thigh',
      cm: heightCm * 0.31 * massIndex * (0.96 + (activityFactor - 1.2) * 0.08),
      note: 'Mid-thigh circumference',
    },
  ];
}

function AvatarCanvas({
  bmi,
  category,
  activityFactor,
}: {
  bmi: number;
  category: BmiCategory;
  activityFactor: number;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const figureRef = useRef<THREE.Group | null>(null);
  const muscleRefs = useRef<THREE.Mesh[]>([]);
  const hologramRefs = useRef<THREE.Object3D[]>([]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, host.clientWidth / host.clientHeight, 0.1, 100);
    camera.position.set(0, 0.65, 7.4);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(host.clientWidth, host.clientHeight);
    renderer.setClearColor(0x000000, 0);
    host.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0x9bdcff, 2.4);
    const chestLight = new THREE.PointLight(0x7df9ff, 28, 10);
    chestLight.position.set(0, 0.95, 1.8);
    const rimLight = new THREE.PointLight(0x22d3ee, 24, 14);
    rimLight.position.set(-3.5, 2.5, 2);
    scene.add(ambientLight, chestLight, rimLight);

    const figure = new THREE.Group();
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0x8ffaff,
      emissive: 0x0ea5b7,
      emissiveIntensity: 0.72,
      metalness: 0.05,
      opacity: 0.22,
      roughness: 0.1,
      transparent: true,
      depthWrite: false,
    });
    const accentMaterial = new THREE.MeshStandardMaterial({
      color: 0xb8fdff,
      emissive: 0x67e8f9,
      emissiveIntensity: 2.4,
      opacity: 0.74,
      transparent: true,
      depthWrite: false,
    });
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0xa7fbff, transparent: true, opacity: 0.74 });
    const wireMaterial = new THREE.MeshBasicMaterial({
      color: 0x8ffaff,
      opacity: 0.22,
      transparent: true,
      wireframe: true,
    });

    const makeCapsule = (radius: number, length: number, position: [number, number, number], scale = 1) => {
      const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 24, 48), bodyMaterial);
      mesh.position.set(...position);
      mesh.scale.setScalar(scale);
      figure.add(mesh);
      const wire = new THREE.Mesh(mesh.geometry, wireMaterial);
      wire.position.copy(mesh.position);
      wire.rotation.copy(mesh.rotation);
      wire.scale.copy(mesh.scale).multiplyScalar(1.012);
      figure.add(wire);
      hologramRefs.current.push(wire);
      return mesh;
    };

    const torso = makeCapsule(0.58, 1.58, [0, 0.72, 0]);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.36, 40, 40), bodyMaterial);
    head.position.set(0, 1.98, 0);
    figure.add(head);
    const headWire = new THREE.Mesh(head.geometry, wireMaterial);
    headWire.position.copy(head.position);
    headWire.scale.setScalar(1.015);
    figure.add(headWire);
    hologramRefs.current.push(headWire);

    const leftArm = makeCapsule(0.15, 1.48, [-0.84, 0.62, 0], 1);
    leftArm.rotation.z = -0.18;
    const rightArm = makeCapsule(0.15, 1.48, [0.84, 0.62, 0], 1);
    rightArm.rotation.z = 0.18;
    const leftLeg = makeCapsule(0.18, 1.68, [-0.29, -1.08, 0], 1);
    leftLeg.rotation.z = 0.05;
    const rightLeg = makeCapsule(0.18, 1.68, [0.29, -1.08, 0], 1);
    rightLeg.rotation.z = -0.05;

    const muscleZones = [
      [-0.26, 1.08, 0.6, 0.18, 0.44],
      [0.26, 1.08, 0.6, 0.18, 0.44],
      [0, 0.54, 0.66, 0.22, 0.36],
      [-0.33, -0.68, 0.22, 0.16, 0.54],
      [0.33, -0.68, 0.22, 0.16, 0.54],
    ] as const;

    muscleRefs.current = muscleZones.map(([x, y, z, width, height]) => {
      const zone = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 24), accentMaterial.clone());
      zone.position.set(x, y, z);
      zone.scale.set(width, height, 0.035);
      figure.add(zone);
      return zone;
    });

    const makeLine = (points: Array<[number, number, number]>) => {
      const geometry = new THREE.BufferGeometry().setFromPoints(points.map((point) => new THREE.Vector3(...point)));
      const line = new THREE.Line(geometry, lineMaterial.clone());
      figure.add(line);
      hologramRefs.current.push(line);
      return line;
    };

    [
      [[0, 1.55, 0.62], [0, 0.85, 0.72], [0, -0.18, 0.62]],
      [[-0.42, 1.24, 0.62], [0, 0.86, 0.74], [0.42, 1.24, 0.62]],
      [[-0.36, 0.42, 0.7], [0, 0.08, 0.76], [0.36, 0.42, 0.7]],
      [[-0.78, 0.96, 0.25], [-0.35, 0.84, 0.68], [-0.12, 0.28, 0.72]],
      [[0.78, 0.96, 0.25], [0.35, 0.84, 0.68], [0.12, 0.28, 0.72]],
      [[-0.24, -0.2, 0.58], [-0.42, -0.92, 0.36], [-0.32, -1.76, 0.24]],
      [[0.24, -0.2, 0.58], [0.42, -0.92, 0.36], [0.32, -1.76, 0.24]],
    ].forEach((path) => makeLine(path as Array<[number, number, number]>));

    const chestCore = new THREE.Mesh(new THREE.SphereGeometry(0.11, 32, 32), accentMaterial.clone());
    chestCore.position.set(0, 1.05, 0.72);
    figure.add(chestCore);
    const coreHalo = new THREE.Mesh(
      new THREE.RingGeometry(0.18, 0.38, 80),
      new THREE.MeshBasicMaterial({ color: 0xb8fdff, transparent: true, opacity: 0.52, side: THREE.DoubleSide }),
    );
    coreHalo.position.copy(chestCore.position);
    figure.add(coreHalo);
    hologramRefs.current.push(chestCore, coreHalo);

    const base = new THREE.Mesh(
      new THREE.TorusGeometry(1.35, 0.012, 16, 160),
      new THREE.MeshBasicMaterial({ color: 0x7df9ff, transparent: true, opacity: 0.82 }),
    );
    base.position.y = -2.02;
    base.rotation.x = Math.PI / 2;
    figure.add(base);
    const scanRings = [0.72, 1.02, 1.32].map((scale, index) => {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(scale, 0.006, 12, 120),
        new THREE.MeshBasicMaterial({ color: 0x67e8f9, transparent: true, opacity: 0.24 - index * 0.04 }),
      );
      ring.position.y = -1.92 + index * 0.09;
      ring.rotation.x = Math.PI / 2;
      figure.add(ring);
      return ring;
    });
    hologramRefs.current.push(base, ...scanRings);

    figureRef.current = figure;
    scene.add(figure);

    let animationId = 0;
    let elapsed = 0;
    const render = () => {
      animationId = window.requestAnimationFrame(render);
      elapsed += 0.016;
      figure.rotation.y = Math.sin(elapsed * 0.45) * 0.13;
      chestCore.scale.setScalar(1 + Math.sin(elapsed * 4.2) * 0.22);
      coreHalo.rotation.z += 0.018;
      coreHalo.scale.setScalar(1 + Math.sin(elapsed * 2.8) * 0.16);
      scanRings.forEach((ring, index) => {
        ring.position.y = -1.98 + ((elapsed * 0.32 + index * 0.32) % 1.1);
        ring.scale.setScalar(0.84 + Math.sin(elapsed * 1.4 + index) * 0.08);
      });
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
      host.removeChild(renderer.domElement);
      renderer.dispose();
      [torso, head, leftArm, rightArm, leftLeg, rightLeg, base, ...scanRings, ...muscleRefs.current].forEach((mesh) => {
        mesh.geometry.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((material) => material.dispose());
        } else {
          mesh.material.dispose();
        }
      });
      hologramRefs.current.forEach((object) => {
        if ('geometry' in object && object.geometry instanceof THREE.BufferGeometry) object.geometry.dispose();
        if ('material' in object) {
          const material = object.material;
          if (Array.isArray(material)) {
            material.forEach((item) => item.dispose());
          } else if (material instanceof THREE.Material) {
            material.dispose();
          }
        }
      });
      hologramRefs.current = [];
    };
  }, []);

  useEffect(() => {
    const scaleByCategory: Record<BmiCategory, [number, number, number]> = {
      slim: [0.78, 1.06, 0.78],
      athletic: [0.96, 1.02, 0.92],
      average: [1.12, 0.98, 1.08],
      heavier: [1.34, 0.94, 1.24],
    };

    const target = scaleByCategory[category];
    if (figureRef.current) {
      figureRef.current.scale.set(...target);
    }

    const activityIntensity = Math.min(1, Math.max(0.24, (activityFactor - 1.15) / 0.58));
    muscleRefs.current.forEach((zone, index) => {
      const material = zone.material as THREE.MeshStandardMaterial;
      material.emissiveIntensity = activityIntensity * (1 + index * 0.12);
      material.opacity = 0.55 + activityIntensity * 0.4;
      material.transparent = true;
      zone.scale.z = 0.035 + activityIntensity * 0.025;
    });
  }, [activityFactor, category, bmi]);

  return (
    <div className="hologram-stage relative h-[420px] overflow-hidden rounded-[2rem] border border-cyan-300/20 bg-[#06101f]/80 sm:h-[560px]">
      <div className="orb left-4 top-6 h-32 w-32 bg-cyan-400/30" />
      <div className="orb bottom-8 right-8 h-44 w-44 bg-blue-600/30" />
      <div className="hologram-floor" />
      <div ref={hostRef} className="absolute inset-0" aria-label="3D body avatar preview" />
      <div className="absolute left-5 top-5 rounded-full border border-cyan-300/20 bg-black/24 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100">
        Hologram scan
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
  const [bodyMeasurements, setBodyMeasurements] = useState<BodyMeasurement[] | null>(null);

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

  const generateMeasurements = () => {
    setBodyMeasurements(
      estimateBodyMeasurements({
        activityFactor: activeLevel.factor,
        bmi: calculations.bmi,
        gender: state.gender,
        heightCm: state.heightCm,
        weightKg: state.weightKg,
      }),
    );
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
              <div className="mt-6 rounded-3xl border border-cyan-300/20 bg-cyan-300/[0.045] p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm uppercase tracking-[0.24em] text-cyan-200/80">Body scan</p>
                    <h3 className="font-display text-2xl font-semibold text-white">Generate measurements</h3>
                    <p className="mt-1 text-sm text-slate-400">
                      Enter height, weight, age, gender, and activity, then scan estimated body measurements.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="rounded-full bg-cyan-300 px-6 py-3 text-sm font-bold uppercase tracking-[0.18em] text-slate-950 shadow-[0_0_32px_rgba(34,211,238,0.45)] transition hover:-translate-y-0.5 hover:bg-white"
                    onClick={generateMeasurements}
                  >
                    Generate
                  </button>
                </div>
                {bodyMeasurements && (
                  <motion.div
                    className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35 }}
                  >
                    {bodyMeasurements.map((measurement) => (
                      <div key={measurement.label} className="rounded-2xl border border-white/10 bg-black/24 p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{measurement.label}</p>
                        <p className="mt-2 font-display text-2xl font-semibold text-cyan-100">
                          {formatMeasurement(measurement.cm, state.unitSystem)}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">{measurement.note}</p>
                      </div>
                    ))}
                  </motion.div>
                )}
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
