import { useMemo } from "react";
import Sheet from "../components/Sheet";
import Icon from "../components/Icon";
import { useStore, useUi } from "../useStore";
import { useMainButton, useNow } from "../hooks";
import { confirmAction, haptic } from "../telegram";
import { formatDayLong, formatDuration, formatMinutes, todayKey } from "../lib/dates";
import {
  formatWeight,
  lowerBound,
  newRecords,
  parseNumber,
  previousSets,
  workoutProgress,
  workoutVolume,
} from "../lib/workouts";
import {
  addExercisesToWorkout,
  addSet,
  deleteWorkout,
  finishWorkout,
  moveWorkoutExercise,
  removeSet,
  removeWorkoutExercise,
  renameWorkout,
  reopenWorkout,
  setExerciseRest,
  updateSet,
} from "../data/actions";

const REST_OPTIONS = [0, 45, 60, 90, 120, 180, 240];

function restLabel(seconds) {
  if (!seconds) return "без отдыха";
  if (seconds < 60) return `${seconds} с`;
  return seconds % 60 ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}` : `${seconds / 60} мин`;
}

function NumberCell({ value, placeholder, onCommit, decimal = false, label }) {
  // Uncontrolled while typing ("62." must survive); remounts when the stored value changes.
  return (
    <input
      key={value ?? "empty"}
      className="set-input"
      type="text"
      inputMode={decimal ? "decimal" : "numeric"}
      enterKeyHint="done"
      aria-label={label}
      defaultValue={value ?? ""}
      placeholder={placeholder ?? "—"}
      onFocus={(event) => event.target.select()}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
      }}
      onBlur={(event) => {
        const next = parseNumber(event.target.value);
        if (next !== (value ?? null)) onCommit(next);
      }}
    />
  );
}

function ExerciseCard({ exercise, index, count, dateKey, isActive }) {
  const { data, update } = useStore();
  const { openSheet, startRest } = useUi();

  const previous = useMemo(
    () => previousSets(data.workouts, exercise.exerciseId, dateKey),
    [data.workouts, exercise.exerciseId, dateKey]
  );

  const placeholders = exercise.sets.map((set, setIndex) => {
    const prev = previous[setIndex] || previous[previous.length - 1];
    const before = exercise.sets[setIndex - 1];
    return {
      weight: prev?.weight ?? before?.weight ?? exercise.targetWeight ?? null,
      reps: prev?.reps ?? before?.reps ?? lowerBound(exercise.targetReps),
    };
  });

  const toggleDone = (set, setIndex) => {
    if (set.done) {
      update(updateSet, dateKey, exercise.id, setIndex, { done: false });
      return;
    }
    const weight = set.weight ?? placeholders[setIndex].weight;
    const reps = set.reps ?? placeholders[setIndex].reps;
    update(updateSet, dateKey, exercise.id, setIndex, { done: true, weight, reps });
    haptic.success();
    if (isActive) startRest(exercise.restSeconds);
  };

  const openSetActions = (setIndex) =>
    openSheet("actions", {
      title: `Подход ${setIndex + 1}`,
      actions: [
        {
          label: "Удалить подход",
          destructive: true,
          onClick: () => update(removeSet, dateKey, exercise.id, setIndex),
        },
      ],
    });

  const openExerciseActions = () =>
    openSheet("actions", {
      title: exercise.name,
      actions: [
        { label: "История и рекорды", onClick: () => openSheet("exercise", { exerciseId: exercise.exerciseId }) },
        {
          label: `Отдых: ${restLabel(exercise.restSeconds)}`,
          onClick: () =>
            openSheet("actions", {
              title: "Отдых между подходами",
              actions: REST_OPTIONS.map((seconds) => ({
                label: `${restLabel(seconds)}${seconds === exercise.restSeconds ? " ✓" : ""}`,
                onClick: () => update(setExerciseRest, dateKey, exercise.id, seconds),
              })),
            }),
        },
        index > 0 && { label: "Переместить выше", onClick: () => update(moveWorkoutExercise, dateKey, exercise.id, -1) },
        index < count - 1 && {
          label: "Переместить ниже",
          onClick: () => update(moveWorkoutExercise, dateKey, exercise.id, 1),
        },
        {
          label: "Удалить упражнение",
          destructive: true,
          onClick: () => update(removeWorkoutExercise, dateKey, exercise.id),
        },
      ].filter(Boolean),
    });

  const doneCount = exercise.sets.filter((set) => set.done).length;
  const target = [
    exercise.targetReps && `${exercise.sets.length} × ${exercise.targetReps}`,
    exercise.targetWeight && `${formatWeight(exercise.targetWeight)} кг`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className={`card exercise-card ${doneCount === exercise.sets.length && doneCount > 0 ? "complete" : ""}`}>
      <div className="exercise-card-head">
        <button
          type="button"
          className="exercise-card-title"
          onClick={() => openSheet("exercise", { exerciseId: exercise.exerciseId })}
        >
          <strong>{exercise.name}</strong>
          <span>
            {[exercise.muscleGroup, target && `цель ${target}`].filter(Boolean).join(" · ")}
          </span>
        </button>
        <button type="button" className="rest-chip" onClick={openExerciseActions} aria-label="Действия">
          <Icon name="timer" size={14} />
          {restLabel(exercise.restSeconds)}
        </button>
        <button type="button" className="icon-button small" onClick={openExerciseActions} aria-label="Ещё">
          <Icon name="more" />
        </button>
      </div>

      <div className="set-grid set-grid-head" aria-hidden="true">
        <span>Сет</span>
        <span>Прошлый</span>
        <span>кг</span>
        <span>Повт.</span>
        <span />
      </div>

      {exercise.sets.map((set, setIndex) => {
        const prev = previous[setIndex];
        return (
          <div className={`set-grid set-row ${set.done ? "done" : ""}`} key={setIndex}>
            <button type="button" className="set-number" onClick={() => openSetActions(setIndex)}>
              {setIndex + 1}
            </button>
            <button
              type="button"
              className="set-previous"
              disabled={!prev || set.done}
              onClick={() =>
                update(updateSet, dateKey, exercise.id, setIndex, { weight: prev.weight, reps: prev.reps })
              }
            >
              {prev ? `${formatWeight(prev.weight)}×${prev.reps ?? "—"}` : "—"}
            </button>
            <NumberCell
              decimal
              label={`Вес, подход ${setIndex + 1}`}
              value={set.weight}
              placeholder={placeholders[setIndex].weight !== null ? formatWeight(placeholders[setIndex].weight) : "—"}
              onCommit={(weight) => update(updateSet, dateKey, exercise.id, setIndex, { weight })}
            />
            <NumberCell
              label={`Повторы, подход ${setIndex + 1}`}
              value={set.reps}
              placeholder={placeholders[setIndex].reps ?? "—"}
              onCommit={(reps) => update(updateSet, dateKey, exercise.id, setIndex, { reps })}
            />
            <button
              type="button"
              className={`set-check ${set.done ? "done" : ""}`}
              onClick={() => toggleDone(set, setIndex)}
              aria-label={set.done ? "Отменить подход" : "Подход выполнен"}
              aria-pressed={set.done}
            >
              <Icon name="check" size={18} strokeWidth={2.6} />
            </button>
          </div>
        );
      })}

      <button type="button" className="ghost-button" onClick={() => update(addSet, dateKey, exercise.id)}>
        <Icon name="plus" size={16} /> Подход
      </button>
    </article>
  );
}

export default function WorkoutSheet({ dateKey, sheetKey }) {
  const { data, update } = useStore();
  const { openSheet, closeSheet, stopRest } = useUi();
  const workout = data.workouts[dateKey];
  const isFinished = Boolean(workout?.finishedAt);
  const isActive = Boolean(workout) && !isFinished && dateKey === todayKey();
  const now = useNow(1000, isActive && Boolean(workout?.startedAt));

  const progress = workout ? workoutProgress(workout) : { done: 0, total: 0 };
  const volume = workout ? workoutVolume(workout) : 0;

  const finish = async () => {
    if (!workout) return;
    if (progress.done === 0) {
      const ok = await confirmAction("Ни один подход не отмечен. Удалить эту тренировку?");
      if (!ok) return;
      stopRest();
      closeSheet(sheetKey);
      update(deleteWorkout, dateKey);
      return;
    }
    if (progress.done < progress.total) {
      const ok = await confirmAction(
        `Отмечено ${progress.done} из ${progress.total} подходов. Неотмеченные будут удалены. Завершить?`
      );
      if (!ok) return;
    }
    const finished = finishWorkout(data, dateKey).workouts[dateKey];
    const records = newRecords(data.workouts, finished);
    update(finishWorkout, dateKey);
    stopRest();
    haptic.success();
    closeSheet(sheetKey);
    openSheet("summary", { dateKey, records });
  };

  useMainButton({
    text: "Завершить тренировку",
    onClick: finish,
    visible: Boolean(workout) && !isFinished && progress.total > 0,
  });

  if (!workout) {
    return (
      <Sheet title="Тренировка" onClose={() => closeSheet(sheetKey)}>
        <p className="muted">Тренировка удалена.</p>
      </Sheet>
    );
  }

  const openMenu = () =>
    openSheet("actions", {
      title: workout.title,
      actions: [
        {
          label: "Переименовать",
          onClick: () =>
            openSheet("prompt", {
              title: "Название тренировки",
              value: workout.title,
              onSubmit: (title) => update(renameWorkout, dateKey, title || "Тренировка"),
            }),
        },
        isFinished && { label: "Продолжить тренировку", onClick: () => update(reopenWorkout, dateKey) },
        {
          label: "Удалить тренировку",
          destructive: true,
          onClick: async () => {
            const ok = await confirmAction("Удалить тренировку целиком?");
            if (!ok) return;
            stopRest();
            closeSheet(sheetKey);
            update(deleteWorkout, dateKey);
          },
        },
      ].filter(Boolean),
    });

  const elapsed = workout.startedAt ? (isFinished ? workout.finishedAt : now) - workout.startedAt : null;

  return (
    <Sheet
      title={workout.title}
      subtitle={formatDayLong(dateKey)}
      onClose={() => closeSheet(sheetKey)}
      headerRight={
        <button type="button" className="icon-button" onClick={openMenu} aria-label="Меню тренировки">
          <Icon name="more" />
        </button>
      }
    >
      <div className="workout-stats">
        <div>
          <span>{isFinished ? "Длительность" : "Время"}</span>
          <strong>{elapsed !== null ? (isFinished ? formatMinutes(elapsed) : formatDuration(elapsed)) : "—"}</strong>
        </div>
        <div>
          <span>Подходы</span>
          <strong>
            {progress.done}/{progress.total}
          </strong>
        </div>
        <div>
          <span>Объём</span>
          <strong>{volume.toLocaleString("ru-RU")} кг</strong>
        </div>
      </div>

      {isFinished && (
        <div className="notice">
          <Icon name="check" size={16} /> Тренировка завершена. Можно поправить цифры.
        </div>
      )}

      <div className="stack">
        {workout.exercises.map((exercise, index) => (
          <ExerciseCard
            key={exercise.id}
            exercise={exercise}
            index={index}
            count={workout.exercises.length}
            dateKey={dateKey}
            isActive={isActive}
          />
        ))}
      </div>

      <button
        type="button"
        className="add-button"
        onClick={() =>
          openSheet("exercisePicker", {
            title: "Добавить упражнения",
            onSelect: (ids) => update(addExercisesToWorkout, dateKey, ids),
          })
        }
      >
        <Icon name="plus" /> Добавить упражнение
      </button>
    </Sheet>
  );
}
