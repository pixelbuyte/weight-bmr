import { motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

type Gender = 'male' | 'female';
type UnitSystem = 'metric' | 'imperial';
type ActivityId = 'sedentary' | 'light' | 'moderate' | 'very' | 'athlete';

const activityLevels: Array<{
  id: ActivityId;
  label: string;
  detail: string;
  factor: number;
  intensity: number;
}> = [
  {
    id: 'sedentary',
    label: 'Sedentary',
    detail: 'Little to no exercise',
    factor: 1.2,
    intensity: 0.2,
  },
  {
    id: 'light',
    label: 'Lightly active',
    detail: '1-3 days/week',
    factor: 1.375,
    intensity: 0.38,
  },
  {
    id: 'moderate',
    label: 'Moderately active',
    detail: '3-5 days/week',
    factor: 1.55,
    intensity: 0.58,
  },
  {
    id: 'very',
    label: 'Very active',
    detail: '6-7 days/week',
    factor: 1.65,
    intensity: 0.78,
  },
  {
    id: 'athlete',
    label: 'Athlete',
    detail: 'Intense training daily',
    factor: 1.725,
    intensity: 1,
  },
];

const kgToLb = (kg: number) => kg * 2.2046226218;
const lbToKg = (lb: number) => lb / 2.2046226218;
const cmToIn = (cm: number) => cm / 2.54;
const inToCm = (inch: number) => inch * 2.54;
const round = (value: number, digits = 0) => Number(value.toFixed(digits));
const safeNumber = (value: string) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const bmiLabel = (bmi: number) => {
  if (!bmi) return 'Awaiting inputs';
  if (bmi < 18.5) return 'Slim / lean';
  if (bmi < 25) return 'Athletic / fit';
  if (bmi < 30) return 'Average build';
  return 'Heavier build';
};

const macroGrams = (calories: number) => ({
  fat: round((calories * 0.75) / 9),
  protein: round((calories * 0.2) / 4),
  carbs: round((calories * 0.05) / 4),
});

function App() {
  const [unitSystem, setUnitSystem] = useState<UnitSystem>('imperial');
  const [weightKg, setWeightKg] = useState(82);
  const [heightCm, setHeightCm] = useState(178);
  const [age, setAge] = useState(34);
  const [gender, setGender] = useState<Gender>('male');
  const [isKeto, setIsKeto] = useState(true);
  const [activityId, setActivityId] = useState<ActivityId>('moderate');

  const activity = activityLevels.find((level) => level.id === activityId) ?? activityLevels[2];
  const weightDisplay = unitSystem === 'metric' ? weightKg : kgToLb(weightKg);
  const heightDisplay = unitSystem === 'metric' ? heightCm : cmToIn(heightCm);

  const results = useMemo(() => {
    const bmrFormula =
      gender === 'male'
        ? 88.362 + 13.397 * weightKg + 4.799 * heightCm - 5.677 * age
        : 447.593 + 9.247 * weightKg + 3.098 * heightCm - 4.33 * age;
    const bmr = Math.max(0, bmrFormula);
    const tdee = bmr * activity.factor;
    const ketoMin = tdee * 0.7;
    const ketoMax = tdee * 0.8;
    const ketoTarget = (ketoMin + ketoMax) / 2;
    const bmi = weightKg / (heightCm / 100) ** 2;

    return {
      bmr: round(bmr),
      tdee: round(tdee),
      maintenance: round(tdee),
      ketoMin: round(ketoMin),
      ketoMax: round(ketoMax),
      ketoTarget: round(ketoTarget),
      bmi: round(bmi, 1),
      macros: macroGrams(ketoTarget),
    };
  }, [activity.factor, age, gender, heightCm, weightKg]);

  const updateWeight = (value: string) => {
    const numeric = safeNumber(value);
    setWeightKg(unitSystem === 'metric' ? numeric : lbToKg(numeric));
  };

  const updateHeight = (value: string) => {
    const numeric = safeNumber(value);
    setHeightCm(unitSystem === 'metric' ? numeric : inToCm(numeric));
  };

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:64px_64px] opacity-30" />
      <div className="relative mx-auto flex max-w-7xl flex-col gap-6">
        <HeroHeader />

        <section className="grid gap-6 lg:grid-cols-[1.02fr_0.98fr]">
          <motion.div
            className="glass-panel rounded-[2rem] p-5 sm:p-7"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-300">
                  Calculator
                </p>
                <h2 className="mt-2 font-display text-3xl font-bold text-white">
                  Metabolic intake studio
                </h2>
              </div>
              <UnitToggle value={unitSystem} onChange={setUnitSystem} />
            </div>

            <div className="mt-7 grid gap-4 sm:grid-cols-2">
              <NumberField
                label={`Weight (${unitSystem === 'metric' ? 'kg' : 'lbs'})`}
                value={round(weightDisplay, unitSystem === 'metric' ? 1 : 0)}
                min={1}
                onChange={updateWeight}
              />
              <NumberField
                label={`Height (${unitSystem === 'metric' ? 'cm' : 'inches'})`}
                value={round(heightDisplay, unitSystem === 'metric' ? 0 : 1)}
                min={1}
                onChange={updateHeight}
              />
              <NumberField
                label="Age"
                value={age}
                min={1}
                onChange={(value) => setAge(Math.max(0, Math.round(safeNumber(value))))}
              />
              <div>
                <label className="text-sm font-semibold text-slate-300">Gender</label>
                <div className="mt-2 grid grid-cols-2 gap-2 rounded-2xl bg-slate-950/50 p-1">
                  {(['male', 'female'] as const).map((option) => (
                    <button
                      key={option}
                      className={`rounded-xl px-4 py-3 text-sm font-bold capitalize transition ${
                        gender === option
                          ? 'bg-cyan-400 text-slate-950 cyan-glow'
                          : 'text-slate-300 hover:bg-white/8'
                      }`}
                      type="button"
                      onClick={() => setGender(option)}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-7">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-300">On Keto Diet?</p>
                  <p className="text-sm text-slate-500">Unlocks 75 / 20 / 5 macro targeting.</p>
                </div>
                <button
                  className={`relative h-12 w-24 rounded-full p-1 transition ${
                    isKeto ? 'bg-cyan-400 cyan-glow' : 'bg-slate-800'
                  }`}
                  type="button"
                  aria-pressed={isKeto}
                  onClick={() => setIsKeto((value) => !value)}
                >
                  <span
                    className={`block h-10 w-10 rounded-full bg-white shadow-xl transition ${
                      isKeto ? 'translate-x-12' : 'translate-x-0'
                    }`}
                  />
                  <span className="absolute inset-0 grid place-items-center text-xs font-black text-slate-950">
                    {isKeto ? 'YES' : ''}
                  </span>
                </button>
              </div>
            </div>

            <ActivitySelector value={activityId} onChange={setActivityId} />
          </motion.div>

          <motion.div
            className="glass-panel overflow-hidden rounded-[2rem]"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.08 }}
          >
            <AvatarScene bmi={results.bmi} activityIntensity={activity.intensity} activity={activity.label} />
          </motion.div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="BMR" value={results.bmr} suffix="kcal/day" accent="from-cyan-300 to-blue-500" />
          <MetricCard
            label="TDEE"
            value={results.tdee}
            suffix="kcal/day"
            accent="from-blue-400 to-indigo-500"
          />
          <MetricCard
            label="Daily calorie needs"
            value={results.maintenance}
            suffix="maintenance"
            accent="from-sky-300 to-cyan-500"
          />
          <MetricCard label="BMI profile" value={results.bmi} suffix={bmiLabel(results.bmi)} accent="from-teal-300 to-cyan-500" />
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <motion.div
            className="glass-panel rounded-[2rem] p-6"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.16 }}
          >
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-300">Recommendation</p>
            <h3 className="mt-3 font-display text-2xl font-bold text-white">
              {isKeto ? 'Keto deficit target' : 'Maintenance target'}
            </h3>
            <p className="mt-3 text-slate-400">
              {isKeto
                ? 'For keto fat loss, use a 20-30% deficit below TDEE while keeping carbs low and protein steady.'
                : 'Your maintenance target tracks TDEE from the Harris-Benedict BMR and selected activity factor.'}
            </p>
            <div className="mt-6 rounded-3xl border border-cyan-300/20 bg-cyan-300/10 p-5">
              <p className="text-sm text-slate-400">Suggested calorie band</p>
              <p className="mt-2 font-display text-4xl font-black text-white">
                {isKeto ? `${results.ketoMin}-${results.ketoMax}` : results.maintenance}
              </p>
              <p className="mt-1 text-sm font-semibold text-cyan-200">kcal/day</p>
            </div>
          </motion.div>

          <motion.div
            className="glass-panel rounded-[2rem] p-6"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.22 }}
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-300">Macros</p>
                <h3 className="mt-3 font-display text-2xl font-bold text-white">
                  {isKeto ? 'Keto split: 75 / 20 / 5' : 'Enable keto for macro targeting'}
                </h3>
              </div>
              <p className="text-sm text-slate-500">
                Target: {isKeto ? results.ketoTarget : results.maintenance} kcal
              </p>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <MacroPill label="Fat" percent={75} grams={isKeto ? results.macros.fat : 0} />
              <MacroPill label="Protein" percent={20} grams={isKeto ? results.macros.protein : 0} />
              <MacroPill label="Carbs" percent={5} grams={isKeto ? results.macros.carbs : 0} />
            </div>
          </motion.div>
        </section>
      </div>
    </main>
  );
}

function HeroHeader() {
  return (
    <motion.header
      className="glass-panel rounded-[2rem] p-6 sm:p-8"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.24em] text-cyan-200">
            PulseFuel BMR
          </div>
          <h1 className="mt-5 font-display text-4xl font-black tracking-tight text-white sm:text-6xl">
            Premium metabolic intelligence for leaner nutrition decisions.
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-400">
            Calculate BMR, TDEE, activity-adjusted calorie needs, and keto macro targets with a
            live 3D body profile tuned by BMI and training intensity.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          {['Live', 'Keto', '3D'].map((item) => (
            <div key={item} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="font-display text-2xl font-black text-white">{item}</p>
              <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">ready</p>
            </div>
          ))}
        </div>
      </div>
    </motion.header>
  );
}

function UnitToggle({
  value,
  onChange,
}: {
  value: UnitSystem;
  onChange: (value: UnitSystem) => void;
}) {
  return (
    <div className="rounded-2xl bg-slate-950/60 p-1">
      {(['imperial', 'metric'] as const).map((system) => (
        <button
          key={system}
          className={`rounded-xl px-4 py-2 text-sm font-bold capitalize transition ${
            value === system ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30' : 'text-slate-400'
          }`}
          type="button"
          onClick={() => onChange(system)}
        >
          {system === 'imperial' ? 'lbs / in' : 'kg / cm'}
        </button>
      ))}
    </div>
  );
}

function NumberField({
  label,
  value,
  min,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-slate-300">{label}</span>
      <input
        className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-4 text-lg font-bold text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300 focus:ring-4 focus:ring-cyan-300/10"
        type="number"
        min={min}
        value={Number.isFinite(value) ? value : ''}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function ActivitySelector({
  value,
  onChange,
}: {
  value: ActivityId;
  onChange: (value: ActivityId) => void;
}) {
  return (
    <div className="mt-7">
      <div>
        <p className="text-sm font-semibold text-slate-300">How much muscle do you have?</p>
        <p className="text-sm text-slate-500">Activity factor adjusts TDEE and avatar muscle highlights.</p>
      </div>
      <div className="mt-4 grid gap-3">
        {activityLevels.map((level) => (
          <button
            key={level.id}
            className={`group flex items-center justify-between rounded-2xl border p-4 text-left transition ${
              value === level.id
                ? 'border-cyan-300/60 bg-cyan-300/12 shadow-lg shadow-cyan-500/10'
                : 'border-white/10 bg-white/[0.03] hover:border-cyan-300/25 hover:bg-white/[0.06]'
            }`}
            type="button"
            onClick={() => onChange(level.id)}
          >
            <span>
              <span className="block font-bold text-white">{level.label}</span>
              <span className="text-sm text-slate-500">{level.detail}</span>
            </span>
            <span className="rounded-full bg-slate-950/70 px-3 py-1 text-sm font-bold text-cyan-200">
              x{level.factor}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  suffix,
  accent,
}: {
  label: string;
  value: number;
  suffix: string;
  accent: string;
}) {
  return (
    <motion.div
      className="metric-card rounded-[1.6rem] p-5"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.42 }}
    >
      <div className={`h-1.5 w-16 rounded-full bg-gradient-to-r ${accent}`} />
      <p className="mt-5 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 font-display text-4xl font-black text-white">{value}</p>
      <p className="mt-1 text-sm font-semibold text-cyan-200">{suffix}</p>
    </motion.div>
  );
}

function MacroPill({ label, percent, grams }: { label: string; percent: number; grams: number }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/45 p-4">
      <div className="flex items-center justify-between text-sm">
        <span className="font-bold text-white">{label}</span>
        <span className="text-cyan-200">{percent}%</span>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-blue-500"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-4 font-display text-3xl font-black text-white">{grams}g</p>
    </div>
  );
}

function AvatarScene({
  bmi,
  activityIntensity,
  activity,
}: {
  bmi: number;
  activityIntensity: number;
  activity: string;
}) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const bodyRef = useRef<THREE.Group | null>(null);
  const muscleRefs = useRef<THREE.Mesh[]>([]);

  useEffect(() => {
    if (!mountRef.current) return;

    const mount = mountRef.current;
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x071019, 8, 16);

    const camera = new THREE.PerspectiveCamera(38, mount.clientWidth / mount.clientHeight, 0.1, 100);
    camera.position.set(0, 1.65, 7.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight(0x8eeeff, 1.4);
    const key = new THREE.DirectionalLight(0xffffff, 2.3);
    key.position.set(2.6, 4.8, 4.2);
    const rim = new THREE.PointLight(0x00e5ff, 42, 9);
    rim.position.set(-2.6, 2.2, 3.5);
    scene.add(ambient, key, rim);

    const grid = new THREE.GridHelper(6.5, 24, 0x00e5ff, 0x12314a);
    grid.position.y = -1.65;
    grid.material.opacity = 0.22;
    grid.material.transparent = true;
    scene.add(grid);

    const avatar = new THREE.Group();
    const skin = new THREE.MeshStandardMaterial({
      color: 0x8bb7c7,
      metalness: 0.18,
      roughness: 0.48,
      emissive: 0x071928,
      emissiveIntensity: 0.32,
    });
    const muscle = new THREE.MeshStandardMaterial({
      color: 0x1ee7ff,
      metalness: 0.35,
      roughness: 0.22,
      emissive: 0x00d9ff,
      emissiveIntensity: 0.9,
    });

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.72, 1.45, 8, 24), skin);
    torso.name = 'torso';
    torso.position.y = 0.25;
    avatar.add(torso);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 32, 24), skin);
    head.name = 'head';
    head.position.y = 1.55;
    avatar.add(head);

    const pelvis = new THREE.Mesh(new THREE.SphereGeometry(0.58, 32, 18), skin);
    pelvis.name = 'pelvis';
    pelvis.position.y = -0.73;
    pelvis.scale.set(1.12, 0.55, 0.72);
    avatar.add(pelvis);

    const makeLimb = (name: string, x: number, y: number, z: number, radius: number, length: number, rotZ = 0) => {
      const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 8, 18), skin);
      mesh.name = name;
      mesh.position.set(x, y, z);
      mesh.rotation.z = rotZ;
      avatar.add(mesh);
      return mesh;
    };

    makeLimb('leftArm', -0.95, 0.38, 0, 0.16, 1.2, -0.16);
    makeLimb('rightArm', 0.95, 0.38, 0, 0.16, 1.2, 0.16);
    makeLimb('leftLeg', -0.34, -1.7, 0, 0.19, 1.55, 0.04);
    makeLimb('rightLeg', 0.34, -1.7, 0, 0.19, 1.55, -0.04);

    const makeMuscle = (x: number, y: number, sx: number, sy: number) => {
      const pad = new THREE.Mesh(new THREE.SphereGeometry(0.16, 24, 16), muscle);
      pad.position.set(x, y, 0.55);
      pad.scale.set(sx, sy, 0.22);
      avatar.add(pad);
      muscleRefs.current.push(pad);
    };

    muscleRefs.current = [];
    makeMuscle(-0.32, 0.65, 1.25, 1.75);
    makeMuscle(0.32, 0.65, 1.25, 1.75);
    makeMuscle(-0.52, -0.95, 1.4, 1.1);
    makeMuscle(0.52, -0.95, 1.4, 1.1);
    makeMuscle(-1.03, 0.55, 0.82, 1.35);
    makeMuscle(1.03, 0.55, 0.82, 1.35);

    avatar.rotation.y = -0.38;
    bodyRef.current = avatar;
    scene.add(avatar);

    const resize = () => {
      if (!mountRef.current) return;
      const width = mountRef.current.clientWidth;
      const height = mountRef.current.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);

    let frame = 0;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      avatar.rotation.y += 0.004;
      muscleRefs.current.forEach((mesh, index) => {
        mesh.scale.z = 0.22 + Math.sin(Date.now() * 0.002 + index) * 0.03;
      });
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          if (Array.isArray(object.material)) {
            object.material.forEach((material) => material.dispose());
          } else {
            object.material.dispose();
          }
        }
      });
    };
  }, []);

  useEffect(() => {
    if (!bodyRef.current) return;

    const bmiScale = !bmi ? 1 : bmi < 18.5 ? 0.82 : bmi < 25 ? 0.96 : bmi < 30 ? 1.12 : 1.3;
    const athleticScale = activityIntensity > 0.55 ? 1 + activityIntensity * 0.12 : 1;
    bodyRef.current.scale.set(bmiScale * athleticScale, 1, Math.max(0.82, bmiScale * 0.92));
    muscleRefs.current.forEach((mesh) => {
      const material = mesh.material as THREE.MeshStandardMaterial;
      material.opacity = 0.35 + activityIntensity * 0.65;
      material.transparent = true;
      material.emissiveIntensity = 0.25 + activityIntensity * 1.8;
      mesh.visible = activityIntensity > 0.18;
    });
  }, [activityIntensity, bmi]);

  return (
    <div className="relative min-h-[560px] overflow-hidden">
      <div className="absolute left-5 top-5 z-10 rounded-3xl border border-cyan-300/20 bg-slate-950/60 p-4 backdrop-blur">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-200">3D avatar</p>
        <p className="mt-1 font-display text-2xl font-black text-white">{bmiLabel(bmi)}</p>
        <p className="text-sm text-slate-400">BMI {bmi || '--'} &bull; {activity}</p>
      </div>
      <div ref={mountRef} className="avatar-canvas h-[560px] w-full" />
      <div className="absolute bottom-5 left-5 right-5 rounded-3xl border border-white/10 bg-slate-950/55 p-4 backdrop-blur">
        <div className="flex items-center justify-between text-sm font-semibold text-slate-300">
          <span>Muscle activation</span>
          <span>{round(activityIntensity * 100)}%</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-500 via-cyan-300 to-teal-300"
            style={{ width: `${activityIntensity * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
