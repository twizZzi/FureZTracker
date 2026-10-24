import { DEFAULT_EXERCISES } from "./exercises";
import { parseNumber } from "../lib/workouts";
import { todayKey } from "../lib/dates";

export const STORAGE_KEY = "furez-tracker-data";
// v2 data is read once and migrated; the old key is left untouched as a fallback copy.
const LEGACY_STORAGE_KEY = "furez-tracker-v2-data";
export const SCHEMA_VERSION = 3;

export const DEFAULT_PROFILE = {
  weight: "",
  height: "",
  age: "",
  gender: "male",
  goal: "maintain",
  activity: "light",
  kcalOverride: "",
  proteinOverride: "",
  fatOverride: "",
  carbsOverride: "",
  restSeconds: 90,
};

const DEFAULT_PROGRAMS = [
  {
    id: "chest-triceps",
    title: "Грудь / Трицепс",
    restSeconds: 90,
    exercises: [
      { exerciseId: "bench-press", sets: 4, targetReps: "8–10", targetWeight: null },
      { exerciseId: "incline-dumbbell-press", sets: 3, targetReps: "10–12", targetWeight: null },
      { exerciseId: "dumbbell-fly", sets: 3, targetReps: "10–12", targetWeight: null },
      { exerciseId: "triceps-pushdown", sets: 3, targetReps: "10–12", targetWeight: null },
    ],
  },
  {
    id: "back-biceps",
    title: "Спина / Бицепс",
    restSeconds: 90,
    exercises: [
      { exerciseId: "pull-up", sets: 3, targetReps: "6–10", targetWeight: null },
      { exerciseId: "lat-pulldown", sets: 4, targetReps: "10–12", targetWeight: null },
      { exerciseId: "seated-cable-row", sets: 3, targetReps: "10–12", targetWeight: null },
      { exerciseId: "biceps-curl", sets: 3, targetReps: "10–12", targetWeight: null },
    ],
  },
  {
    id: "legs-shoulders",
    title: "Ноги / Плечи",
    restSeconds: 120,
    exercises: [
      { exerciseId: "squat", sets: 4, targetReps: "6–8", targetWeight: null },
      { exerciseId: "romanian-deadlift", sets: 3, targetReps: "8–10", targetWeight: null },
      { exerciseId: "leg-press", sets: 3, targetReps: "10–12", targetWeight: null },
      { exerciseId: "shoulder-press", sets: 3, targetReps: "8–10", targetWeight: null },
      { exerciseId: "lateral-raise", sets: 3, targetReps: "12–15", targetWeight: null },
    ],
  },
];

export function createInitialData() {
  return {
    schemaVersion: SCHEMA_VERSION,
    profile: { ...DEFAULT_PROFILE },
    exercises: DEFAULT_EXERCISES,
    programs: DEFAULT_PROGRAMS,
    schedule: {},
    scheduleSince: null,
    workouts: {},
    food: [],
    customFoods: [],
    favoriteFoods: [],
    bodyWeight: {},
    notes: {},
  };
}

function mergeExercises(saved) {
  const list = Array.isArray(saved) ? saved : [];
  const ids = new Set(list.map((exercise) => exercise.id));
  return [...list, ...DEFAULT_EXERCISES.filter((exercise) => !ids.has(exercise.id))];
}

// A pure number ("10") is a real result; a range ("8–10") was a template target copied into the log.
function isPlainNumber(value) {
  return typeof value === "number" || /^\s*\d+([.,]\d+)?\s*$/.test(String(value ?? ""));
}

function migrateV2(old) {
  const today = todayKey();
  const exercises = mergeExercises(old.exerciseLibrary);

  const programs = (old.workoutTemplates || []).map((template) => ({
    id: template.id,
    title: template.title || "Программа",
    restSeconds: 90,
    exercises: (template.exercises || []).map((item) => ({
      exerciseId: item.exerciseId,
      sets: Number(item.sets) || 3,
      targetReps: String(item.reps ?? ""),
      targetWeight: parseNumber(item.weight),
    })),
  }));

  const workouts = {};
  Object.entries(old.workoutLogs || {}).forEach(([dateKey, log]) => {
    const exercisesLog = (log.exercises || []).map((exercise, index) => {
      const firstRange = (exercise.sets || []).find((set) => set.reps && !isPlainNumber(set.reps));
      return {
        id: exercise.id || `${log.id || dateKey}-${index}`,
        exerciseId: exercise.exerciseId,
        name: exercise.name,
        muscleGroup: exercise.muscleGroup || "",
        targetReps: firstRange ? String(firstRange.reps) : "",
        targetWeight: null,
        restSeconds: 90,
        sets: (exercise.sets || []).map((set) => ({
          weight: set.done || isPlainNumber(set.weight) ? parseNumber(set.weight) : null,
          reps: set.done || isPlainNumber(set.reps) ? parseNumber(set.reps) : null,
          done: Boolean(set.done),
        })),
      };
    });

    const sets = exercisesLog.flatMap((exercise) => exercise.sets);
    const finished = sets.length > 0 && sets.every((set) => set.done);

    workouts[dateKey] = {
      id: log.id || `workout-${dateKey}`,
      date: dateKey,
      programId: log.templateId || null,
      title: log.title || "Тренировка",
      startedAt: null,
      finishedAt: finished ? new Date(`${dateKey}T20:00:00`).getTime() : null,
      exercises: exercisesLog,
    };
  });

  // Entries without a date used to leak into every day; pin them to the migration day.
  const food = (old.foodEntries || []).map((item, index) => ({
    id: `food-${item.id || index}`,
    date: item.date || today,
    meal: "snack",
    name: item.name || "Еда",
    grams: null,
    productId: null,
    kcal: Number(item.calories) || 0,
    p: Number(item.protein) || 0,
    f: Number(item.fat) || 0,
    c: Number(item.carbs) || 0,
  }));

  const profile = { ...DEFAULT_PROFILE, ...(old.profile || {}) };
  const bodyWeight = Number(profile.weight) > 0 ? { [today]: Number(profile.weight) } : {};

  return {
    ...createInitialData(),
    profile,
    exercises,
    programs: programs.length > 0 ? programs : DEFAULT_PROGRAMS,
    workouts,
    food,
    bodyWeight,
    notes: old.dayNotes || {},
  };
}

export function normalizeData(raw) {
  if (!raw || typeof raw !== "object") return createInitialData();
  if (!raw.schemaVersion) return migrateV2(raw);

  const base = createInitialData();
  return {
    ...base,
    ...raw,
    schemaVersion: SCHEMA_VERSION,
    profile: { ...DEFAULT_PROFILE, ...(raw.profile || {}) },
    exercises: mergeExercises(raw.exercises),
    programs: Array.isArray(raw.programs) ? raw.programs : base.programs,
  };
}

function readJson(key) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

export function loadData() {
  const current = readJson(STORAGE_KEY);
  if (current) return normalizeData(current);

  const legacy = readJson(LEGACY_STORAGE_KEY);
  if (legacy) return normalizeData(legacy);

  return createInitialData();
}

export function saveData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function parseBackup(text) {
  const raw = JSON.parse(text);
  const looksValid =
    raw && typeof raw === "object" && (raw.schemaVersion || raw.workoutLogs || raw.foodEntries || raw.workouts);
  if (!looksValid) throw new Error("Это не похоже на бэкап FureZ Tracker");
  return normalizeData(raw);
}
