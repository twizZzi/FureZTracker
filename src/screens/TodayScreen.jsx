import Icon from "../components/Icon";
import { MacroBar, Ring } from "../components/ui";
import { useStore, useUi } from "../useStore";
import { useMainButton } from "../hooks";
import { getTelegramUser } from "../telegram";
import { WEEKDAYS_SHORT, addDays, formatDayLong, todayKey, weekKeys, weekday } from "../lib/dates";
import { computeTargets, mealByTime, sumMacros } from "../lib/nutrition";
import { dayStatus, formatWeight, isWorkoutDone, weekStreak, workoutProgress, workoutVolume } from "../lib/workouts";
import { startWorkout } from "../data/actions";

function greeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 5) return "Доброй ночи";
  if (hour < 12) return "Доброе утро";
  if (hour < 18) return "Добрый день";
  return "Добрый вечер";
}

export default function TodayScreen() {
  const { data, update } = useStore();
  const { openSheet, setTab, setFoodDate } = useUi();
  const today = todayKey();
  const user = getTelegramUser();

  const workout = data.workouts[today];
  const plannedProgram = data.programs.find((program) => program.id === data.schedule[weekday(today)]);
  const targets = computeTargets(data.profile);
  const eaten = sumMacros(data.food.filter((item) => item.date === today));
  const streak = weekStreak(data.workouts, data.schedule, data.scheduleSince);

  const weightKeys = Object.keys(data.bodyWeight).sort();
  const lastWeightKey = weightKeys[weightKeys.length - 1];
  const lastWeight = lastWeightKey ? data.bodyWeight[lastWeightKey] : null;
  const weekAgoKey = weightKeys.filter((key) => key <= addDays(today, -7)).pop();
  const weightDelta = lastWeight && weekAgoKey ? Math.round((lastWeight - data.bodyWeight[weekAgoKey]) * 10) / 10 : null;

  const openWorkout = () => openSheet("workout", { dateKey: today });
  const startPlanned = () => {
    update(startWorkout, today, plannedProgram.id);
    openWorkout();
  };

  const mainAction = workout
    ? isWorkoutDone(workout)
      ? null
      : { text: "Продолжить тренировку", onClick: openWorkout }
    : plannedProgram
      ? { text: `Начать: ${plannedProgram.title}`, onClick: startPlanned }
      : { text: "Начать тренировку", onClick: () => openSheet("startWorkout", { dateKey: today }) };

  useMainButton({
    text: mainAction?.text || "",
    onClick: mainAction?.onClick || (() => {}),
    visible: Boolean(mainAction),
  });

  const addFood = () => {
    setFoodDate(today);
    openSheet("foodSearch", { dateKey: today, meal: mealByTime() });
  };

  return (
    <>
      <header className="screen-header">
        <div>
          <p className="eyebrow">{formatDayLong(today)}</p>
          <h1>
            {greeting()}
            {user?.first_name ? `, ${user.first_name}` : ""}
          </h1>
        </div>
        <button type="button" className="avatar-button" onClick={() => openSheet("profile")} aria-label="Профиль">
          {user?.photo_url ? <img src={user.photo_url} alt="" /> : <Icon name="user" />}
        </button>
      </header>

      <section className="card week-card">
        <div className="week-strip">
          {weekKeys(today).map((key, index) => {
            const status = dayStatus({ dateKey: key, workouts: data.workouts, schedule: data.schedule, scheduleSince: data.scheduleSince, today });
            return (
              <button
                type="button"
                key={key}
                className={`week-day ${status} ${key === today ? "today" : ""}`}
                onClick={() => openSheet("day", { dateKey: key })}
              >
                <span>{WEEKDAYS_SHORT[index]}</span>
                <i>{Number(key.slice(8))}</i>
              </button>
            );
          })}
        </div>
        <div className="week-meta">
          <span>
            <Icon name="flame" size={16} /> {streak > 0 ? `${streak} нед. подряд` : "Серия ещё не началась"}
          </span>
        </div>
      </section>

      <section className="card workout-today">
        <p className="eyebrow">Тренировка</p>
        {workout ? (
          <button type="button" className="workout-today-body" onClick={openWorkout}>
            <div>
              <h2>{workout.title}</h2>
              <p className="muted">
                {isWorkoutDone(workout)
                  ? `Готово · ${workoutProgress(workout).done} подходов · ${workoutVolume(workout).toLocaleString("ru-RU")} кг`
                  : `В процессе · ${workoutProgress(workout).done}/${workoutProgress(workout).total} подходов`}
              </p>
            </div>
            <span className={`status-pill ${isWorkoutDone(workout) ? "done" : ""}`}>
              {isWorkoutDone(workout) ? <Icon name="check" size={16} strokeWidth={3} /> : <Icon name="chevronRight" size={18} />}
            </span>
          </button>
        ) : plannedProgram ? (
          <button type="button" className="workout-today-body" onClick={() => openSheet("program", { programId: plannedProgram.id })}>
            <div>
              <h2>{plannedProgram.title}</h2>
              <p className="muted">
                По плану · {plannedProgram.exercises.length} упр. ·{" "}
                {plannedProgram.exercises.reduce((sum, item) => sum + (Number(item.sets) || 0), 0)} подходов
              </p>
            </div>
            <span className="status-pill">
              <Icon name="chevronRight" size={18} />
            </span>
          </button>
        ) : (
          <div className="workout-today-body static">
            <div>
              <h2>День отдыха</h2>
              <p className="muted">
                {Object.keys(data.schedule).length
                  ? "По расписанию сегодня отдых."
                  : "Задай дни недели в программе — и она будет ждать тебя здесь."}
              </p>
            </div>
          </div>
        )}
      </section>

      <section className="card nutrition-today">
        <div className="card-head">
          <p className="eyebrow">Питание</p>
          <button type="button" className="text-button" onClick={() => setTab("food")}>
            Дневник
          </button>
        </div>
        <div className="nutrition-today-body">
          <Ring value={eaten.kcal} max={targets.kcal || 0} size={118} stroke={11}>
            <strong>{targets.kcal ? Math.max(targets.kcal - eaten.kcal, 0) : eaten.kcal}</strong>
            <span>{targets.kcal ? (eaten.kcal > targets.kcal ? "сверх нормы" : "осталось") : "ккал"}</span>
          </Ring>
          <div className="macro-column">
            <MacroBar label="Белки" current={eaten.p} target={targets.p} />
            <MacroBar label="Жиры" current={eaten.f} target={targets.f} />
            <MacroBar label="Углеводы" current={eaten.c} target={targets.c} />
          </div>
        </div>
        {!targets.kcal && (
          <button type="button" className="notice notice-button" onClick={() => openSheet("profile")}>
            Заполни профиль, чтобы рассчитать норму КБЖУ <Icon name="chevronRight" size={16} />
          </button>
        )}
        <button type="button" className="secondary-button" onClick={addFood}>
          <Icon name="plus" size={16} /> Добавить еду
        </button>
      </section>

      <section className="card weight-today">
        <div>
          <p className="eyebrow">Вес тела</p>
          <h2>{lastWeight ? `${formatWeight(lastWeight)} кг` : "—"}</h2>
          <p className="muted">
            {weightDelta !== null
              ? `${weightDelta > 0 ? "+" : ""}${formatWeight(weightDelta)} кг за неделю`
              : lastWeightKey === today
                ? "Записано сегодня"
                : "Взвешивайся пару раз в неделю"}
          </p>
        </div>
        <button type="button" className="round-button" onClick={() => openSheet("weight")} aria-label="Записать вес">
          <Icon name="plus" />
        </button>
      </section>
    </>
  );
}
