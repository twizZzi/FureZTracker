import { useState } from "react";
import Icon from "../components/Icon";
import { Chips, Empty, Segmented } from "../components/ui";
import { SearchField } from "../sheets/ExerciseSheets";
import { useExerciseFilter } from "../hooks";
import { useStore, useUi } from "../useStore";
import { WEEKDAYS_SHORT, createDateKey, formatMonth, todayKey, weekday } from "../lib/dates";
import { completedWorkouts, dayStatus } from "../lib/workouts";
import { MUSCLE_GROUPS } from "../data/exercises";
import { createId, createProgram } from "../data/actions";

const SECTIONS = [
  { id: "calendar", title: "Календарь" },
  { id: "programs", title: "Программы" },
  { id: "library", title: "Упражнения" },
];

function Calendar() {
  const { data } = useStore();
  const { openSheet } = useUi();
  const [visible, setVisible] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const today = todayKey();
  const year = visible.getFullYear();
  const month = visible.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const offset = weekday(visible) - 1;
  const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;
  const doneThisMonth = completedWorkouts(data.workouts).filter((workout) => workout.date.startsWith(monthPrefix)).length;

  const shift = (direction) => setVisible(new Date(year, month + direction, 1));

  return (
    <section className="card calendar">
      <div className="calendar-head">
        <button type="button" className="icon-button" onClick={() => shift(-1)} aria-label="Предыдущий месяц">
          <Icon name="chevronLeft" />
        </button>
        <div>
          <strong>{formatMonth(visible)}</strong>
          <span>{doneThisMonth ? `${doneThisMonth} трен.` : "нет тренировок"}</span>
        </div>
        <button type="button" className="icon-button" onClick={() => shift(1)} aria-label="Следующий месяц">
          <Icon name="chevronRight" />
        </button>
      </div>

      <div className="calendar-grid weekdays">
        {WEEKDAYS_SHORT.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>

      <div className="calendar-grid">
        {Array.from({ length: offset }, (_, index) => (
          <span key={`empty-${index}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, index) => {
          const day = index + 1;
          const key = createDateKey(year, month, day);
          const status = dayStatus({ dateKey: key, workouts: data.workouts, schedule: data.schedule, scheduleSince: data.scheduleSince, today });
          return (
            <button
              type="button"
              key={key}
              className={`calendar-day ${status} ${key === today ? "today" : ""}`}
              onClick={() => openSheet("day", { dateKey: key })}
            >
              {day}
            </button>
          );
        })}
      </div>

      <div className="legend">
        <span>
          <i className="done" /> выполнено
        </span>
        <span>
          <i className="planned" /> по плану
        </span>
        <span>
          <i className="missed" /> пропуск
        </span>
      </div>
    </section>
  );
}

function Programs() {
  const { data, update } = useStore();
  const { openSheet } = useUi();

  const create = () => {
    const program = { id: createId("program"), title: "Новая программа", restSeconds: data.profile.restSeconds || 90, exercises: [] };
    update(createProgram, program);
    openSheet("program", { programId: program.id });
  };

  return (
    <>
      <div className="stack">
        {data.programs.map((program) => {
          const days = Object.entries(data.schedule)
            .filter(([, id]) => id === program.id)
            .map(([day]) => WEEKDAYS_SHORT[Number(day) - 1]);
          const groups = [
            ...new Set(
              program.exercises
                .map((item) => data.exercises.find((exercise) => exercise.id === item.exerciseId)?.muscleGroup)
                .filter(Boolean)
            ),
          ];
          return (
            <button type="button" key={program.id} className="card program-card" onClick={() => openSheet("program", { programId: program.id })}>
              <div>
                <h3>{program.title}</h3>
                <p className="muted">
                  {program.exercises.length} упр. · {program.exercises.reduce((sum, item) => sum + (Number(item.sets) || 0), 0)} подходов
                  {groups.length ? ` · ${groups.slice(0, 3).join(", ")}` : ""}
                </p>
              </div>
              <div className="program-days">
                {days.length ? days.map((day) => <span key={day}>{day}</span>) : <em>без расписания</em>}
              </div>
            </button>
          );
        })}
      </div>
      {data.programs.length === 0 && <Empty title="Программ пока нет" text="Собери свою: упражнения, подходы, повторы и дни недели." />}
      <button type="button" className="add-button" onClick={create}>
        <Icon name="plus" /> Новая программа
      </button>
    </>
  );
}

function Library() {
  const { data } = useStore();
  const { openSheet } = useUi();
  const { query, setQuery, group, setGroup, filtered } = useExerciseFilter(data.exercises);

  return (
    <>
      <div className="sticky-tools flat">
        <SearchField value={query} onChange={setQuery} placeholder={`Поиск среди ${data.exercises.length} упражнений`} />
        <Chips
          options={[{ id: "all", title: "Все" }, ...MUSCLE_GROUPS.map((item) => ({ id: item, title: item }))]}
          value={group}
          onChange={setGroup}
        />
      </div>
      <div className="list">
        {filtered.map((exercise) => (
          <button type="button" key={exercise.id} className="list-item" onClick={() => openSheet("exercise", { exerciseId: exercise.id })}>
            <div>
              <strong>{exercise.name}</strong>
              <span>
                {exercise.muscleGroup}
                {exercise.custom ? " · своё" : ""}
              </span>
            </div>
            <Icon name="chevronRight" size={18} />
          </button>
        ))}
      </div>
      {filtered.length === 0 && <Empty title="Ничего не нашлось" />}
      <button
        type="button"
        className="add-button"
        onClick={() => openSheet("exerciseEdit", { initialName: query.trim(), initialGroup: group === "all" ? "" : group })}
      >
        <Icon name="plus" /> Своё упражнение
      </button>
    </>
  );
}

export default function WorkoutsScreen() {
  const [section, setSection] = useState("calendar");

  return (
    <>
      <header className="screen-header">
        <h1>Тренировки</h1>
      </header>
      <Segmented options={SECTIONS} value={section} onChange={setSection} className="screen-tabs" />
      {section === "calendar" && <Calendar />}
      {section === "programs" && <Programs />}
      {section === "library" && <Library />}
    </>
  );
}
