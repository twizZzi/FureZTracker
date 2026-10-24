import Sheet from "../components/Sheet";
import Icon from "../components/Icon";
import { Chips, Empty, Stepper } from "../components/ui";
import { useStore, useUi } from "../useStore";
import { useMainButton } from "../hooks";
import { confirmAction } from "../telegram";
import { WEEKDAYS_SHORT, todayKey } from "../lib/dates";
import { parseNumber } from "../lib/workouts";
import {
  addProgramExercises,
  deleteProgram,
  duplicateProgram,
  moveProgramExercise,
  removeProgramExercise,
  startWorkout,
  toggleScheduleDay,
  updateProgram,
  updateProgramExercise,
} from "../data/actions";

const REST_CHOICES = [60, 90, 120, 180].map((seconds) => ({
  id: seconds,
  title: seconds < 120 ? `${seconds} с` : `${seconds / 60} мин`,
}));

export default function ProgramSheet({ sheetKey, programId }) {
  const { data, update } = useStore();
  const { closeSheet, openSheet } = useUi();
  const program = data.programs.find((item) => item.id === programId);
  const exercisesById = Object.fromEntries(data.exercises.map((exercise) => [exercise.id, exercise]));

  const startToday = () => {
    closeSheet(sheetKey);
    const today = todayKey();
    if (!data.workouts[today]) update(startWorkout, today, programId);
    openSheet("workout", { dateKey: today });
  };

  useMainButton({
    text: "Начать сегодня",
    onClick: startToday,
    visible: Boolean(program) && program.exercises.length > 0 && !data.workouts[todayKey()],
  });

  if (!program) return null;

  const scheduledDays = Object.entries(data.schedule)
    .filter(([, id]) => id === program.id)
    .map(([day]) => Number(day));

  const openMenu = () =>
    openSheet("actions", {
      title: program.title,
      actions: [
        {
          label: "Переименовать",
          onClick: () =>
            openSheet("prompt", {
              title: "Название программы",
              value: program.title,
              onSubmit: (title) => update(updateProgram, program.id, { title: title || "Программа" }),
            }),
        },
        { label: "Дублировать", onClick: () => update(duplicateProgram, program.id) },
        {
          label: "Удалить программу",
          destructive: true,
          onClick: async () => {
            const ok = await confirmAction(`Удалить программу «${program.title}»? Прошлые тренировки останутся.`);
            if (!ok) return;
            closeSheet(sheetKey);
            update(deleteProgram, program.id);
          },
        },
      ],
    });

  return (
    <Sheet
      title={program.title}
      subtitle="Программа"
      onClose={() => closeSheet(sheetKey)}
      headerRight={
        <button type="button" className="icon-button" onClick={openMenu} aria-label="Меню программы">
          <Icon name="more" />
        </button>
      }
    >
      <section className="card">
        <p className="eyebrow">Дни недели</p>
        <div className="weekday-toggle">
          {WEEKDAYS_SHORT.map((label, index) => {
            const day = index + 1;
            const owner = data.schedule[day];
            const isMine = owner === program.id;
            const otherTitle = owner && !isMine ? data.programs.find((item) => item.id === owner)?.title : null;
            return (
              <button
                key={label}
                type="button"
                className={`${isMine ? "active" : ""} ${otherTitle ? "taken" : ""}`}
                title={otherTitle ? `Сейчас: ${otherTitle}` : undefined}
                onClick={() => update(toggleScheduleDay, day, program.id)}
              >
                {label}
              </button>
            );
          })}
        </div>
        <p className="hint">
          {scheduledDays.length
            ? "В эти дни программа появится на экране «Сегодня» и в календаре."
            : "Выбери дни — и программа будет ждать тебя в эти дни."}
        </p>
        <p className="field-caption">Отдых между подходами</p>
        <Chips
          options={REST_CHOICES}
          value={program.restSeconds || 90}
          onChange={(restSeconds) => update(updateProgram, program.id, { restSeconds })}
        />
      </section>

      <div className="stack">
        {program.exercises.map((item, index) => {
          const exercise = exercisesById[item.exerciseId];
          return (
            <article className="card program-exercise" key={`${item.exerciseId}-${index}`}>
              <div className="program-exercise-head">
                <span className="order-badge">{index + 1}</span>
                <button
                  type="button"
                  className="exercise-card-title"
                  onClick={() => openSheet("exercise", { exerciseId: item.exerciseId })}
                >
                  <strong>{exercise?.name || "Удалённое упражнение"}</strong>
                  <span>{exercise?.muscleGroup || ""}</span>
                </button>
                <div className="reorder">
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => update(moveProgramExercise, program.id, index, -1)}
                    aria-label="Выше"
                  >
                    <Icon name="up" size={16} />
                  </button>
                  <button
                    type="button"
                    disabled={index === program.exercises.length - 1}
                    onClick={() => update(moveProgramExercise, program.id, index, 1)}
                    aria-label="Ниже"
                  >
                    <Icon name="down" size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => update(removeProgramExercise, program.id, index)}
                    aria-label="Убрать из программы"
                  >
                    <Icon name="close" size={16} />
                  </button>
                </div>
              </div>

              <div className="program-exercise-fields">
                <label>
                  <span>Подходы</span>
                  <Stepper
                    value={Number(item.sets) || 1}
                    onChange={(sets) => update(updateProgramExercise, program.id, index, { sets })}
                  />
                </label>
                <label>
                  <span>Повторы</span>
                  <input
                    className="field small"
                    value={item.targetReps}
                    placeholder="8–12"
                    onChange={(event) =>
                      update(updateProgramExercise, program.id, index, { targetReps: event.target.value })
                    }
                  />
                </label>
                <label>
                  <span>Вес, кг</span>
                  <input
                    className="field small"
                    inputMode="decimal"
                    defaultValue={item.targetWeight ?? ""}
                    placeholder="—"
                    onBlur={(event) =>
                      update(updateProgramExercise, program.id, index, {
                        targetWeight: parseNumber(event.target.value),
                      })
                    }
                  />
                </label>
              </div>
            </article>
          );
        })}
      </div>

      {program.exercises.length === 0 && (
        <Empty title="Пока пусто" text="Добавь упражнения — подходы, повторы и вес можно задать для каждого." />
      )}

      <button
        type="button"
        className="add-button"
        onClick={() =>
          openSheet("exercisePicker", {
            title: "Добавить в программу",
            onSelect: (ids) => update(addProgramExercises, program.id, ids),
          })
        }
      >
        <Icon name="plus" /> Добавить упражнение
      </button>
    </Sheet>
  );
}
