import Sheet from "../components/Sheet";
import Icon from "../components/Icon";
import { useStore, useUi } from "../useStore";
import { formatDayLong, weekday } from "../lib/dates";
import { isWorkoutDone, workoutProgress, workoutVolume } from "../lib/workouts";
import { sumMacros } from "../lib/nutrition";
import { setNote } from "../data/actions";

export default function DaySheet({ sheetKey, dateKey }) {
  const { data, update } = useStore();
  const { closeSheet, openSheet, setTab, setFoodDate } = useUi();
  const workout = data.workouts[dateKey];
  const plannedProgram = data.programs.find((program) => program.id === data.schedule[weekday(dateKey)]);
  const food = sumMacros(data.food.filter((item) => item.date === dateKey));

  const openFood = () => {
    setFoodDate(dateKey);
    setTab("food");
    closeSheet(sheetKey);
  };

  return (
    <Sheet variant="bottom" title={formatDayLong(dateKey)} onClose={() => closeSheet(sheetKey)}>
      {workout ? (
        <button type="button" className="day-row" onClick={() => openSheet("workout", { dateKey })}>
          <span className={`day-dot ${isWorkoutDone(workout) ? "done" : "started"}`} />
          <div>
            <strong>{workout.title}</strong>
            <span>
              {workoutProgress(workout).done}/{workoutProgress(workout).total} подходов ·{" "}
              {workoutVolume(workout).toLocaleString("ru-RU")} кг
            </span>
          </div>
          <Icon name="chevronRight" size={18} />
        </button>
      ) : (
        <button type="button" className="day-row" onClick={() => openSheet("startWorkout", { dateKey })}>
          <span className="day-dot planned" />
          <div>
            <strong>{plannedProgram ? `По плану: ${plannedProgram.title}` : "Тренировки нет"}</strong>
            <span>Записать тренировку на этот день</span>
          </div>
          <Icon name="plus" size={18} />
        </button>
      )}

      <button type="button" className="day-row" onClick={openFood}>
        <Icon name="food" size={18} />
        <div>
          <strong>{food.kcal ? `${food.kcal} ккал` : "Питание не записано"}</strong>
          <span>{food.kcal ? `Б ${food.p} · Ж ${food.f} · У ${food.c}` : "Открыть дневник питания"}</span>
        </div>
        <Icon name="chevronRight" size={18} />
      </button>

      <label className="field-label">
        <span>Заметка дня</span>
        <textarea
          className="field note-field"
          value={data.notes[dateKey] || ""}
          onChange={(event) => update(setNote, dateKey, event.target.value)}
          placeholder="Самочувствие, сон, настроение…"
          rows={3}
        />
      </label>
    </Sheet>
  );
}
