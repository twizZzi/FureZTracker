import { daysBetween, startOfWeek, addDays, todayKey, weekday } from "./dates";

export function parseNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const match = String(value).replace(",", ".").match(/\d+(\.\d+)?/);
  return match ? Number(match[0]) : null;
}

export function formatWeight(value) {
  if (value === null || value === undefined) return "—";
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
}

export function isSetComplete(set) {
  return Boolean(set.done);
}

export function workoutSets(workout) {
  return (workout?.exercises || []).flatMap((exercise) => exercise.sets || []);
}

export function isWorkoutDone(workout) {
  if (!workout) return false;
  if (workout.finishedAt) return true;
  const sets = workoutSets(workout);
  return sets.length > 0 && sets.every(isSetComplete);
}

export function workoutProgress(workout) {
  const sets = workoutSets(workout);
  return { done: sets.filter(isSetComplete).length, total: sets.length };
}

export function setVolume(set) {
  if (!set.done) return 0;
  return (Number(set.weight) || 0) * (Number(set.reps) || 0);
}

export function workoutVolume(workout) {
  return Math.round(workoutSets(workout).reduce((sum, set) => sum + setVolume(set), 0));
}

// Epley estimate of a one-rep max.
export function estimateOneRepMax(weight, reps) {
  if (!weight || !reps) return 0;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

export function lowerBound(repsTarget) {
  return parseNumber(repsTarget);
}

// All logged sessions of an exercise, newest first.
export function exerciseHistory(workouts, exerciseId, { before } = {}) {
  return Object.values(workouts || {})
    .filter((workout) => !before || workout.date < before)
    .flatMap((workout) =>
      (workout.exercises || [])
        .filter((exercise) => exercise.exerciseId === exerciseId)
        .map((exercise) => ({
          date: workout.date,
          workoutTitle: workout.title,
          sets: (exercise.sets || []).filter((set) => set.done),
        }))
    )
    .filter((entry) => entry.sets.length > 0)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function previousSets(workouts, exerciseId, dateKey) {
  return exerciseHistory(workouts, exerciseId, { before: dateKey })[0]?.sets || [];
}

export function bestOf(sets) {
  return sets.reduce(
    (best, set) => {
      const weight = Number(set.weight) || 0;
      const reps = Number(set.reps) || 0;
      const oneRm = estimateOneRepMax(weight, reps);
      return {
        weight: Math.max(best.weight, weight),
        oneRm: Math.max(best.oneRm, oneRm),
        reps: Math.max(best.reps, reps),
        volume: Math.max(best.volume, weight * reps),
      };
    },
    { weight: 0, oneRm: 0, reps: 0, volume: 0 }
  );
}

export function exerciseRecords(workouts, exerciseId, options) {
  const history = exerciseHistory(workouts, exerciseId, options);
  return { sessions: history.length, ...bestOf(history.flatMap((entry) => entry.sets)) };
}

// Records beaten by this workout compared with everything logged before it.
export function newRecords(workouts, workout) {
  return (workout.exercises || [])
    .map((exercise) => {
      const doneSets = (exercise.sets || []).filter((set) => set.done);
      if (doneSets.length === 0) return null;
      const before = exerciseRecords(workouts, exercise.exerciseId, { before: workout.date });
      if (before.sessions === 0) return null;
      const now = bestOf(doneSets);
      const kinds = [];
      if (now.weight > before.weight) kinds.push(`вес ${formatWeight(now.weight)} кг`);
      if (now.oneRm > before.oneRm) kinds.push(`1ПМ ≈ ${formatWeight(now.oneRm)} кг`);
      if (kinds.length === 0) return null;
      return { name: exercise.name, kinds };
    })
    .filter(Boolean);
}

export function buildWorkout({ id, date, program, exercisesById, restSeconds }) {
  return {
    id,
    date,
    programId: program?.id || null,
    title: program?.title || "Тренировка",
    startedAt: null,
    finishedAt: null,
    exercises: (program?.exercises || [])
      .map((item, index) => {
        const exercise = exercisesById[item.exerciseId];
        if (!exercise) return null;
        return createLoggedExercise({
          id: `${id}-${index}`,
          exercise,
          setsCount: item.sets,
          targetReps: item.targetReps,
          targetWeight: item.targetWeight,
          restSeconds: program?.restSeconds || restSeconds,
        });
      })
      .filter(Boolean),
  };
}

export function createLoggedExercise({ id, exercise, setsCount = 3, targetReps = "", targetWeight = null, restSeconds = 90 }) {
  return {
    id,
    exerciseId: exercise.id,
    name: exercise.name,
    muscleGroup: exercise.muscleGroup,
    targetReps: targetReps || "",
    targetWeight: targetWeight ?? null,
    restSeconds,
    sets: Array.from({ length: Math.max(1, Number(setsCount) || 1) }, () => emptySet()),
  };
}

export function emptySet() {
  return { weight: null, reps: null, done: false };
}

export function completedWorkouts(workouts) {
  return Object.values(workouts || {}).filter(isWorkoutDone);
}

export function scheduledDaysCount(schedule) {
  return Object.values(schedule || {}).filter(Boolean).length;
}

// Consecutive weeks (ending with the current one) that hit the weekly target.
// The target is the number of scheduled days, but only for weeks after the schedule
// was set; earlier weeks need one workout. The current week only extends the streak.
export function weekStreak(workouts, schedule, scheduleSince) {
  const planned = Math.max(1, scheduledDaysCount(schedule));
  const doneDates = completedWorkouts(workouts).map((workout) => workout.date);
  const meetsTarget = (monday) => {
    const sunday = addDays(monday, 6);
    const required = scheduleSince && sunday < scheduleSince ? 1 : planned;
    return doneDates.filter((date) => date >= monday && date <= sunday).length >= required;
  };

  let monday = startOfWeek(todayKey());
  let streak = meetsTarget(monday) ? 1 : 0;
  monday = addDays(monday, -7);

  while (meetsTarget(monday)) {
    streak += 1;
    monday = addDays(monday, -7);
  }
  return streak;
}

// scheduleSince: the schedule only counts from the day it was last edited,
// so older days are not marked as missed retroactively.
export function dayStatus({ dateKey, workouts, schedule, scheduleSince, today }) {
  const workout = workouts?.[dateKey];
  if (workout && isWorkoutDone(workout)) return "done";
  if (workout) return "started";
  const planned = Boolean(schedule?.[weekday(dateKey)]);
  if (!planned || (scheduleSince && dateKey < scheduleSince)) return "rest";
  return daysBetween(today, dateKey) < 0 ? "missed" : "planned";
}
