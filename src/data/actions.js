// Pure state transitions: (state, ...args) => nextState. Used via update(action, ...args).
import { buildWorkout, createLoggedExercise, emptySet } from "../lib/workouts";
import { todayKey } from "../lib/dates";

export function createId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

const byId = (list) => Object.fromEntries(list.map((item) => [item.id, item]));

/* Profile */

export function updateProfile(state, field, value) {
  return { ...state, profile: { ...state.profile, [field]: value } };
}

export function logBodyWeight(state, dateKey, kg) {
  const bodyWeight = { ...state.bodyWeight };
  if (kg > 0) bodyWeight[dateKey] = kg;
  else delete bodyWeight[dateKey];

  const latestKey = Object.keys(bodyWeight).sort().pop();
  const weight = latestKey ? bodyWeight[latestKey] : state.profile.weight;
  return { ...state, bodyWeight, profile: { ...state.profile, weight } };
}

/* Workouts */

function patchWorkout(state, dateKey, patch) {
  const workout = state.workouts[dateKey];
  if (!workout) return state;
  const next = typeof patch === "function" ? patch(workout) : { ...workout, ...patch };
  return { ...state, workouts: { ...state.workouts, [dateKey]: next } };
}

function patchExercise(state, dateKey, exerciseId, patch) {
  return patchWorkout(state, dateKey, (workout) => ({
    ...workout,
    exercises: workout.exercises.map((exercise) =>
      exercise.id === exerciseId ? patch(exercise) : exercise
    ),
  }));
}

export function startWorkout(state, dateKey, programId) {
  const program = state.programs.find((item) => item.id === programId) || null;
  const workout = buildWorkout({
    id: createId("workout"),
    date: dateKey,
    program,
    exercisesById: byId(state.exercises),
    restSeconds: state.profile.restSeconds,
  });
  if (dateKey === todayKey()) workout.startedAt = Date.now();
  return { ...state, workouts: { ...state.workouts, [dateKey]: workout } };
}

export function deleteWorkout(state, dateKey) {
  const workouts = { ...state.workouts };
  delete workouts[dateKey];
  return { ...state, workouts };
}

export function renameWorkout(state, dateKey, title) {
  return patchWorkout(state, dateKey, { title });
}

export function updateSet(state, dateKey, exerciseId, setIndex, patch) {
  return patchWorkout(state, dateKey, (workout) => ({
    ...workout,
    startedAt: workout.startedAt || (patch.done && dateKey === todayKey() ? Date.now() : null),
    exercises: workout.exercises.map((exercise) =>
      exercise.id === exerciseId
        ? {
            ...exercise,
            sets: exercise.sets.map((set, index) => (index === setIndex ? { ...set, ...patch } : set)),
          }
        : exercise
    ),
  }));
}

export function addSet(state, dateKey, exerciseId) {
  return patchExercise(state, dateKey, exerciseId, (exercise) => ({
    ...exercise,
    sets: [...exercise.sets, emptySet()],
  }));
}

export function removeSet(state, dateKey, exerciseId, setIndex) {
  return patchExercise(state, dateKey, exerciseId, (exercise) => ({
    ...exercise,
    sets: exercise.sets.filter((_, index) => index !== setIndex),
  }));
}

export function setExerciseRest(state, dateKey, exerciseId, restSeconds) {
  return patchExercise(state, dateKey, exerciseId, (exercise) => ({ ...exercise, restSeconds }));
}

export function addExercisesToWorkout(state, dateKey, exerciseIds) {
  const exercisesById = byId(state.exercises);
  return patchWorkout(state, dateKey, (workout) => ({
    ...workout,
    exercises: [
      ...workout.exercises,
      ...exerciseIds
        .map((id) => exercisesById[id])
        .filter(Boolean)
        .map((exercise) =>
          createLoggedExercise({
            id: createId("logged"),
            exercise,
            setsCount: 3,
            restSeconds: state.profile.restSeconds,
          })
        ),
    ],
  }));
}

export function removeWorkoutExercise(state, dateKey, exerciseId) {
  return patchWorkout(state, dateKey, (workout) => ({
    ...workout,
    exercises: workout.exercises.filter((exercise) => exercise.id !== exerciseId),
  }));
}

export function moveWorkoutExercise(state, dateKey, exerciseId, direction) {
  return patchWorkout(state, dateKey, (workout) => ({
    ...workout,
    exercises: moveItem(workout.exercises, (item) => item.id === exerciseId, direction),
  }));
}

// Drops sets that were never ticked, then exercises left without sets.
export function finishWorkout(state, dateKey) {
  return patchWorkout(state, dateKey, (workout) => ({
    ...workout,
    finishedAt: Date.now(),
    exercises: workout.exercises
      .map((exercise) => ({ ...exercise, sets: exercise.sets.filter((set) => set.done) }))
      .filter((exercise) => exercise.sets.length > 0),
  }));
}

export function reopenWorkout(state, dateKey) {
  return patchWorkout(state, dateKey, { finishedAt: null });
}

/* Programs */

function moveItem(list, predicate, direction) {
  const index = list.findIndex(predicate);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= list.length) return list;
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

function patchProgram(state, programId, patch) {
  return {
    ...state,
    programs: state.programs.map((program) =>
      program.id === programId ? (typeof patch === "function" ? patch(program) : { ...program, ...patch }) : program
    ),
  };
}

export function createProgram(state, program) {
  return { ...state, programs: [...state.programs, program] };
}

export function updateProgram(state, programId, patch) {
  return patchProgram(state, programId, patch);
}

export function deleteProgram(state, programId) {
  const schedule = Object.fromEntries(
    Object.entries(state.schedule).filter(([, id]) => id !== programId)
  );
  return {
    ...state,
    programs: state.programs.filter((program) => program.id !== programId),
    schedule,
  };
}

export function duplicateProgram(state, programId) {
  const source = state.programs.find((program) => program.id === programId);
  if (!source) return state;
  const copy = {
    ...source,
    id: createId("program"),
    title: `${source.title} (копия)`,
    exercises: source.exercises.map((item) => ({ ...item })),
  };
  return { ...state, programs: [...state.programs, copy] };
}

export function addProgramExercises(state, programId, exerciseIds) {
  return patchProgram(state, programId, (program) => ({
    ...program,
    exercises: [
      ...program.exercises,
      ...exerciseIds.map((exerciseId) => ({ exerciseId, sets: 3, targetReps: "8–12", targetWeight: null })),
    ],
  }));
}

export function updateProgramExercise(state, programId, index, patch) {
  return patchProgram(state, programId, (program) => ({
    ...program,
    exercises: program.exercises.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
  }));
}

export function removeProgramExercise(state, programId, index) {
  return patchProgram(state, programId, (program) => ({
    ...program,
    exercises: program.exercises.filter((_, itemIndex) => itemIndex !== index),
  }));
}

export function moveProgramExercise(state, programId, index, direction) {
  return patchProgram(state, programId, (program) => {
    const indexed = program.exercises.map((item, itemIndex) => ({ item, itemIndex }));
    const moved = moveItem(indexed, (entry) => entry.itemIndex === index, direction);
    return { ...program, exercises: moved.map((entry) => entry.item) };
  });
}

// Toggles weekday → program. A weekday holds at most one program.
export function toggleScheduleDay(state, day, programId) {
  const schedule = { ...state.schedule };
  if (schedule[day] === programId) delete schedule[day];
  else schedule[day] = programId;
  return { ...state, schedule, scheduleSince: todayKey() };
}

/* Exercise library */

export function createExercise(state, exercise) {
  return { ...state, exercises: [...state.exercises, exercise] };
}

export function updateExercise(state, exerciseId, patch) {
  return {
    ...state,
    exercises: state.exercises.map((exercise) => (exercise.id === exerciseId ? { ...exercise, ...patch } : exercise)),
  };
}

export function deleteExercise(state, exerciseId) {
  return {
    ...state,
    exercises: state.exercises.filter((exercise) => exercise.id !== exerciseId),
    programs: state.programs.map((program) => ({
      ...program,
      exercises: program.exercises.filter((item) => item.exerciseId !== exerciseId),
    })),
  };
}

/* Notes */

export function setNote(state, dateKey, text) {
  return { ...state, notes: { ...state.notes, [dateKey]: text } };
}

/* Food */

export function addFood(state, entry) {
  return { ...state, food: [...state.food, { id: createId("food"), ...entry }] };
}

export function updateFood(state, foodId, patch) {
  return {
    ...state,
    food: state.food.map((item) => (item.id === foodId ? { ...item, ...patch } : item)),
  };
}

export function deleteFood(state, foodId) {
  return { ...state, food: state.food.filter((item) => item.id !== foodId) };
}

export function copyMeal(state, fromDate, toDate, meal) {
  const copies = state.food
    .filter((item) => item.date === fromDate && item.meal === meal)
    .map((item) => ({ ...item, id: createId("food"), date: toDate }));
  return { ...state, food: [...state.food, ...copies] };
}

export function saveCustomFood(state, product) {
  const exists = state.customFoods.some((item) => item.id === product.id);
  return {
    ...state,
    customFoods: exists
      ? state.customFoods.map((item) => (item.id === product.id ? product : item))
      : [...state.customFoods, product],
  };
}

export function toggleFavoriteFood(state, productId) {
  const favorites = state.favoriteFoods.includes(productId)
    ? state.favoriteFoods.filter((id) => id !== productId)
    : [...state.favoriteFoods, productId];
  return { ...state, favoriteFoods: favorites };
}

/* Backup */

export function replaceAll(_state, nextState) {
  return nextState;
}
