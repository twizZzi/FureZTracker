import { useEffect, useMemo, useState } from "react";
import "./App.css";

/* =========================
   Storage
========================= */

const STORAGE_KEY = "furez-tracker-v2-data";

/* =========================
   Initial data
========================= */

const initialData = {
  profile: {
  weight: "",
  height: "",
  gender: "male",
  age: "",
  goal: "maintain",
  activity: "light",
},

  exerciseLibrary: [
    { id: "bench-press", name: "Жим лёжа", muscleGroup: "Грудь" },
    { id: "dumbbell-fly", name: "Разводка гантелей", muscleGroup: "Грудь" },
    { id: "lat-pulldown", name: "Тяга верхнего блока", muscleGroup: "Спина" },
    { id: "squat", name: "Присед", muscleGroup: "Ноги" },
    { id: "biceps-curl", name: "Подъём на бицепс", muscleGroup: "Бицепс" },
    { id: "triceps-extension", name: "Разгибание на трицепс", muscleGroup: "Трицепс" },
    { id: "shoulder-press", name: "Жим гантелей сидя", muscleGroup: "Плечи" },
  ],

  workoutTemplates: [
    {
      id: "chest-triceps",
      title: "Грудь / Трицепс",
      exercises: [
        { exerciseId: "bench-press", sets: 4, reps: "8–10", weight: "60 кг" },
        { exerciseId: "dumbbell-fly", sets: 3, reps: "10–12", weight: "14 кг" },
        { exerciseId: "triceps-extension", sets: 3, reps: "10–12", weight: "20 кг" },
      ],
    },
    {
      id: "back-biceps",
      title: "Спина / Бицепс",
      exercises: [
        { exerciseId: "lat-pulldown", sets: 4, reps: "10–12", weight: "50 кг" },
        { exerciseId: "biceps-curl", sets: 3, reps: "10–12", weight: "12 кг" },
      ],
    },
    {
      id: "legs-shoulders",
      title: "Ноги / Плечи",
      exercises: [
        { exerciseId: "squat", sets: 4, reps: "8–10", weight: "70 кг" },
        { exerciseId: "shoulder-press", sets: 3, reps: "8–10", weight: "16 кг" },
      ],
    },
  ],

  workoutLogs: {},
  foodEntries: [],
  dayNotes: {},
};

/* =========================
   Constants
========================= */

const weekDaysShort = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];


const profileGoalOptions = [
  {
    id: "bulk",
    title: "Набор",
    description: "Профицит",
    calorieModifier: 1.12,
    proteinPerKg: 2,
    fatPerKg: 1,
  },
  {
    id: "cut",
    title: "Сушка",
    description: "Дефицит",
    calorieModifier: 0.85,
    proteinPerKg: 2.2,
    fatPerKg: 0.8,
  },
  {
    id: "maintain",
    title: "Поддержание",
    description: "Стабильно",
    calorieModifier: 1,
    proteinPerKg: 1.8,
    fatPerKg: 0.9,
  },
];

const profileActivityOptions = [
  {
    id: "minimal",
    title: "Минимальная",
    description: "Мало движения",
    multiplier: 1.2,
  },
  {
    id: "light",
    title: "Лёгкая",
    description: "1–3 тренировки",
    multiplier: 1.375,
  },
  {
    id: "medium",
    title: "Средняя",
    description: "3–5 тренировок",
    multiplier: 1.55,
  },
  {
    id: "high",
    title: "Высокая",
    description: "5–6 тренировок",
    multiplier: 1.725,
  },
  {
    id: "very-high",
    title: "Очень высокая",
    description: "Тяжёлый режим",
    multiplier: 1.9,
  },
];

const MUSCLE_GROUPS = [
  "Грудь",
  "Спина",
  "Ноги",
  "Плечи",
  "Бицепс",
  "Трицепс",
  "Пресс",
  "Ягодицы",
  "Кардио",
  "Другое",
];

const DEFAULT_MUSCLE_GROUP = "Другое";

/* =========================
   Helpers
========================= */

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getDayOfWeek(date) {
  const jsDay = date.getDay();
  return jsDay === 0 ? 7 : jsDay;
}

function createDateKey(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getBmiStatus(bmi) {
  if (!bmi) return "";
  if (bmi < 18.5) return "Недобор";
  if (bmi < 25) return "Норма";
  if (bmi < 30) return "Выше нормы";
  return "Высокий";
}

function normalizeData(savedData) {
  return {
    ...initialData,
    ...(savedData || {}),
    profile: {
      ...initialData.profile,
      ...(savedData?.profile || {}),
    },
    exerciseLibrary: savedData?.exerciseLibrary || initialData.exerciseLibrary,
    workoutTemplates: savedData?.workoutTemplates || initialData.workoutTemplates,
    workoutLogs: savedData?.workoutLogs || {},
    foodEntries: savedData?.foodEntries || [],
    dayNotes: savedData?.dayNotes || {},
  };
}

function isWorkoutCompleted(workoutLog) {
  if (!workoutLog || workoutLog.exercises.length === 0) return false;

  const allSets = workoutLog.exercises.flatMap((exercise) => exercise.sets || []);
  if (allSets.length === 0) return false;

  return allSets.every((set) => set.done);
}

/* =========================
   App
========================= */

export default function App() {
  const [tab, setTab] = useState("workouts");
  const [visibleDate, setVisibleDate] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedDayPanel, setSelectedDayPanel] = useState("workout");
  const [isTemplateManagerOpen, setIsTemplateManagerOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState("chest-triceps");
  const [editingFoodId, setEditingFoodId] = useState(null);

  const [newFood, setNewFood] = useState({
    name: "",
    calories: "",
    protein: "",
    fat: "",
    carbs: "",
  });

  const [newExerciseName, setNewExerciseName] = useState("");
  const [newExerciseGroup, setNewExerciseGroup] = useState("");

  const [data, setData] = useState(() => {
    const savedData = localStorage.getItem(STORAGE_KEY);

    if (!savedData) return initialData;

    try {
      return normalizeData(JSON.parse(savedData));
    } catch {
      return initialData;
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  /* =========================
     Calendar
  ========================= */

  const today = new Date();

  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth();
  const todayDay = today.getDate();

  const currentYear = visibleDate.getFullYear();
  const currentMonth = visibleDate.getMonth();

  const isCurrentMonth = currentYear === todayYear && currentMonth === todayMonth;

  const monthName = `${visibleDate.toLocaleString("ru-RU", {
  month: "long",
})} ${visibleDate.getFullYear()}`;

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
  const calendarOffset = getDayOfWeek(firstDayOfMonth) - 1;

  const days = Array.from({ length: daysInMonth }, (_, index) => index + 1);
  const emptyDays = Array.from({ length: calendarOffset }, (_, index) => index);

  const todayDateKey = createDateKey(todayYear, todayMonth, todayDay);

  const selectedDateKey = selectedDay
    ? createDateKey(currentYear, currentMonth, selectedDay)
    : null;

  const selectedDate = selectedDay
    ? new Date(currentYear, currentMonth, selectedDay)
    : null;

  const selectedWorkoutLog = selectedDateKey
    ? data.workoutLogs[selectedDateKey]
    : null;

  const selectedDayNote = selectedDateKey
    ? data.dayNotes?.[selectedDateKey] || ""
    : "";

  const changeMonth = (direction) => {
    setVisibleDate((prev) => {
      return new Date(prev.getFullYear(), prev.getMonth() + direction, 1);
    });

    setSelectedDay(null);
    setSelectedDayPanel("workout");
    setIsTemplateManagerOpen(false);
  };

  const openDay = (day) => {
    setSelectedDay(day);
    setSelectedDayPanel("workout");
    setIsTemplateManagerOpen(false);
  };

  /* =========================
     Profile / calories
  ========================= */

  const profileWeight = Number(data.profile?.weight);
const profileHeight = Number(data.profile?.height);
const profileAge = Number(data.profile?.age);
const profileGender = data.profile?.gender || "male";
const profileGoal = data.profile?.goal || "maintain";
const profileActivity = data.profile?.activity || "light";

const bmi =
  profileWeight > 0 && profileHeight > 0
    ? profileWeight / (profileHeight / 100) ** 2
    : null;

const bmiStatus = getBmiStatus(bmi);

const selectedGoal =
  profileGoalOptions.find((goal) => goal.id === profileGoal) ||
  profileGoalOptions.find((goal) => goal.id === "maintain");

const selectedActivity =
  profileActivityOptions.find((activity) => activity.id === profileActivity) ||
  profileActivityOptions.find((activity) => activity.id === "light");

const bmr =
  profileWeight > 0 && profileHeight > 0 && profileAge > 0
    ? Math.round(
        10 * profileWeight +
          6.25 * profileHeight -
          5 * profileAge +
          (profileGender === "male" ? 5 : -161)
      )
    : null;

const tdee =
  bmr && selectedActivity
    ? Math.round(bmr * selectedActivity.multiplier)
    : null;

const dailyCalories =
  tdee && selectedGoal
    ? Math.round(tdee * selectedGoal.calorieModifier)
    : null;

const dailyProtein =
  profileWeight > 0 && selectedGoal
    ? Math.round(profileWeight * selectedGoal.proteinPerKg)
    : null;

const dailyFat =
  profileWeight > 0 && selectedGoal
    ? Math.round(profileWeight * selectedGoal.fatPerKg)
    : null;

const dailyCarbs =
  dailyCalories && dailyProtein && dailyFat
    ? Math.max(
        0,
        Math.round((dailyCalories - dailyProtein * 4 - dailyFat * 9) / 4)
      )
    : null;

  /* =========================
     Food
  ========================= */

  const foodEntries = data.foodEntries || [];

  const todayFoodEntries = foodEntries.filter(
    (item) => item.date === todayDateKey || !item.date
  );

  const selectedDayFoodEntries = selectedDateKey
    ? foodEntries.filter((item) => item.date === selectedDateKey || !item.date)
    : [];

  const getFoodTotals = (entries) => {
    return entries.reduce(
      (totals, item) => ({
        calories: totals.calories + Number(item.calories || 0),
        protein: totals.protein + Number(item.protein || 0),
        fat: totals.fat + Number(item.fat || 0),
        carbs: totals.carbs + Number(item.carbs || 0),
      }),
      {
        calories: 0,
        protein: 0,
        fat: 0,
        carbs: 0,
      }
    );
  };

  const todayFoodTotals = getFoodTotals(todayFoodEntries);
  const selectedFoodTotals = getFoodTotals(selectedDayFoodEntries);

  const remainingCalories = dailyCalories
    ? dailyCalories - todayFoodTotals.calories
    : null;

  const selectedDayRemainingCalories = dailyCalories
    ? dailyCalories - selectedFoodTotals.calories
    : null;

  const foodHistory = foodEntries
  .filter((item) => item.date && item.date !== todayDateKey)
  .reduce((history, item) => {
    const existingDay = history.find((day) => day.date === item.date);

    if (existingDay) {
      existingDay.calories += Number(item.calories || 0);
      existingDay.protein += Number(item.protein || 0);
      existingDay.fat += Number(item.fat || 0);
      existingDay.carbs += Number(item.carbs || 0);
      existingDay.items.push(item);

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
        items: [item],
      },
    ];
  }, [])
  .sort((a, b) => b.date.localeCompare(a.date))
  .slice(0, 7);

  /* =========================
     Workout stats
  ========================= */

  const monthWorkoutLogs = Object.values(data.workoutLogs || {}).filter((log) => {
    return log.date?.startsWith(
      `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`
    );
  });

  const visibleStreak = monthWorkoutLogs.filter(isWorkoutCompleted).length || null;

  const completedWorkoutDates = Object.entries(data.workoutLogs || {})
    .filter(([, log]) => isWorkoutCompleted(log))
    .map(([dateKey]) => dateKey);

  /* =========================
     Workout creation
  ========================= */

  const getExerciseFromLibrary = (exerciseId) => {
    return data.exerciseLibrary.find((exercise) => exercise.id === exerciseId);
  };

  const buildWorkoutFromTemplate = (template, dateKey) => {
    return {
      id: createId("workout"),
      date: dateKey,
      templateId: template?.id || null,
      title: template?.title || "Новая тренировка",
      exercises: (template?.exercises || []).map((templateExercise) => {
        const libraryExercise = getExerciseFromLibrary(templateExercise.exerciseId);

        return {
          id: createId("logged-exercise"),
          exerciseId: templateExercise.exerciseId,
          name: libraryExercise?.name || "Упражнение",
          muscleGroup: libraryExercise?.muscleGroup || "",
          sets: Array.from(
            { length: Number(templateExercise.sets) || 1 },
            () => ({
              weight: templateExercise.weight || "",
              reps: templateExercise.reps || "",
              done: false,
            })
          ),
        };
      }),
    };
  };

  const createWorkoutForSelectedDay = (templateId = null) => {
    if (!selectedDateKey) return;

    const template = data.workoutTemplates.find((item) => item.id === templateId);

    const workoutLog = buildWorkoutFromTemplate(template, selectedDateKey);

    setData((prev) => ({
      ...prev,
      workoutLogs: {
        ...(prev.workoutLogs || {}),
        [selectedDateKey]: workoutLog,
      },
    }));
  };

  const deleteSelectedWorkout = () => {
    if (!selectedDateKey) return;

    const isConfirmed = window.confirm("Удалить тренировку на этот день?");

    if (!isConfirmed) return;

    setData((prev) => {
      const updatedLogs = { ...(prev.workoutLogs || {}) };
      delete updatedLogs[selectedDateKey];

      return {
        ...prev,
        workoutLogs: updatedLogs,
      };
    });
  };

  const updateWorkoutLogTitle = (title) => {
    if (!selectedDateKey) return;

    setData((prev) => ({
      ...prev,
      workoutLogs: {
        ...(prev.workoutLogs || {}),
        [selectedDateKey]: {
          ...prev.workoutLogs[selectedDateKey],
          title,
        },
      },
    }));
  };

  const updateWorkoutSet = (exerciseIndex, setIndex, field, value) => {
    if (!selectedDateKey) return;

    setData((prev) => {
      const currentWorkout = prev.workoutLogs[selectedDateKey];

      if (!currentWorkout) return prev;

      const updatedExercises = currentWorkout.exercises.map((exercise, currentExerciseIndex) => {
        if (currentExerciseIndex !== exerciseIndex) return exercise;

        return {
          ...exercise,
          sets: exercise.sets.map((set, currentSetIndex) => {
            if (currentSetIndex !== setIndex) return set;

            return {
              ...set,
              [field]: value,
            };
          }),
        };
      });

      return {
        ...prev,
        workoutLogs: {
          ...(prev.workoutLogs || {}),
          [selectedDateKey]: {
            ...currentWorkout,
            exercises: updatedExercises,
          },
        },
      };
    });
  };

  const addSetToExercise = (exerciseIndex) => {
    if (!selectedDateKey) return;

    setData((prev) => {
      const currentWorkout = prev.workoutLogs[selectedDateKey];

      if (!currentWorkout) return prev;

      const updatedExercises = currentWorkout.exercises.map((exercise, index) => {
        if (index !== exerciseIndex) return exercise;

        const lastSet = exercise.sets[exercise.sets.length - 1] || {
          weight: "",
          reps: "",
          done: false,
        };

        return {
          ...exercise,
          sets: [
            ...exercise.sets,
            {
              weight: lastSet.weight,
              reps: lastSet.reps,
              done: false,
            },
          ],
        };
      });

      return {
        ...prev,
        workoutLogs: {
          ...(prev.workoutLogs || {}),
          [selectedDateKey]: {
            ...currentWorkout,
            exercises: updatedExercises,
          },
        },
      };
    });
  };

  const removeSetFromExercise = (exerciseIndex, setIndex) => {
    if (!selectedDateKey) return;

    setData((prev) => {
      const currentWorkout = prev.workoutLogs[selectedDateKey];

      if (!currentWorkout) return prev;

      const updatedExercises = currentWorkout.exercises.map((exercise, index) => {
        if (index !== exerciseIndex) return exercise;

        return {
          ...exercise,
          sets: exercise.sets.filter((_, currentSetIndex) => currentSetIndex !== setIndex),
        };
      });

      return {
        ...prev,
        workoutLogs: {
          ...(prev.workoutLogs || {}),
          [selectedDateKey]: {
            ...currentWorkout,
            exercises: updatedExercises,
          },
        },
      };
    });
  };

  const addExerciseToSelectedWorkout = (exerciseId) => {
    if (!selectedDateKey || !exerciseId) return;

    const libraryExercise = getExerciseFromLibrary(exerciseId);

    if (!libraryExercise) return;

    setData((prev) => {
      const currentWorkout = prev.workoutLogs[selectedDateKey];

      if (!currentWorkout) return prev;

      return {
        ...prev,
        workoutLogs: {
          ...(prev.workoutLogs || {}),
          [selectedDateKey]: {
            ...currentWorkout,
            exercises: [
              ...currentWorkout.exercises,
              {
                id: createId("logged-exercise"),
                exerciseId,
                name: libraryExercise.name,
                muscleGroup: libraryExercise.muscleGroup,
                sets: [
                  {
                    weight: "",
                    reps: "",
                    done: false,
                  },
                ],
              },
            ],
          },
        },
      };
    });
  };

  const removeExerciseFromSelectedWorkout = (exerciseIndex) => {
    if (!selectedDateKey) return;

    setData((prev) => {
      const currentWorkout = prev.workoutLogs[selectedDateKey];

      if (!currentWorkout) return prev;

      return {
        ...prev,
        workoutLogs: {
          ...(prev.workoutLogs || {}),
          [selectedDateKey]: {
            ...currentWorkout,
            exercises: currentWorkout.exercises.filter((_, index) => index !== exerciseIndex),
          },
        },
      };
    });
  };

  /* =========================
     Previous exercise info
  ========================= */

  const getPreviousExerciseInfo = (exerciseId) => {
    if (!selectedDateKey || !exerciseId) return null;

    const previousLogs = Object.entries(data.workoutLogs || {})
      .filter(([dateKey]) => dateKey < selectedDateKey)
      .flatMap(([dateKey, workoutLog]) => {
        return (workoutLog.exercises || [])
          .filter((exercise) => exercise.exerciseId === exerciseId)
          .map((exercise) => ({
            dateKey,
            exercise,
          }));
      })
      .sort((a, b) => b.dateKey.localeCompare(a.dateKey));

    return previousLogs[0] || null;
  };

  /* =========================
     Templates
  ========================= */

  const selectedTemplate = data.workoutTemplates.find(
    (template) => template.id === selectedTemplateId
  );

  const createTemplate = () => {
    const template = {
      id: createId("template"),
      title: "Новый сет",
      exercises: [],
    };

    setData((prev) => ({
      ...prev,
      workoutTemplates: [...(prev.workoutTemplates || []), template],
    }));

    setSelectedTemplateId(template.id);
  };

  const updateTemplateTitle = (title) => {
    setData((prev) => ({
      ...prev,
      workoutTemplates: prev.workoutTemplates.map((template) =>
        template.id === selectedTemplateId
          ? {
              ...template,
              title,
            }
          : template
      ),
    }));
  };

  const addExerciseToTemplate = (exerciseId) => {
    if (!exerciseId) return;

    setData((prev) => ({
      ...prev,
      workoutTemplates: prev.workoutTemplates.map((template) => {
        if (template.id !== selectedTemplateId) return template;

        return {
          ...template,
          exercises: [
            ...template.exercises,
            {
              exerciseId,
              sets: 3,
              reps: "8–10",
              weight: "",
            },
          ],
        };
      }),
    }));
  };

  const updateTemplateExercise = (exerciseIndex, field, value) => {
    setData((prev) => ({
      ...prev,
      workoutTemplates: prev.workoutTemplates.map((template) => {
        if (template.id !== selectedTemplateId) return template;

        return {
          ...template,
          exercises: template.exercises.map((exercise, index) =>
            index === exerciseIndex
              ? {
                  ...exercise,
                  [field]: field === "sets" ? Number(value) || 1 : value,
                }
              : exercise
          ),
        };
      }),
    }));
  };

  const removeExerciseFromTemplate = (exerciseIndex) => {
    setData((prev) => ({
      ...prev,
      workoutTemplates: prev.workoutTemplates.map((template) => {
        if (template.id !== selectedTemplateId) return template;

        return {
          ...template,
          exercises: template.exercises.filter((_, index) => index !== exerciseIndex),
        };
      }),
    }));
  };

  const deleteTemplate = () => {
    if (!selectedTemplate) return;

    const isConfirmed = window.confirm(`Удалить сет "${selectedTemplate.title}"?`);

    if (!isConfirmed) return;

    setData((prev) => {
      const updatedTemplates = prev.workoutTemplates.filter(
        (template) => template.id !== selectedTemplateId
      );

      return {
        ...prev,
        workoutTemplates: updatedTemplates,
      };
    });

    const nextTemplate = data.workoutTemplates.find(
      (template) => template.id !== selectedTemplateId
    );

    setSelectedTemplateId(nextTemplate?.id || null);
  };

  /* =========================
     Exercise library
  ========================= */

  const createLibraryExercise = () => {
  const cleanName = newExerciseName.trim();

  if (!cleanName || !newExerciseGroup) return;

  const exercise = {
    id: createId("exercise"),
    name: cleanName,
    muscleGroup: newExerciseGroup,
  };

  setData((prev) => ({
    ...prev,
    exerciseLibrary: [...(prev.exerciseLibrary || []), exercise],
  }));

  setNewExerciseName("");
  setNewExerciseGroup("");
};  

const createLibraryExerciseFromPicker = (
  exerciseName,
  muscleGroup = DEFAULT_MUSCLE_GROUP
) => {
  const cleanName = exerciseName.trim();

  const cleanGroup = MUSCLE_GROUPS.includes(muscleGroup)
    ? muscleGroup
    : DEFAULT_MUSCLE_GROUP;

  if (!cleanName) return;

  const newExercise = {
    id: createId("exercise"),
    name: cleanName,
    muscleGroup: cleanGroup,
  };

  setData((prev) => ({
    ...prev,
    exerciseLibrary: [...(prev.exerciseLibrary || []), newExercise],

    workoutTemplates: (prev.workoutTemplates || []).map((template) => {
      if (template.id !== selectedTemplateId) return template;

      return {
        ...template,
        exercises: [
          ...(template.exercises || []),
          {
            exerciseId: newExercise.id,
            sets: 3,
            reps: "8–10",
            weight: "",
          },
        ],
      };
    }),
  }));
};

  const deleteLibraryExercise = (exerciseId) => {
  const exercise = data.exerciseLibrary.find((item) => item.id === exerciseId);

  if (!exercise) return;

  const isConfirmed = window.confirm(
    `Удалить упражнение "${exercise.name}" из библиотеки и всех сетов? Старые тренировки не изменятся.`
  );

  if (!isConfirmed) return;

  setData((prev) => ({
    ...prev,
    exerciseLibrary: (prev.exerciseLibrary || []).filter(
      (item) => item.id !== exerciseId
    ),
    workoutTemplates: (prev.workoutTemplates || []).map((template) => ({
      ...template,
      exercises: (template.exercises || []).filter(
        (templateExercise) => templateExercise.exerciseId !== exerciseId
      ),
    })),
  }));
};

  /* =========================
     Notes
  ========================= */

  const updateDayNote = (note) => {
    if (!selectedDateKey) return;

    setData((prev) => ({
      ...prev,
      dayNotes: {
        ...(prev.dayNotes || {}),
        [selectedDateKey]: note,
      },
    }));
  };

  /* =========================
     Food actions
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

  const addFoodEntry = (targetDateKey = todayDateKey) => {
  if (!newFood.name.trim()) return;

  setData((prev) => {
    const currentFoodEntries = prev.foodEntries || [];

    const editingFoodEntry = currentFoodEntries.find(
      (item) => item.id === editingFoodId
    );

    const foodEntry = {
      id: editingFoodId || Date.now(),
      date: editingFoodEntry?.date || targetDateKey,
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
     Profile
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
     Render
  ========================= */

  return (
        <div className="app">
          <div className="app-brand">
            FureZ Tracker
          </div>

    <main className="screen">
        {tab === "workouts" && (
          <WorkoutsPage
            days={days}
            emptyDays={emptyDays}
            monthName={monthName}
            todayDay={todayDay}
            isCurrentMonth={isCurrentMonth}
            selectedDay={selectedDay}
            selectedDate={selectedDate}
            selectedDateKey={selectedDateKey}
            selectedDayPanel={selectedDayPanel}
            selectedWorkoutLog={selectedWorkoutLog}
            selectedDayFoodEntries={selectedDayFoodEntries}
            selectedFoodTotals={selectedFoodTotals}
            newFood={newFood}
            editingFoodId={editingFoodId}
            setNewFood={setNewFood}
            addFoodEntry={addFoodEntry}
            startEditFoodEntry={startEditFoodEntry}
            deleteFoodEntry={deleteFoodEntry}
            resetFoodForm={resetFoodForm}
            selectedDayRemainingCalories={selectedDayRemainingCalories}
            selectedDayNote={selectedDayNote}
            dailyCalories={dailyCalories}
            dailyProtein={dailyProtein}
            dailyFat={dailyFat}
            dailyCarbs={dailyCarbs}
            visibleStreak={visibleStreak}
            completedWorkoutDates={completedWorkoutDates}
            workoutTemplates={data.workoutTemplates}
            exerciseLibrary={data.exerciseLibrary}
            selectedTemplate={selectedTemplate}
            selectedTemplateId={selectedTemplateId}
            isTemplateManagerOpen={isTemplateManagerOpen}
            newExerciseName={newExerciseName}
            newExerciseGroup={newExerciseGroup}
            currentYear={currentYear}
            currentMonth={currentMonth}
            changeMonth={changeMonth}
            openDay={openDay}
            setSelectedDayPanel={setSelectedDayPanel}
            setIsTemplateManagerOpen={setIsTemplateManagerOpen}
            createWorkoutForSelectedDay={createWorkoutForSelectedDay}
            deleteSelectedWorkout={deleteSelectedWorkout}
            updateWorkoutLogTitle={updateWorkoutLogTitle}
            updateWorkoutSet={updateWorkoutSet}
            addSetToExercise={addSetToExercise}
            removeSetFromExercise={removeSetFromExercise}
            addExerciseToSelectedWorkout={addExerciseToSelectedWorkout}
            removeExerciseFromSelectedWorkout={removeExerciseFromSelectedWorkout}
            getPreviousExerciseInfo={getPreviousExerciseInfo}
            openFoodEditor={openFoodEditor}
            updateDayNote={updateDayNote}
            setSelectedTemplateId={setSelectedTemplateId}
            createTemplate={createTemplate}
            updateTemplateTitle={updateTemplateTitle}
            addExerciseToTemplate={addExerciseToTemplate}
            updateTemplateExercise={updateTemplateExercise}
            removeExerciseFromTemplate={removeExerciseFromTemplate}
            deleteTemplate={deleteTemplate}
            setNewExerciseName={setNewExerciseName}
            setNewExerciseGroup={setNewExerciseGroup}
            createLibraryExercise={createLibraryExercise}
            deleteLibraryExercise={deleteLibraryExercise}
            createLibraryExerciseFromPicker={createLibraryExerciseFromPicker}
            closeDay={() => setSelectedDay(null)}
          />
        )}

        {tab === "food" && (
          <FoodPage
            dailyCalories={dailyCalories}
            dailyProtein={dailyProtein}
            dailyFat={dailyFat}
            dailyCarbs={dailyCarbs}
            eatenCalories={todayFoodTotals.calories}
            eatenProtein={todayFoodTotals.protein}
            eatenFat={todayFoodTotals.fat}
            eatenCarbs={todayFoodTotals.carbs}
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

      </main>

      <BottomNav activeTab={tab} setTab={setTab} />
    </div>
  );
}

/* =========================
   Workouts page
========================= */

function WorkoutsPage({
  days,
  emptyDays,
  monthName,
  todayDay,
  isCurrentMonth,
  selectedDay,
  selectedDate,
  selectedDateKey,
  selectedDayPanel,
  selectedWorkoutLog,
  selectedDayFoodEntries,
  selectedFoodTotals,
  selectedDayRemainingCalories,
  selectedDayNote,
  newFood,
  editingFoodId,
  setNewFood,
  addFoodEntry,
  startEditFoodEntry,
  deleteFoodEntry,
  resetFoodForm, 
  dailyCalories,
  dailyProtein,
  dailyFat,
  dailyCarbs,
  visibleStreak,
  completedWorkoutDates,
  workoutTemplates,
  exerciseLibrary,
  selectedTemplate,
  selectedTemplateId,
  isTemplateManagerOpen,
  newExerciseName,
  newExerciseGroup,
  currentYear,
  currentMonth,
  changeMonth,
  openDay,
  setSelectedDayPanel,
  setIsTemplateManagerOpen,
  createWorkoutForSelectedDay,
  deleteSelectedWorkout,
  updateWorkoutLogTitle,
  updateWorkoutSet,
  addSetToExercise,
  removeSetFromExercise,
  addExerciseToSelectedWorkout,
  removeExerciseFromSelectedWorkout,
  getPreviousExerciseInfo,
  openFoodEditor,
  updateDayNote,
  setSelectedTemplateId,
  createTemplate,
  updateTemplateTitle,
  addExerciseToTemplate,
  updateTemplateExercise,
  removeExerciseFromTemplate,
  deleteTemplate,
  setNewExerciseName,
  setNewExerciseGroup,
  createLibraryExercise,
  deleteLibraryExercise,
  createLibraryExerciseFromPicker,
  closeDay,
}) {
  return (
    <>
      <header className="header">
        <div>
          <h1>Тренировки</h1>
        </div>

        <div className="header-actions">
          {visibleStreak && (
            <div className="streak-line">
              <strong>{visibleStreak}</strong>
              <span>done</span>
            </div>
          )}

          <button
            type="button"
            className={`workout-editor-button ${isTemplateManagerOpen ? "active" : ""}`}
            onClick={() => setIsTemplateManagerOpen((prev) => !prev)}
          >
            Сеты
          </button>
        </div>
      </header>

      <section className="calendar-card">
  <div className="month-row">
    <button
      type="button"
      className="month-arrow month-arrow-left"
      onClick={() => changeMonth(-1)}
      aria-label="Предыдущий месяц"
    />

    <span>{monthName}</span>

    <button
      type="button"
      className="month-arrow month-arrow-right"
      onClick={() => changeMonth(1)}
      aria-label="Следующий месяц"
    />
  </div>

        <div className="calendar-weekdays">
          {["M", "T", "W", "T", "F", "S", "S"].map((day, index) => (
            <span key={`${day}-${index}`}>{day}</span>
          ))}
        </div>

        <div className="day-grid">
          {emptyDays.map((item) => (
            <div key={`empty-${item}`} />
          ))}

          {days.map((day) => {
            const dateKey = createDateKey(currentYear, currentMonth, day);
            const hasWorkout = Boolean(selectedWorkoutLog?.date === dateKey);
            const hasAnyWorkout = Boolean(
              completedWorkoutDates.includes(dateKey) ||
                Object.prototype.hasOwnProperty.call(
                  JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}")?.workoutLogs || {},
                  dateKey
                )
            );

            const isSelected = selectedDay === day;
            const isToday = isCurrentMonth && day === todayDay;
            const isCompleted = completedWorkoutDates.includes(dateKey);

            return (
              <button
                key={day}
                className={[
                  "day-circle",
                  hasAnyWorkout ? "active" : "",
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

      {isTemplateManagerOpen && (
        <TemplateManager
          workoutTemplates={workoutTemplates}
          exerciseLibrary={exerciseLibrary}
          selectedTemplate={selectedTemplate}
          selectedTemplateId={selectedTemplateId}
          newExerciseName={newExerciseName}
          newExerciseGroup={newExerciseGroup}
          setSelectedTemplateId={setSelectedTemplateId}
          createTemplate={createTemplate}
          updateTemplateTitle={updateTemplateTitle}
          addExerciseToTemplate={addExerciseToTemplate}
          updateTemplateExercise={updateTemplateExercise}
          removeExerciseFromTemplate={removeExerciseFromTemplate}
          deleteTemplate={deleteTemplate}
          setNewExerciseName={setNewExerciseName}
          setNewExerciseGroup={setNewExerciseGroup}
          createLibraryExercise={createLibraryExercise}
          deleteLibraryExercise={deleteLibraryExercise}
          createLibraryExerciseFromPicker={createLibraryExerciseFromPicker}
        />
      )}

{selectedDay && !isTemplateManagerOpen && (
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

        <h2>{selectedWorkoutLog ? selectedWorkoutLog.title : "День"}</h2>
      </div>

      <button className="icon-button" onClick={closeDay}>
        ×
      </button>
    </div>

    <div className="day-panel-tabs three">
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

      <button
        type="button"
        className={selectedDayPanel === "note" ? "active" : ""}
        onClick={() => setSelectedDayPanel("note")}
      >
        Заметка
      </button>
    </div>

    {selectedDayPanel === "workout" && (
      <>
        {!selectedWorkoutLog ? (
          <CreateWorkoutPanel
            workoutTemplates={workoutTemplates}
            createWorkoutForSelectedDay={createWorkoutForSelectedDay}
          />
        ) : (
          <WorkoutLogView
            workoutLog={selectedWorkoutLog}
            exerciseLibrary={exerciseLibrary}
            updateWorkoutLogTitle={updateWorkoutLogTitle}
            updateWorkoutSet={updateWorkoutSet}
            addSetToExercise={addSetToExercise}
            removeSetFromExercise={removeSetFromExercise}
            addExerciseToSelectedWorkout={addExerciseToSelectedWorkout}
            removeExerciseFromSelectedWorkout={removeExerciseFromSelectedWorkout}
            deleteSelectedWorkout={deleteSelectedWorkout}
            getPreviousExerciseInfo={getPreviousExerciseInfo}
          />
        )}
      </>
    )}

    {selectedDayPanel === "food" && (
      <DayFoodPanel
        selectedDateKey={selectedDateKey}
        entries={selectedDayFoodEntries}
        totals={selectedFoodTotals}
        dailyCalories={dailyCalories}
        dailyProtein={dailyProtein}
        dailyFat={dailyFat}
        dailyCarbs={dailyCarbs}
        remainingCalories={selectedDayRemainingCalories}
        newFood={newFood}
        editingFoodId={editingFoodId}
        setNewFood={setNewFood}
        addFoodEntry={addFoodEntry}
        startEditFoodEntry={startEditFoodEntry}
        deleteFoodEntry={deleteFoodEntry}
        resetFoodForm={resetFoodForm}
    />
    )}

    {selectedDayPanel === "note" && (
      <div className="day-note-panel">
        <p className="eyebrow">Заметка дня</p>

        <textarea
          value={selectedDayNote}
          onChange={(event) => updateDayNote(event.target.value)}
          placeholder="Самочувствие, настроение, сложность тренировки..."
        />

        <p className="day-food-hint">
          Заметка сохраняется автоматически для выбранной даты.
        </p>
      </div>
    )}
  </section>
)}
    </>
  );
}

/* =========================
   Workout components
========================= */

function CreateWorkoutPanel({ workoutTemplates, createWorkoutForSelectedDay }) {
  return (
    <div className="create-workout-panel">
      <p className="settings-note">
        На этот день ещё нет тренировки. Создай её из сета или начни пустую.
      </p>

      <div className="template-select-list">
        {workoutTemplates.map((template) => (
          <button
            type="button"
            key={template.id}
            onClick={() => createWorkoutForSelectedDay(template.id)}
          >
            <strong>{template.title}</strong>
            <span>{template.exercises.length} упражнений</span>
          </button>
        ))}
      </div>

      <button
        type="button"
        className="secondary-button"
        onClick={() => createWorkoutForSelectedDay(null)}
      >
        Создать пустую тренировку
      </button>
    </div>
  );
}

function WorkoutLogView({
  workoutLog,
  exerciseLibrary,
  updateWorkoutLogTitle,
  updateWorkoutSet,
  addSetToExercise,
  removeSetFromExercise,
  addExerciseToSelectedWorkout,
  removeExerciseFromSelectedWorkout,
  deleteSelectedWorkout,
  getPreviousExerciseInfo,
}) {
   const [isWorkoutExercisePickerOpen, setIsWorkoutExercisePickerOpen] =
    useState(false);
  const [workoutExerciseSearch, setWorkoutExerciseSearch] = useState("");

  const filteredWorkoutExercises = exerciseLibrary.filter((exercise) => {
    const searchValue = workoutExerciseSearch.trim().toLowerCase();

    if (!searchValue) return true;

    return (
      exercise.name.toLowerCase().includes(searchValue) ||
      exercise.muscleGroup.toLowerCase().includes(searchValue)
    );
  });
  return (
    <div>
      <div className="workout-title-row">
        <span>Название тренировки</span>

        <input
          type="text"
          value={workoutLog.title}
          onChange={(event) => updateWorkoutLogTitle(event.target.value)}
        />
      </div>

      <div className="logged-exercises-list">
        {workoutLog.exercises.length > 0 ? (
          workoutLog.exercises.map((exercise, exerciseIndex) => {
            const previousInfo = getPreviousExerciseInfo(exercise.exerciseId);

            return (
              <article className="logged-exercise-card" key={exercise.id || exerciseIndex}>
                <div className="logged-exercise-top">
                  <div>
                    <h3>{exercise.name}</h3>
                    <p>{exercise.muscleGroup || "Без группы"}</p>
                  </div>

                  <button
                    type="button"
                    className="delete-exercise-button"
                    onClick={() => removeExerciseFromSelectedWorkout(exerciseIndex)}
                  >
                    ×
                  </button>
                </div>

                {previousInfo && (
                  <p className="previous-exercise-info">
                    Прошлый раз:{" "}
                    {previousInfo.exercise.sets
                      .map((set) => `${set.weight || "—"} × ${set.reps || "—"}`)
                      .join(" / ")}
                  </p>
                )}

                <div className="sets-table">
                  {exercise.sets.map((set, setIndex) => (
                    <div className="set-row" key={`${exerciseIndex}-${setIndex}`}>
                      <span>{setIndex + 1}</span>

                      <input
                        type="text"
                        value={set.weight}
                        onChange={(event) =>
                          updateWorkoutSet(
                            exerciseIndex,
                            setIndex,
                            "weight",
                            event.target.value
                          )
                        }
                        placeholder="вес"
                      />

                      <input
                        type="text"
                        value={set.reps}
                        onChange={(event) =>
                          updateWorkoutSet(
                            exerciseIndex,
                            setIndex,
                            "reps",
                            event.target.value
                          )
                        }
                        placeholder="повт."
                      />

                      <button
                        type="button"
                        className={set.done ? "set-done-button done" : "set-done-button"}
                        onClick={() =>
                          updateWorkoutSet(exerciseIndex, setIndex, "done", !set.done)
                        }
                      >
                        ✓
                      </button>

                      <button
                        type="button"
                        className="set-remove-button"
                        onClick={() => removeSetFromExercise(exerciseIndex, setIndex)}
                      >
                        −
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => addSetToExercise(exerciseIndex)}
                >
                  Добавить подход
                </button>
              </article>
            );
          })
        ) : (
          <p className="profile-hint">В этой тренировке пока нет упражнений.</p>
        )}
      </div>

      <div className="add-log-exercise">
  <p className="eyebrow">Добавить упражнение</p>

  <button
    type="button"
    className="exercise-picker-open"
    onClick={() => setIsWorkoutExercisePickerOpen(true)}
  >
    <span>Выбрать упражнение</span>
    <strong>+</strong>
  </button>
</div>

{isWorkoutExercisePickerOpen && (
  <div className="exercise-picker-backdrop">
    <div className="exercise-picker-modal">
      <div className="exercise-picker-top">
        <div>
          <p className="eyebrow">Библиотека</p>
          <h2>Выбери упражнение</h2>
        </div>

        <button
          type="button"
          className="icon-button"
          onClick={() => {
            setIsWorkoutExercisePickerOpen(false);
            setWorkoutExerciseSearch("");
          }}
        >
          ×
        </button>
      </div>

      <input
        className="exercise-picker-search"
        type="text"
        placeholder="Поиск упражнения"
        value={workoutExerciseSearch}
        onChange={(event) => setWorkoutExerciseSearch(event.target.value)}
      />

      <div className="exercise-picker-list">
        {filteredWorkoutExercises.length > 0 ? (
          filteredWorkoutExercises.map((exercise) => (
            <button
              type="button"
              className="exercise-picker-item"
              key={exercise.id}
              onClick={() => {
                addExerciseToSelectedWorkout(exercise.id);
                setIsWorkoutExercisePickerOpen(false);
                setWorkoutExerciseSearch("");
              }}
            >
              <strong>{exercise.name}</strong>
              <span>{exercise.muscleGroup}</span>
            </button>
          ))
        ) : (
          <div className="exercise-picker-empty">
  <p>Ничего не нашлось :(</p>

  <span className="exercise-picker-empty-note">
    Создать новое упражнение можно в разделе Сеты → Библиотека.
  </span>
</div>
        )}
      </div>
    </div>
  </div>
)}

      <button
        type="button"
        className="danger-button"
        onClick={deleteSelectedWorkout}
      >
        Удалить тренировку дня
      </button>
    </div>
  );
}

function FoodForm({
  newFood,
  editingFoodId,
  setNewFood,
  onSave,
  resetFoodForm,
}) {
  return (
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

      <button type="button" className="primary-button" onClick={onSave}>
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
  );
}

function DayFoodPanel({
  selectedDateKey,
  entries = [],
  totals = {
    calories: 0,
    protein: 0,
    fat: 0,
    carbs: 0,
  },
  dailyCalories,
  dailyProtein,
  dailyFat,
  dailyCarbs,
  remainingCalories,
  newFood,
  editingFoodId,
  setNewFood,
  addFoodEntry,
  startEditFoodEntry,
  deleteFoodEntry,
  resetFoodForm,
}) {
  return (
    <div className="day-food-panel">
      <div className="day-food-summary">
        <p className="eyebrow">Калории</p>

        <div className="calories-main small">
          <strong>{totals.calories}</strong>
          <span>{dailyCalories ? `/ ${dailyCalories} ккал` : "ккал"}</span>
        </div>

        {dailyCalories && (
          <>
            <div className="food-progress compact">
              <div
                style={{
                  width: `${Math.min(
                    (totals.calories / dailyCalories) * 100,
                    100
                  )}%`,
                }}
              />
            </div>

            <p className="food-note">Осталось: {remainingCalories} ккал</p>
          </>
        )}
      </div>

      <div className="macro-cards">
       <MacroStat
        label="Белки"
        current={totals.protein}
        target={dailyProtein}
      />

      <MacroStat
        label="Жиры"
        current={totals.fat}
        target={dailyFat}
      />

      <MacroStat
        label="Углеводы"
        current={totals.carbs}
        target={dailyCarbs}
      />
     </div>

      <section className="day-food-form-card">
        <p className="eyebrow">
          {editingFoodId === null ? "Добавить еду" : "Редактировать еду"}
        </p>

        <FoodForm
          newFood={newFood}
          editingFoodId={editingFoodId}
          setNewFood={setNewFood}
          onSave={() => addFoodEntry(selectedDateKey)}
          resetFoodForm={resetFoodForm}
        />
      </section>

      <p className="day-food-hint">
        Еда сохраняется именно для выбранной даты.
      </p>

      {entries.length > 0 ? (
        <div className="food-list">
          {entries.map((item) => (
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
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="profile-hint">На этот день еда ещё не добавлена.</p>
      )}
    </div>
  );
}

/* =========================
   MacroState
========================= */

function MacroStat({ label, current, target, unit = "г" }) {
  const safeCurrent = Number(current) || 0;
  const safeTarget = Number(target) || 0;

  const percent =
    safeTarget > 0 ? Math.min((safeCurrent / safeTarget) * 100, 100) : 0;

  return (
    <div className="macro-stat-card">
      <div className="macro-stat-gauge">
        <svg viewBox="0 0 100 60" className="macro-stat-svg" aria-hidden="true">
          <path
            d="M 10 50 A 40 40 0 0 1 90 50"
            className="macro-stat-track"
            pathLength="100"
          />

          <path
            d="M 10 50 A 40 40 0 0 1 90 50"
            className="macro-stat-progress"
            pathLength="100"
            strokeDasharray={`${percent} 100`}
          />
        </svg>
      </div>

      <strong className="macro-stat-value">
        {safeCurrent}/{safeTarget} {unit}
      </strong>

      <span className="macro-stat-label">{label}</span>
    </div>
  );
}

/* =========================
   Template manager
========================= */

function MuscleGroupPicker({ value, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filteredGroups = MUSCLE_GROUPS.filter((group) => {
    const searchValue = search.trim().toLowerCase();

    if (!searchValue) return true;

    return group.toLowerCase().includes(searchValue);
  });

  const selectGroup = (group) => {
    onChange(group);
    setSearch("");
    setIsOpen(false);
  };

  return (
    <div className="muscle-group-picker">
      <button
        type="button"
        className={`muscle-group-picker-button ${value ? "selected" : ""}`}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <span>{value || "Группа мышц"}</span>
        <strong>+</strong>
      </button>

      {isOpen && (
        <div className="muscle-group-picker-dropdown">
          <input
            type="text"
            className="exercise-picker-search"
            placeholder="Поиск группы"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            autoFocus
          />

          <div className="muscle-group-picker-list">
            {filteredGroups.length > 0 ? (
              filteredGroups.map((group) => (
                <button
                  type="button"
                  key={group}
                  className="muscle-group-picker-item"
                  onClick={() => selectGroup(group)}
                >
                  {group}
                </button>
              ))
            ) : (
              <div className="exercise-picker-empty">
                <p>
                  Группа не найдена. Выбери одну из стандартных групп или используй
                  «Другое».
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TemplateManager({
  workoutTemplates,
  exerciseLibrary,
  selectedTemplate,
  selectedTemplateId,
  newExerciseName,
  newExerciseGroup,
  setSelectedTemplateId,
  createTemplate,
  updateTemplateTitle,
  addExerciseToTemplate,
  updateTemplateExercise,
  removeExerciseFromTemplate,
  deleteTemplate,
  setNewExerciseName,
  setNewExerciseGroup,
  createLibraryExercise,
  deleteLibraryExercise,
  createLibraryExerciseFromPicker,
}) {
    const [expandedTemplateExercise, setExpandedTemplateExercise] = useState(null);
    const [isLibraryOpen, setIsLibraryOpen] = useState(false);
    const [isExercisePickerOpen, setIsExercisePickerOpen] = useState(false);
    const [exerciseSearch, setExerciseSearch] = useState("");
    const [exercisePickerGroup, setExercisePickerGroup] = useState("");

    const filteredExercises = exerciseLibrary.filter((exercise) => {
  const searchValue = exerciseSearch.trim().toLowerCase();

  if (!searchValue) return true;

  return (
    exercise.name.toLowerCase().includes(searchValue) ||
    exercise.muscleGroup.toLowerCase().includes(searchValue)
  );
});

const createExerciseFromSearch = () => {
  const exerciseName = exerciseSearch.trim();

  if (!exerciseName) return;

  createLibraryExerciseFromPicker(
    exerciseName,
    exercisePickerGroup || DEFAULT_MUSCLE_GROUP
  );

  setIsExercisePickerOpen(false);
  setExerciseSearch("");
  setExercisePickerGroup("");
};

  return (
    <div className="template-manager">
      <section className="settings-card">
        <div className="panel-top">
          <div>
            <p className="eyebrow">Сеты</p>
            <h2>Шаблоны тренировок</h2>
          </div>

          <button type="button" className="primary-mini-button" onClick={createTemplate}>
            +
          </button>
        </div>

        <div className="template-tabs">
          {workoutTemplates.map((template) => (
            <button
              key={template.id}
              type="button"
              className={selectedTemplateId === template.id ? "active" : ""}
              onClick={() => setSelectedTemplateId(template.id)}
            >
              {template.title}
            </button>
          ))}
        </div>

        {selectedTemplate ? (
          <>
            <div className="workout-title-row">
              <span>Название сета</span>

              <input
                type="text"
                value={selectedTemplate.title}
                onChange={(event) => updateTemplateTitle(event.target.value)}
              />
            </div>

            <div className="template-exercises-list">
  {selectedTemplate.exercises.map((templateExercise, index) => {
    const libraryExercise = exerciseLibrary.find(
      (exercise) => exercise.id === templateExercise.exerciseId
    );

    const isExpanded = expandedTemplateExercise === index;

    return (
      <div
        className={`template-exercise-item ${
          isExpanded ? "expanded" : ""
        }`}
        key={`${templateExercise.exerciseId}-${index}`}
      >
        <button
          type="button"
          className="template-exercise-main"
          onClick={() =>
            setExpandedTemplateExercise(isExpanded ? null : index)
          }
        >
          <div className="template-exercise-name">
            <strong>{libraryExercise?.name || "Упражнение"}</strong>
            <p>{libraryExercise?.muscleGroup || "Без группы"}</p>
          </div>

          <span className="template-exercise-summary">
            {templateExercise.weight || "без веса"} ·{" "}
            {templateExercise.sets} подх. · {templateExercise.reps}
          </span>

           <span className="template-exercise-edit-hint">
            {isExpanded ? "Скрыть редактор" : "Редактировать"}
          </span>
        </button>

        <button
          type="button"
          className="delete-exercise-button"
          onClick={() => removeExerciseFromTemplate(index)}
        >
          ×
        </button>

        {isExpanded && (
          <div className="template-exercise-grid">
            <label>
              <span>Вес</span>
              <input
                type="text"
                value={templateExercise.weight}
                onChange={(event) =>
                  updateTemplateExercise(index, "weight", event.target.value)
                }
                placeholder="60 кг"
              />
            </label>

            <label>
              <span>Подходы</span>
              <input
                type="number"
                value={templateExercise.sets}
                onChange={(event) =>
                  updateTemplateExercise(index, "sets", event.target.value)
                }
                placeholder="4"
              />
            </label>

            <label>
              <span>Повторы</span>
              <input
                type="text"
                value={templateExercise.reps}
                onChange={(event) =>
                  updateTemplateExercise(index, "reps", event.target.value)
                }
                placeholder="8–10"
              />
            </label>
          </div>
        )}
      </div>
    );
  })}
</div>

            <div className="add-log-exercise">
  <p className="eyebrow">Добавить в сет</p>

  <button
    type="button"
    className="exercise-picker-open"
    onClick={() => setIsExercisePickerOpen(true)}
  >
    <span>Выбрать упражнение</span>
    <strong>+</strong>
  </button>
</div>

{isExercisePickerOpen && (
  <div className="exercise-picker-backdrop">
    <div className="exercise-picker-modal">
      <div className="exercise-picker-top">
        <div>
          <p className="eyebrow">Библиотека</p>
          <h2>Выбери упражнение</h2>
        </div>

        <button
          type="button"
          className="icon-button"
          onClick={() => {
          setIsExercisePickerOpen(false);
          setExerciseSearch("");
          setExercisePickerGroup("");
         }}
      >
          ×
          </button>
      </div>

      <input
        className="exercise-picker-search"
        type="text"
        placeholder="Поиск упражнения"
        value={exerciseSearch}
        onChange={(event) => setExerciseSearch(event.target.value)}
      />

      <div className="exercise-picker-list">
        {filteredExercises.length > 0 ? (
          filteredExercises.map((exercise) => (
            <button
              type="button"
              className="exercise-picker-item"
              key={exercise.id}
              onClick={() => {
                addExerciseToTemplate(exercise.id);
                setIsExercisePickerOpen(false);
                setExerciseSearch("");
              }}
            >
              <strong>{exercise.name}</strong>
              <span>{exercise.muscleGroup}</span>
            </button>
          ))
        ) : (
          <div className="exercise-picker-empty">
  <p>Ничего не нашлось :(</p>

     <label className="exercise-picker-group-field">
        <span>Группа мышц</span>

        <MuscleGroupPicker
          value={exercisePickerGroup}
          onChange={setExercisePickerGroup}
        />
        </label>

        <button
          type="button"
          onClick={createExerciseFromSearch}
          disabled={!exercisePickerGroup}
        >
          Добавить “{exerciseSearch.trim()}”
        </button>
        </div>
        )}
      </div>
    </div>
  </div>
)}

            <button type="button" className="danger-button" onClick={deleteTemplate}>
              Удалить сет
            </button>
          </>
        ) : (
          <p className="profile-hint">Создай первый сет тренировок.</p>
        )}
      </section>

      <section className="settings-card library-section">
  <button
    type="button"
    className="library-toggle"
    onClick={() => setIsLibraryOpen((prev) => !prev)}
  >
    <div>
      <p className="eyebrow">Библиотека</p>
      <h2>Упражнения</h2>
    </div>

    <span>{isLibraryOpen ? "Скрыть" : "Открыть"}</span>
  </button>

  {!isLibraryOpen && (
    <p className="settings-note">
      Здесь хранятся упражнения, которые можно добавлять в сеты.
    </p>
  )}

  {isLibraryOpen && (
    <>
      <div className="library-list">
  {exerciseLibrary.map((exercise) => (
    <div className="library-item" key={exercise.id}>
      <div className="library-item-info">
        <strong>{exercise.name}</strong>
        <span>{exercise.muscleGroup}</span>
      </div>

      <button
        type="button"
        className="delete-exercise-button"
        onClick={() => deleteLibraryExercise(exercise.id)}
      >
        ×
      </button>
    </div>
  ))}
</div>

      <div className="library-form">
        <input
          type="text"
          placeholder="Новое упражнение"
          value={newExerciseName}
          onChange={(event) => setNewExerciseName(event.target.value)}
        />

        <MuscleGroupPicker
          value={newExerciseGroup}
          onChange={setNewExerciseGroup}
        />

        <button
          type="button"
          className="primary-button"
          onClick={createLibraryExercise}
          disabled={!newExerciseName.trim() || !newExerciseGroup}
        >
          Добавить упражнение
        </button>
      </div>
    </>
  )}
</section>
    </div>
  );
}

/* =========================
   Food page
========================= */

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
    const [expandedFoodDate, setExpandedFoodDate] = useState(null);

  return (
    <>
      <header className="header">
        <div>
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
                  width: `${Math.min((eatenCalories / dailyCalories) * 100, 100)}%`,
                }}
              />
            </div>

            <p className="food-note">Осталось: {remainingCalories} ккал</p>

            <div className="macro-cards">
             <MacroStat
               label="Белки"
               current={eatenProtein}
               target={dailyProtein}
             />

             <MacroStat
               label="Жиры"
               current={eatenFat}
               target={dailyFat}
             />

             <MacroStat
               label="Углеводы"
               current={eatenCarbs}
               target={dailyCarbs}
             />
           </div>
          </>
        ) : (
          <p className="profile-hint">
            Укажи вес, рост, возраст, пол и активность в профиле, чтобы рассчитать норму КБЖУ.
          </p>
        )}
      </section>

      <section className="food-card">
        <p className="eyebrow">Еда за сегодня</p>

        {foodEntries.length > 0 ? (
          <div className="food-list">
            {foodEntries.map((item) => (
              <div
                className={`food-item ${editingFoodId === item.id ? "editing" : ""}`}
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
    <div className="food-history-list">
      {foodHistory.map((day) => {
        const isExpanded = expandedFoodDate === day.date;

        return (
          <div className="food-history-day" key={day.date}>
            <button
              type="button"
              className="food-history-header"
              onClick={() =>
                setExpandedFoodDate(isExpanded ? null : day.date)
              }
            >
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

              <div className="food-history-summary">
                <span>{day.calories} ккал</span>
                <small>{isExpanded ? "Скрыть" : "Блюда"}</small>
              </div>
            </button>

            {isExpanded && (
              <div className="food-history-meals">
                {day.items.map((item) => (
                  <div className="food-history-meal" key={item.id}>
                    <strong>{item.name}</strong>

                    <p>
                      {item.calories} ккал · Б {item.protein} · Ж{" "}
                      {item.fat} · У {item.carbs}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  ) : (
    <p className="profile-hint">История пока пустая.</p>
  )}
</section>
    </>
  );
}

/* =========================
   Profile / Settings / Nav
========================= */

function CompactProfileSelect({ title, value, options, onChange }) {
  const [isOpen, setIsOpen] = useState(false);

  const selectedOption =
    options.find((option) => option.id === value) || options[0];

  const selectOption = (optionId) => {
    onChange(optionId);
    setIsOpen(false);
  };

  return (
    <div className="compact-profile-select">
      <button
        type="button"
        className={`compact-profile-select-button ${isOpen ? "open" : ""}`}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <span>{title}</span>
        <strong>{selectedOption.title}</strong>
        <small>{selectedOption.description}</small>
      </button>

      {isOpen && (
        <div className="compact-profile-select-list">
          {options.map((option) => (
            <button
              type="button"
              key={option.id}
              className={option.id === value ? "active" : ""}
              onClick={() => selectOption(option.id)}
            >
              <strong>{option.title}</strong>
              <span>{option.description}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ProfilePage({ profile, bmi, bmiStatus, updateProfile }) {
  return (
    <>
      <header className="header">
        <div>
          <h1>Профиль</h1>
        </div>
      </header>

      <section className="profile-card compact-profile-card">
        <p className="eyebrow">Мои параметры</p>

        <div className="profile-compact-grid">
          <label className="profile-compact-field">
            <span>Вес</span>

            <div className="profile-compact-input">
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

          <label className="profile-compact-field">
            <span>Рост</span>

            <div className="profile-compact-input">
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

          <label className="profile-compact-field">
            <span>Возраст</span>

            <div className="profile-compact-input">
              <input
                type="number"
                value={profile?.age || ""}
                onChange={(event) =>
                  updateProfile("age", event.target.value)
                }
                placeholder="20"
              />
              <strong>лет</strong>
            </div>
          </label>

          <div className="profile-compact-field">
            <span>Пол</span>

            <div className="gender-row">
              <button
                type="button"
                className={profile?.gender === "male" ? "active" : ""}
                onClick={() => updateProfile("gender", "male")}
              >
                Муж
              </button>

              <button
                type="button"
                className={profile?.gender === "female" ? "active" : ""}
                onClick={() => updateProfile("gender", "female")}
              >
                Жен
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="profile-card profile-preferences-card">
  <p className="eyebrow">Цель и активность</p>

  <div className="profile-preferences-grid">
    <CompactProfileSelect
      title="Цель"
      value={profile?.goal || "maintain"}
      options={profileGoalOptions}
      onChange={(value) => updateProfile("goal", value)}
    />

    <CompactProfileSelect
      title="Активность"
      value={profile?.activity || "light"}
      options={profileActivityOptions}
      onChange={(value) => updateProfile("activity", value)}
    />
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

      <div className="profile-footer">
        <span>FureZ Tracker · v0.3.0</span>
        <span>Made with love by FureZ</span>
      </div>
    </>
  );
}

function BottomNav({ activeTab, setTab }) {
  return (
    <nav className="bottom-nav bottom-nav-three">
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
    </nav>
  );
}