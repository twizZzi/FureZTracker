import { useEffect, useState } from "react";
import "./App.css";

/* =========================
   1. Initial data
========================= */

const initialData = {
  trainingDays: [1, 3, 5],
  completedWorkouts: [],
  completedSets: {},
  foodEntries: [],

  profile: {
    weight: "",
    height: "",
    goal: "maintain",
  },

  workouts: {
    1: {
      title: "Грудь / Трицепс",
      exercises: [
        { name: "Жим лёжа", sets: 4, reps: "8–10", weight: "60 кг" },
        { name: "Разводка гантелей", sets: 3, reps: "10–12", weight: "14 кг" },
      ],
    },

    3: {
      title: "Спина / Бицепс",
      exercises: [
        { name: "Тяга верхнего блока", sets: 4, reps: "10–12", weight: "50 кг" },
      ],
    },

    5: {
      title: "Ноги / Плечи",
      exercises: [
        { name: "Присед", sets: 4, reps: "8–10", weight: "70 кг" },
      ],
    },
  },
};

const weekDaysShort = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

const weekDaysFull = [
  "Понедельник",
  "Вторник",
  "Среда",
  "Четверг",
  "Пятница",
  "Суббота",
  "Воскресенье",
];

const calendarWeekDays = ["M", "T", "W", "T", "F", "S", "S"];

const calorieMultiplier = {
  bulk: 35,
  maintain: 30,
  cut: 25,
};

/* =========================
   2. Helper functions
========================= */

function getDayOfWeek(date) {
  const jsDay = date.getDay();
  return jsDay === 0 ? 7 : jsDay;
}

function createDateKey(year, month, day) {
  const monthNumber = String(month + 1).padStart(2, "0");
  const dayNumber = String(day).padStart(2, "0");

  return `${year}-${monthNumber}-${dayNumber}`;
}

function createSetKey(dateKey, exerciseIndex) {
  return `${dateKey}-exercise-${exerciseIndex}`;
}

function getBmiStatus(bmi) {
  if (!bmi) return "";
  if (bmi < 18.5) return "Недобор";
  if (bmi < 25) return "Норма";
  if (bmi < 30) return "Выше нормы";

  return "Высокий";
}

function areAllWorkoutSetsDone(workout, completedSets, dateKey) {
  if (!workout || workout.exercises.length === 0) return false;

  return workout.exercises.every((exercise, exerciseIndex) => {
    const setKey = createSetKey(dateKey, exerciseIndex);
    const doneSets = completedSets[setKey] || [];

    return doneSets.length >= exercise.sets;
  });
}

/* =========================
   3. Main App
========================= */

export default function App() {
  const [tab, setTab] = useState("workouts");
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedDayPanel, setSelectedDayPanel] = useState("workout");
  const [isWorkoutSettingsOpen, setIsWorkoutSettingsOpen] = useState(false);
  const [settingsDay, setSettingsDay] = useState(1);
  const [editingExerciseIndex, setEditingExerciseIndex] = useState(null);

  const [newExercise, setNewExercise] = useState({
    name: "",
    weight: "",
    sets: 3,
    reps: "",
  });

  const [newFood, setNewFood] = useState({
    name: "",
    calories: "",
    protein: "",
    fat: "",
    carbs: "",
  });

  const [editingFoodId, setEditingFoodId] = useState(null);

  const [data, setData] = useState(() => {
    const savedData = localStorage.getItem("furez-tracker-data");

    if (!savedData) return initialData;

    try {
      return {
        ...initialData,
        ...JSON.parse(savedData),
      };
    } catch {
      return initialData;
    }
  });

  useEffect(() => {
    localStorage.setItem("furez-tracker-data", JSON.stringify(data));
  }, [data]);

  /* =========================
     4. Calendar calculations
  ========================= */

  const today = new Date();

  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();
  const todayDay = today.getDate();

  const monthName = today.toLocaleString("en-US", {
    month: "long",
  });

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
  const calendarOffset = getDayOfWeek(firstDayOfMonth) - 1;

  const days = Array.from({ length: daysInMonth }, (_, index) => index + 1);
  const emptyDays = Array.from({ length: calendarOffset }, (_, index) => index);
  const todayDateKey = createDateKey(currentYear, currentMonth, todayDay);

  /* =========================
     5. Profile and food calculations
  ========================= */

  const profileWeight = Number(data.profile?.weight);
  const profileHeight = Number(data.profile?.height);

  const bmi =
    profileWeight > 0 && profileHeight > 0
      ? profileWeight / (profileHeight / 100) ** 2
      : null;

  const bmiStatus = getBmiStatus(bmi);

  const dailyCalories = profileWeight
    ? Math.round(
        profileWeight * calorieMultiplier[data.profile?.goal || "maintain"]
      )
    : null;

  const dailyProtein = profileWeight ? Math.round(profileWeight * 2) : null;
  const dailyFat = profileWeight ? Math.round(profileWeight * 0.8) : null;

  const dailyCarbs =
    dailyCalories && dailyProtein && dailyFat
      ? Math.round((dailyCalories - dailyProtein * 4 - dailyFat * 9) / 4)
      : null;

  const foodEntries = data.foodEntries || [];

  const todayFoodEntries = foodEntries.filter(
    (item) => item.date === todayDateKey || !item.date
  );

  const eatenCalories = todayFoodEntries.reduce(
    (sum, item) => sum + Number(item.calories || 0),
    0
  );

  const eatenProtein = todayFoodEntries.reduce(
    (sum, item) => sum + Number(item.protein || 0),
    0
  );

  const eatenFat = todayFoodEntries.reduce(
    (sum, item) => sum + Number(item.fat || 0),
    0
  );

  const eatenCarbs = todayFoodEntries.reduce(
    (sum, item) => sum + Number(item.carbs || 0),
    0
  );

  const remainingCalories = dailyCalories ? dailyCalories - eatenCalories : null;

  const foodHistory = foodEntries
    .filter((item) => item.date && item.date !== todayDateKey)
    .reduce((history, item) => {
      const existingDay = history.find((day) => day.date === item.date);

      if (existingDay) {
        existingDay.calories += Number(item.calories || 0);
        existingDay.protein += Number(item.protein || 0);
        existingDay.fat += Number(item.fat || 0);
        existingDay.carbs += Number(item.carbs || 0);

        return history;
      }

      return [
        ...history,
        {
          date: item.date,
          calories: Number(item.calories || 0),
          protein: Number(item.protein || 0),
          fat: Number(item.fat || 0),
          carbs: Number(item.carbs || 0),
        },
      ];
    }, [])
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 7);

  /* =========================
     6. Workout calculations
  ========================= */

  const completedWorkouts = data.completedWorkouts || [];

  const isWorkoutCompleted = (day) => {
    const dateKey = createDateKey(currentYear, currentMonth, day);
    return completedWorkouts.includes(dateKey);
  };

  const scheduledWorkoutDays = days.filter((day) => {
    const date = new Date(currentYear, currentMonth, day);
    const dayOfWeek = getDayOfWeek(date);

    return data.trainingDays.includes(dayOfWeek);
  });

  const streakState = scheduledWorkoutDays.reduce(
    (state, day) => {
      const isCompleted = isWorkoutCompleted(day);
      const isPastWorkout = day < todayDay;

      if (isCompleted) {
        return {
          count: state.count + 1,
          missed: 0,
        };
      }

      if (isPastWorkout) {
        const missed = state.missed + 1;

        return {
          count: missed >= 2 ? 0 : state.count,
          missed,
        };
      }

      return state;
    },
    {
      count: 0,
      missed: 0,
    }
  );

  const visibleStreak =
    streakState.count >= 3 && streakState.missed < 2 ? streakState.count : null;

  const selectedDate = selectedDay
    ? new Date(currentYear, currentMonth, selectedDay)
    : null;

  const selectedDayOfWeek = selectedDate ? getDayOfWeek(selectedDate) : null;

  const selectedDateKey = selectedDay
    ? createDateKey(currentYear, currentMonth, selectedDay)
    : null;

  const workout = selectedDay ? data.workouts[selectedDayOfWeek] : null;

  const selectedDayFoodEntries = selectedDateKey
    ? foodEntries.filter((item) => item.date === selectedDateKey || !item.date)
    : [];

  const selectedDayCalories = selectedDayFoodEntries.reduce(
    (sum, item) => sum + Number(item.calories || 0),
    0
  );

  const selectedDayProtein = selectedDayFoodEntries.reduce(
    (sum, item) => sum + Number(item.protein || 0),
    0
  );

  const selectedDayFat = selectedDayFoodEntries.reduce(
    (sum, item) => sum + Number(item.fat || 0),
    0
  );

  const selectedDayCarbs = selectedDayFoodEntries.reduce(
    (sum, item) => sum + Number(item.carbs || 0),
    0
  );

  const selectedDayRemainingCalories = dailyCalories
    ? dailyCalories - selectedDayCalories
    : null;

  /* =========================
     7. Workout actions
  ========================= */

  const openDay = (day) => {
    setSelectedDay(day);
    setSelectedDayPanel("workout");
  };

  const toggleExerciseSet = (exerciseIndex, setIndex) => {
    if (!selectedDateKey || !workout) return;

    setData((prev) => {
      const completedSets = prev.completedSets || {};
      const completedWorkouts = prev.completedWorkouts || [];

      const setKey = createSetKey(selectedDateKey, exerciseIndex);
      const currentSets = completedSets[setKey] || [];
      const isDone = currentSets.includes(setIndex);

      const updatedSetsForExercise = isDone
        ? currentSets.filter((item) => item !== setIndex)
        : [...currentSets, setIndex];

      const updatedCompletedSets = {
        ...completedSets,
        [setKey]: updatedSetsForExercise,
      };

      const isWorkoutFullyDone = areAllWorkoutSetsDone(
        workout,
        updatedCompletedSets,
        selectedDateKey
      );

      const isWorkoutAlreadyCompleted =
        completedWorkouts.includes(selectedDateKey);

      let updatedCompletedWorkouts = completedWorkouts;

      if (isWorkoutFullyDone && !isWorkoutAlreadyCompleted) {
        updatedCompletedWorkouts = [...completedWorkouts, selectedDateKey];
      }

      if (!isWorkoutFullyDone && isWorkoutAlreadyCompleted) {
        updatedCompletedWorkouts = completedWorkouts.filter(
          (item) => item !== selectedDateKey
        );
      }

      return {
        ...prev,
        completedSets: updatedCompletedSets,
        completedWorkouts: updatedCompletedWorkouts,
      };
    });
  };

  /* =========================
     8. Food actions
  ========================= */

  const resetFoodForm = () => {
    setNewFood({
      name: "",
      calories: "",
      protein: "",
      fat: "",
      carbs: "",
    });

    setEditingFoodId(null);
  };

  const addFoodEntry = () => {
    if (!newFood.name.trim()) return;

    setData((prev) => {
      const currentFoodEntries = prev.foodEntries || [];

      const editingFoodEntry = currentFoodEntries.find(
        (item) => item.id === editingFoodId
      );

      const foodEntry = {
        id: editingFoodId || Date.now(),
        date: editingFoodEntry?.date || todayDateKey,
        name: newFood.name.trim(),
        calories: Number(newFood.calories) || 0,
        protein: Number(newFood.protein) || 0,
        fat: Number(newFood.fat) || 0,
        carbs: Number(newFood.carbs) || 0,
      };

      const updatedFoodEntries =
        editingFoodId === null
          ? [...currentFoodEntries, foodEntry]
          : currentFoodEntries.map((item) =>
              item.id === editingFoodId ? foodEntry : item
            );

      return {
        ...prev,
        foodEntries: updatedFoodEntries,
      };
    });

    resetFoodForm();
  };

  const startEditFoodEntry = (foodEntry) => {
    setEditingFoodId(foodEntry.id);

    setNewFood({
      name: foodEntry.name,
      calories: String(foodEntry.calories),
      protein: String(foodEntry.protein),
      fat: String(foodEntry.fat),
      carbs: String(foodEntry.carbs),
    });
  };

  const deleteFoodEntry = (foodId) => {
    setData((prev) => ({
      ...prev,
      foodEntries: (prev.foodEntries || []).filter((item) => item.id !== foodId),
    }));

    if (editingFoodId === foodId) {
      resetFoodForm();
    }
  };

  const openFoodEditor = (foodEntry) => {
    startEditFoodEntry(foodEntry);
    setTab("food");
  };

  /* =========================
     9. Profile actions
  ========================= */

  const updateProfile = (field, value) => {
    setData((prev) => ({
      ...prev,
      profile: {
        ...(prev.profile || {}),
        [field]: value,
      },
    }));
  };

  /* =========================
     10. Workout settings actions
  ========================= */

  const toggleTrainingDay = (dayNumber) => {
    setData((prev) => {
      const isActive = prev.trainingDays.includes(dayNumber);

      return {
        ...prev,
        trainingDays: isActive
          ? prev.trainingDays.filter((item) => item !== dayNumber)
          : [...prev.trainingDays, dayNumber],
      };
    });
  };

  const updateWorkoutTitle = (title) => {
    setData((prev) => {
      const currentWorkout = prev.workouts[settingsDay] || {
        title: "",
        exercises: [],
      };

      return {
        ...prev,
        trainingDays: prev.trainingDays.includes(settingsDay)
          ? prev.trainingDays
          : [...prev.trainingDays, settingsDay],
        workouts: {
          ...prev.workouts,
          [settingsDay]: {
            ...currentWorkout,
            title,
          },
        },
      };
    });
  };

  const startEditExercise = (exercise, index) => {
    setEditingExerciseIndex(index);

    setNewExercise({
      name: exercise.name,
      weight: exercise.weight,
      sets: exercise.sets,
      reps: exercise.reps,
    });
  };

  const deleteExercise = (exerciseIndex) => {
    setData((prev) => {
      const currentWorkout = prev.workouts[settingsDay];

      if (!currentWorkout) return prev;

      return {
        ...prev,
        workouts: {
          ...prev.workouts,
          [settingsDay]: {
            ...currentWorkout,
            exercises: currentWorkout.exercises.filter(
              (_, index) => index !== exerciseIndex
            ),
          },
        },
      };
    });

    resetExerciseForm();
  };

  const saveExercise = () => {
    if (!newExercise.name.trim()) return;

    setData((prev) => {
      const currentWorkout = prev.workouts[settingsDay] || {
        title: "Новая тренировка",
        exercises: [],
      };

      const exerciseToSave = {
        name: newExercise.name.trim(),
        weight: newExercise.weight.trim() || "без веса",
        sets: Number(newExercise.sets) || 3,
        reps: newExercise.reps.trim() || "8–10",
      };

      const updatedExercises =
        editingExerciseIndex === null
          ? [...currentWorkout.exercises, exerciseToSave]
          : currentWorkout.exercises.map((exercise, index) =>
              index === editingExerciseIndex ? exerciseToSave : exercise
            );

      return {
        ...prev,
        trainingDays: prev.trainingDays.includes(settingsDay)
          ? prev.trainingDays
          : [...prev.trainingDays, settingsDay],
        workouts: {
          ...prev.workouts,
          [settingsDay]: {
            ...currentWorkout,
            exercises: updatedExercises,
          },
        },
      };
    });

    resetExerciseForm();
  };

  const resetExerciseForm = () => {
    setNewExercise({
      name: "",
      weight: "",
      sets: 3,
      reps: "",
    });

    setEditingExerciseIndex(null);
  };

  /* =========================
     11. Render
  ========================= */

  return (
    <div className="app">
      <main className="screen">
        {tab === "workouts" && (
          <WorkoutsPage
            days={days}
            emptyDays={emptyDays}
            monthName={monthName}
            todayDay={todayDay}
            selectedDay={selectedDay}
            selectedDate={selectedDate}
            workout={workout}
            data={data}
            visibleStreak={visibleStreak}
            currentYear={currentYear}
            currentMonth={currentMonth}
            selectedDateKey={selectedDateKey}
            selectedDayPanel={selectedDayPanel}
            setSelectedDayPanel={setSelectedDayPanel}
            selectedDayFoodEntries={selectedDayFoodEntries}
            selectedDayCalories={selectedDayCalories}
            selectedDayProtein={selectedDayProtein}
            selectedDayFat={selectedDayFat}
            selectedDayCarbs={selectedDayCarbs}
            selectedDayRemainingCalories={selectedDayRemainingCalories}
            dailyCalories={dailyCalories}
            dailyProtein={dailyProtein}
            dailyFat={dailyFat}
            dailyCarbs={dailyCarbs}
            isWorkoutSettingsOpen={isWorkoutSettingsOpen}
            settingsDay={settingsDay}
            newExercise={newExercise}
            editingExerciseIndex={editingExerciseIndex}
            openDay={openDay}
            isWorkoutCompleted={isWorkoutCompleted}
            toggleExerciseSet={toggleExerciseSet}
            openFoodEditor={openFoodEditor}
            toggleWorkoutSettings={() =>
              setIsWorkoutSettingsOpen((prev) => !prev)
            }
            closeWorkout={() => setSelectedDay(null)}
            setSettingsDay={setSettingsDay}
            setNewExercise={setNewExercise}
            updateWorkoutTitle={updateWorkoutTitle}
            toggleTrainingDay={toggleTrainingDay}
            startEditExercise={startEditExercise}
            deleteExercise={deleteExercise}
            saveExercise={saveExercise}
            resetExerciseForm={resetExerciseForm}
          />
        )}

        {tab === "food" && (
          <FoodPage
            dailyCalories={dailyCalories}
            dailyProtein={dailyProtein}
            dailyFat={dailyFat}
            dailyCarbs={dailyCarbs}
            eatenCalories={eatenCalories}
            eatenProtein={eatenProtein}
            eatenFat={eatenFat}
            eatenCarbs={eatenCarbs}
            remainingCalories={remainingCalories}
            foodEntries={todayFoodEntries}
            foodHistory={foodHistory}
            newFood={newFood}
            editingFoodId={editingFoodId}
            setNewFood={setNewFood}
            addFoodEntry={addFoodEntry}
            startEditFoodEntry={startEditFoodEntry}
            deleteFoodEntry={deleteFoodEntry}
            resetFoodForm={resetFoodForm}
          />
        )}

        {tab === "profile" && (
          <ProfilePage
            profile={data.profile}
            bmi={bmi}
            bmiStatus={bmiStatus}
            updateProfile={updateProfile}
          />
        )}

        {tab === "settings" && <SettingsPage />}
      </main>

      <BottomNav activeTab={tab} setTab={setTab} />
    </div>
  );
}

/* =========================
   12. Pages
========================= */

function WorkoutsPage({
  days,
  emptyDays,
  monthName,
  todayDay,
  selectedDay,
  selectedDate,
  workout,
  data,
  visibleStreak,
  currentYear,
  currentMonth,
  selectedDateKey,
  selectedDayPanel,
  setSelectedDayPanel,
  selectedDayFoodEntries,
  selectedDayCalories,
  selectedDayProtein,
  selectedDayFat,
  selectedDayCarbs,
  selectedDayRemainingCalories,
  dailyCalories,
  dailyProtein,
  dailyFat,
  dailyCarbs,
  isWorkoutSettingsOpen,
  settingsDay,
  newExercise,
  editingExerciseIndex,
  openDay,
  isWorkoutCompleted,
  toggleExerciseSet,
  openFoodEditor,
  toggleWorkoutSettings,
  closeWorkout,
  setSettingsDay,
  setNewExercise,
  updateWorkoutTitle,
  toggleTrainingDay,
  startEditExercise,
  deleteExercise,
  saveExercise,
  resetExerciseForm,
}) {
  return (
    <>
      <header className="header">
        <div>
          <p className="eyebrow">FureZ Tracker</p>
          <h1>Тренировки</h1>
        </div>

        <div className="header-actions">
          {visibleStreak && (
            <div className="streak-line">
              <strong>{visibleStreak}</strong>
              <span>streak</span>
            </div>
          )}

          <button
            type="button"
            className={`workout-editor-button ${
              isWorkoutSettingsOpen ? "active" : ""
            }`}
            onClick={toggleWorkoutSettings}
          >
            🏋️
            <span>{isWorkoutSettingsOpen ? "Скрыть" : "Настроить"}</span>
          </button>
        </div>
      </header>

      <section className="calendar-card">
        <div className="month-row">
          <span>{monthName}</span>
        </div>

        <div className="calendar-weekdays">
          {calendarWeekDays.map((day, index) => (
            <span key={`${day}-${index}`}>{day}</span>
          ))}
        </div>

        <div className="day-grid">
          {emptyDays.map((item) => (
            <div key={`empty-${item}`} />
          ))}

          {days.map((day) => {
            const date = new Date(currentYear, currentMonth, day);
            const dayOfWeek = getDayOfWeek(date);

            const isTraining = data.trainingDays.includes(dayOfWeek);
            const isCompleted = isWorkoutCompleted(day);
            const isSelected = selectedDay === day;
            const isToday = day === todayDay;

            return (
              <button
                key={day}
                className={[
                  "day-circle",
                  isTraining ? "active" : "",
                  isCompleted ? "completed" : "",
                  isSelected ? "selected" : "",
                  isToday ? "today" : "",
                ].join(" ")}
                onClick={() => openDay(day)}
              >
                {day}
              </button>
            );
          })}
        </div>
      </section>

      {isWorkoutSettingsOpen && (
        <WorkoutSettingsPanel
          data={data}
          settingsDay={settingsDay}
          newExercise={newExercise}
          editingExerciseIndex={editingExerciseIndex}
          setSettingsDay={setSettingsDay}
          setNewExercise={setNewExercise}
          updateWorkoutTitle={updateWorkoutTitle}
          toggleTrainingDay={toggleTrainingDay}
          startEditExercise={startEditExercise}
          deleteExercise={deleteExercise}
          saveExercise={saveExercise}
          resetExerciseForm={resetExerciseForm}
          closeSettings={toggleWorkoutSettings}
        />
      )}

      {selectedDay && !isWorkoutSettingsOpen && (
        <section className="workout-panel">
          <div className="panel-top">
            <div>
              <p className="eyebrow">
                {selectedDate.toLocaleDateString("ru-RU", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </p>

              <h2>{selectedDayPanel === "workout" ? "Тренировка" : "Еда"}</h2>
            </div>

            <button className="icon-button" onClick={closeWorkout}>
              ×
            </button>
          </div>

          <div className="day-panel-tabs">
            <button
              type="button"
              className={selectedDayPanel === "workout" ? "active" : ""}
              onClick={() => setSelectedDayPanel("workout")}
            >
              Тренировка
            </button>

            <button
              type="button"
              className={selectedDayPanel === "food" ? "active" : ""}
              onClick={() => setSelectedDayPanel("food")}
            >
              Еда
            </button>
          </div>

          {selectedDayPanel === "workout" && (
            <>
              {workout ? (
                <>
                  <h3 className="day-panel-title">{workout.title}</h3>

                  {workout.exercises.map((exercise, index) => {
                    const setKey = createSetKey(selectedDateKey, index);
                    const doneSets = data.completedSets?.[setKey] || [];

                    return (
                      <ExerciseCard
                        key={`${exercise.name}-${index}`}
                        exercise={exercise}
                        doneSets={doneSets}
                        onToggleSet={(setIndex) =>
                          toggleExerciseSet(index, setIndex)
                        }
                      />
                    );
                  })}

                  <p
                    className={`workout-status ${
                      isWorkoutCompleted(selectedDay) ? "completed" : ""
                    }`}
                  >
                    {isWorkoutCompleted(selectedDay)
                      ? "✓ Тренировка закрыта"
                      : "Отметь все подходы, чтобы закрыть тренировку"}
                  </p>
                </>
              ) : (
                <p className="profile-hint">
                  На этот день тренировка не запланирована.
                </p>
              )}
            </>
          )}

          {selectedDayPanel === "food" && (
            <div className="day-food-panel">
              <div className="day-food-summary">
                <p className="eyebrow">Калории</p>

                <div className="calories-main small">
                  <strong>{selectedDayCalories}</strong>
                  <span>
                    {dailyCalories ? `/ ${dailyCalories} ккал` : "ккал"}
                  </span>
                </div>

                {dailyCalories && (
                  <>
                    <div className="food-progress compact">
                      <div
                        style={{
                          width: `${Math.min(
                            (selectedDayCalories / dailyCalories) * 100,
                            100
                          )}%`,
                        }}
                      />
                    </div>

                    <p className="food-note">
                      Осталось: {selectedDayRemainingCalories} ккал
                    </p>
                  </>
                )}
              </div>

              <div className="macro-grid">
                <div>
                  <span>Белки</span>
                  <strong>
                    {selectedDayProtein}/{dailyProtein || 0} г
                  </strong>
                </div>

                <div>
                  <span>Жиры</span>
                  <strong>
                    {selectedDayFat}/{dailyFat || 0} г
                  </strong>
                </div>

                <div>
                  <span>Углеводы</span>
                  <strong>
                    {selectedDayCarbs}/{dailyCarbs || 0} г
                  </strong>
                </div>
              </div>

              <p className="day-food-hint">
                Нажми на блюдо, чтобы редактировать.
              </p>

              {selectedDayFoodEntries.length > 0 ? (
                <div className="food-list">
                  {selectedDayFoodEntries.map((item) => (
                    <div className="food-item" key={item.id}>
                      <button
                        type="button"
                        className="food-edit-area"
                        onClick={() => openFoodEditor(item)}
                      >
                        <strong>{item.name}</strong>

                        <p>
                          {item.calories} ккал · Б {item.protein} · Ж{" "}
                          {item.fat} · У {item.carbs}
                        </p>
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="profile-hint">
                  На этот день еда ещё не добавлена.
                </p>
              )}
            </div>
          )}
        </section>
      )}
    </>
  );
}

function WorkoutSettingsPanel({
  data,
  settingsDay,
  newExercise,
  editingExerciseIndex,
  setSettingsDay,
  setNewExercise,
  updateWorkoutTitle,
  toggleTrainingDay,
  startEditExercise,
  deleteExercise,
  saveExercise,
  resetExerciseForm,
  closeSettings,
}) {
  const selectedWorkout = data.workouts[settingsDay];

  return (
    <div className="workout-settings-panel">
      <section className="settings-card">
        <div className="panel-top">
          <div>
            <p className="eyebrow">Редактор</p>
            <h2>Мои тренировки</h2>
          </div>

          <button className="icon-button" onClick={closeSettings}>
            ×
          </button>
        </div>

        <div className="week-row">
  {weekDaysShort.map((dayName, index) => {
    const dayNumber = index + 1;
    const isActive = data.trainingDays.includes(dayNumber);
    const isSelected = settingsDay === dayNumber;

    return (
      <button
        key={dayName}
        type="button"
        className={[
          "week-day",
          isActive ? "active" : "",
          isSelected ? "selected" : "",
        ].join(" ")}
        onClick={() => setSettingsDay(dayNumber)}
      >
        {dayName}
      </button>
    );
  })}
</div>

<div className="training-day-toggle">
  <div>
    <span>Тренировочный день</span>
    <strong>
      {data.trainingDays.includes(settingsDay) ? "Включён" : "Выключен"}
    </strong>
  </div>

  <button
    type="button"
    className={data.trainingDays.includes(settingsDay) ? "active" : ""}
    onClick={() => toggleTrainingDay(settingsDay)}
  >
    {data.trainingDays.includes(settingsDay) ? "Выключить" : "Включить"}
  </button>
</div>

<p className="settings-note">
  Выбери день недели, затем включи или выключи тренировку для этого дня.
</p>
      </section>

      <section className="settings-card day-settings-card">
        <p className="eyebrow">Выбранный день</p>
        <h2>{weekDaysFull[settingsDay - 1]}</h2>

        {selectedWorkout ? (
          <>
            <div className="workout-title-row">
              <span>Тренировка</span>

              <input
                type="text"
                value={selectedWorkout.title || ""}
                onChange={(event) => updateWorkoutTitle(event.target.value)}
                placeholder="Название тренировки"
              />
            </div>

            <div className="settings-exercises-list">
              {selectedWorkout.exercises.map((exercise, index) => {
                const isEditing = editingExerciseIndex === index;

                return (
                  <div
                    className={`settings-exercise-item ${
                      isEditing ? "editing" : ""
                    }`}
                    key={`${exercise.name}-${index}`}
                  >
                    <button
                      type="button"
                      className="exercise-edit-area"
                      onClick={() => startEditExercise(exercise, index)}
                    >
                      <strong>{exercise.name}</strong>

                      <p>
                        {exercise.weight} · {exercise.sets} подхода ·{" "}
                        {exercise.reps}
                      </p>
                    </button>

                    <button
                      type="button"
                      className="delete-exercise-button"
                      onClick={() => deleteExercise(index)}
                      aria-label={`Удалить ${exercise.name}`}
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <p className="settings-note">
            Для этого дня пока нет тренировки. Добавь упражнение ниже.
          </p>
        )}

        <ExerciseForm
          newExercise={newExercise}
          editingExerciseIndex={editingExerciseIndex}
          setNewExercise={setNewExercise}
          saveExercise={saveExercise}
          resetExerciseForm={resetExerciseForm}
        />
      </section>
    </div>
  );
}

function FoodPage({
  dailyCalories,
  dailyProtein,
  dailyFat,
  dailyCarbs,
  eatenCalories,
  eatenProtein,
  eatenFat,
  eatenCarbs,
  remainingCalories,
  foodEntries,
  foodHistory,
  newFood,
  editingFoodId,
  setNewFood,
  addFoodEntry,
  startEditFoodEntry,
  deleteFoodEntry,
  resetFoodForm,
}) {
  return (
    <>
      <header className="header">
        <div>
          <p className="eyebrow">FureZ Tracker</p>
          <h1>Еда</h1>
        </div>
      </header>

      <section className="food-card">
        <p className="eyebrow">Сегодня</p>
        <h2>Калории</h2>

        {dailyCalories ? (
          <>
            <div className="calories-main">
              <strong>{eatenCalories}</strong>
              <span>/ {dailyCalories} ккал</span>
            </div>

            <div className="food-progress">
              <div
                style={{
                  width: `${Math.min(
                    (eatenCalories / dailyCalories) * 100,
                    100
                  )}%`,
                }}
              />
            </div>

            <p className="food-note">Осталось: {remainingCalories} ккал</p>

            <div className="macro-grid">
              <div>
                <span>Белки</span>
                <strong>
                  {eatenProtein}/{dailyProtein} г
                </strong>
              </div>

              <div>
                <span>Жиры</span>
                <strong>
                  {eatenFat}/{dailyFat} г
                </strong>
              </div>

              <div>
                <span>Углеводы</span>
                <strong>
                  {eatenCarbs}/{dailyCarbs} г
                </strong>
              </div>
            </div>
          </>
        ) : (
          <p className="profile-hint">
            Укажи вес в профиле, чтобы рассчитать норму калорий.
          </p>
        )}
      </section>

      <section className="food-card">
        <p className="eyebrow">
          {editingFoodId === null ? "Добавить еду" : "Редактировать еду"}
        </p>

        <div className="food-form">
          <input
            type="text"
            placeholder="Название"
            value={newFood.name}
            onChange={(event) =>
              setNewFood((prev) => ({
                ...prev,
                name: event.target.value,
              }))
            }
          />

          <input
            type="number"
            placeholder="Калории"
            value={newFood.calories}
            onChange={(event) =>
              setNewFood((prev) => ({
                ...prev,
                calories: event.target.value,
              }))
            }
          />

          <div className="form-grid">
            <input
              type="number"
              placeholder="Белки"
              value={newFood.protein}
              onChange={(event) =>
                setNewFood((prev) => ({
                  ...prev,
                  protein: event.target.value,
                }))
              }
            />

            <input
              type="number"
              placeholder="Жиры"
              value={newFood.fat}
              onChange={(event) =>
                setNewFood((prev) => ({
                  ...prev,
                  fat: event.target.value,
                }))
              }
            />
          </div>

          <input
            type="number"
            placeholder="Углеводы"
            value={newFood.carbs}
            onChange={(event) =>
              setNewFood((prev) => ({
                ...prev,
                carbs: event.target.value,
              }))
            }
          />

          <button
            type="button"
            className="primary-button"
            onClick={addFoodEntry}
          >
            {editingFoodId === null ? "Добавить" : "Сохранить"}
          </button>

          {editingFoodId !== null && (
            <button
              type="button"
              className="secondary-button"
              onClick={resetFoodForm}
            >
              Отменить редактирование
            </button>
          )}
        </div>
      </section>

      <section className="food-card">
        <p className="eyebrow">Еда за сегодня</p>

        {foodEntries.length > 0 ? (
          <div className="food-list">
            {foodEntries.map((item) => (
              <div
                className={`food-item ${
                  editingFoodId === item.id ? "editing" : ""
                }`}
                key={item.id}
              >
                <button
                  type="button"
                  className="food-edit-area"
                  onClick={() => startEditFoodEntry(item)}
                >
                  <strong>{item.name}</strong>

                  <p>
                    {item.calories} ккал · Б {item.protein} · Ж {item.fat} · У{" "}
                    {item.carbs}
                  </p>
                </button>

                <button
                  type="button"
                  className="delete-exercise-button"
                  onClick={() => deleteFoodEntry(item.id)}
                  aria-label={`Удалить ${item.name}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="profile-hint">Сегодня еда ещё не добавлена.</p>
        )}
      </section>

      <section className="food-card">
        <p className="eyebrow">История</p>

        {foodHistory.length > 0 ? (
          <div className="food-list">
            {foodHistory.map((day) => (
              <div className="food-history-item" key={day.date}>
                <div>
                  <strong>
                    {new Date(day.date).toLocaleDateString("ru-RU", {
                      day: "numeric",
                      month: "long",
                    })}
                  </strong>

                  <p>
                    Б {day.protein} · Ж {day.fat} · У {day.carbs}
                  </p>
                </div>

                <span>{day.calories} ккал</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="profile-hint">История пока пустая.</p>
        )}
      </section>
    </>
  );
}

function ProfilePage({ profile, bmi, bmiStatus, updateProfile }) {
  return (
    <>
      <header className="header">
        <div>
          <p className="eyebrow">FureZ Tracker</p>
          <h1>Профиль</h1>
        </div>
      </header>

      <section className="profile-card">
        <p className="eyebrow">Мои параметры</p>

        <div className="profile-fields">
          <label className="profile-field">
            <span>Вес</span>

            <div className="profile-input-row">
              <input
                type="number"
                value={profile?.weight || ""}
                onChange={(event) =>
                  updateProfile("weight", event.target.value)
                }
                placeholder="75"
              />

              <strong>кг</strong>
            </div>
          </label>

          <label className="profile-field">
            <span>Рост</span>

            <div className="profile-input-row">
              <input
                type="number"
                value={profile?.height || ""}
                onChange={(event) =>
                  updateProfile("height", event.target.value)
                }
                placeholder="180"
              />

              <strong>см</strong>
            </div>
          </label>
        </div>
      </section>

      <section className="profile-card">
        <p className="eyebrow">Цель</p>

        <div className="goal-row">
          <button
            type="button"
            className={profile?.goal === "bulk" ? "active" : ""}
            onClick={() => updateProfile("goal", "bulk")}
          >
            Набор
          </button>

          <button
            type="button"
            className={profile?.goal === "cut" ? "active" : ""}
            onClick={() => updateProfile("goal", "cut")}
          >
            Сушка
          </button>

          <button
            type="button"
            className={profile?.goal === "maintain" ? "active" : ""}
            onClick={() => updateProfile("goal", "maintain")}
          >
            Поддержание
          </button>
        </div>
      </section>

      <section className="profile-card bmi-card">
        <p className="eyebrow">Индекс массы тела</p>

        {bmi ? (
          <div className="bmi-row">
            <strong>{bmi.toFixed(1)}</strong>
            <span>{bmiStatus}</span>
          </div>
        ) : (
          <p className="profile-hint">
            Укажи вес и рост, чтобы рассчитать ИМТ.
          </p>
        )}
      </section>
    </>
  );
}

function SettingsPage() {
  return (
    <>
      <header className="header">
        <div>
          <p className="eyebrow">FureZ Tracker</p>
          <h1>Настройки</h1>
        </div>
      </header>

      <section className="settings-card">
        <p className="eyebrow">Mini App</p>
        <h2>Параметры приложения</h2>

        <div className="settings-list">

          

         <div className="settings-row">
  <div>
    <strong>Версия</strong>
    <p>0.1.0</p>
    <span className="made-by">Made with love by FureZ</span>
  </div>
</div>
          </div>
      </section>

    </>
  );
}

/* =========================
   13. Small components
========================= */

function ExerciseCard({ exercise, doneSets, onToggleSet }) {
  return (
    <article className="exercise-card">
      <div>
        <h3>{exercise.name}</h3>

        <p>
          {exercise.weight} · {exercise.sets} подхода · {exercise.reps}
        </p>
      </div>

      <div className="sets-row">
        {Array.from({ length: exercise.sets }, (_, index) => (
          <button
            key={index}
            className={`set-circle ${doneSets.includes(index) ? "done" : ""}`}
            onClick={() => onToggleSet(index)}
            aria-label={`Подход ${index + 1}`}
          />
        ))}
      </div>
    </article>
  );
}

function ExerciseForm({
  newExercise,
  editingExerciseIndex,
  setNewExercise,
  saveExercise,
  resetExerciseForm,
}) {
  return (
    <div className="add-exercise-form">
      <h3>
        {editingExerciseIndex === null
          ? "Добавить упражнение"
          : "Редактировать упражнение"}
      </h3>

      <input
        type="text"
        placeholder="Название"
        value={newExercise.name}
        onChange={(event) =>
          setNewExercise((prev) => ({
            ...prev,
            name: event.target.value,
          }))
        }
      />

      <div className="form-grid">
        <input
          type="text"
          placeholder="Вес"
          value={newExercise.weight}
          onChange={(event) =>
            setNewExercise((prev) => ({
              ...prev,
              weight: event.target.value,
            }))
          }
        />

        <input
          type="number"
          placeholder="Подходы"
          value={newExercise.sets}
          onChange={(event) =>
            setNewExercise((prev) => ({
              ...prev,
              sets: event.target.value,
            }))
          }
        />
      </div>

      <input
        type="text"
        placeholder="Повторы, например 8–10"
        value={newExercise.reps}
        onChange={(event) =>
          setNewExercise((prev) => ({
            ...prev,
            reps: event.target.value,
          }))
        }
      />

      <button type="button" className="primary-button" onClick={saveExercise}>
        {editingExerciseIndex === null ? "Добавить" : "Сохранить"}
      </button>

      {editingExerciseIndex !== null && (
        <button
          type="button"
          className="secondary-button"
          onClick={resetExerciseForm}
        >
          Отменить редактирование
        </button>
      )}
    </div>
  );
}

function BottomNav({ activeTab, setTab }) {
  return (
    <nav className="bottom-nav">
      <button
        className={activeTab === "workouts" ? "nav-active" : ""}
        onClick={() => setTab("workouts")}
      >
        Тренировки
      </button>

      <button
        className={activeTab === "food" ? "nav-active" : ""}
        onClick={() => setTab("food")}
      >
        Еда
      </button>

      <button
        className={activeTab === "profile" ? "nav-active" : ""}
        onClick={() => setTab("profile")}
      >
        Профиль
      </button>

      <button
        className={activeTab === "settings" ? "nav-active" : ""}
        onClick={() => setTab("settings")}
      >
        Настройки
      </button>
    </nav>
  );
}