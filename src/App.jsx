import { useEffect } from "react";
import "./App.css";
import Icon from "./components/Icon";
import { BrowserMainButton } from "./components/ui";
import { StoreProvider } from "./store";
import { useStore, useUi } from "./useStore";
import { DepthContext, useNow } from "./hooks";
import { haptic, setClosingConfirmation } from "./telegram";
import { formatDuration, todayKey } from "./lib/dates";
import { isWorkoutDone } from "./lib/workouts";

import TodayScreen from "./screens/TodayScreen";
import WorkoutsScreen from "./screens/WorkoutsScreen";
import FoodScreen from "./screens/FoodScreen";
import ProgressScreen from "./screens/ProgressScreen";

import WorkoutSheet from "./sheets/WorkoutSheet";
import ProgramSheet from "./sheets/ProgramSheet";
import DaySheet from "./sheets/DaySheet";
import ProfileSheet from "./sheets/ProfileSheet";
import { ExerciseEditSheet, ExercisePickerSheet, ExerciseSheet } from "./sheets/ExerciseSheets";
import { FoodSearchSheet, ManualFoodSheet, PortionSheet } from "./sheets/FoodSheets";
import { ActionsSheet, PromptSheet, StartWorkoutSheet, SummarySheet, WeightSheet } from "./sheets/SmallSheets";

const TABS = [
  { id: "today", title: "Сегодня", icon: "today", Screen: TodayScreen },
  { id: "workouts", title: "Тренировки", icon: "dumbbell", Screen: WorkoutsScreen },
  { id: "food", title: "Питание", icon: "food", Screen: FoodScreen },
  { id: "progress", title: "Прогресс", icon: "chart", Screen: ProgressScreen },
];

const SHEETS = {
  workout: WorkoutSheet,
  program: ProgramSheet,
  day: DaySheet,
  profile: ProfileSheet,
  exercise: ExerciseSheet,
  exerciseEdit: ExerciseEditSheet,
  exercisePicker: ExercisePickerSheet,
  foodSearch: FoodSearchSheet,
  portion: PortionSheet,
  manualFood: ManualFoodSheet,
  actions: ActionsSheet,
  prompt: PromptSheet,
  startWorkout: StartWorkoutSheet,
  summary: SummarySheet,
  weight: WeightSheet,
};

function RestTimer() {
  const { rest, adjustRest, stopRest } = useUi();
  const now = useNow(250, Boolean(rest));

  useEffect(() => {
    document.documentElement.classList.toggle("has-rest-timer", Boolean(rest));
  }, [rest]);

  if (!rest) return null;

  const left = Math.max(0, rest.endsAt - now);
  const ratio = Math.min(1, left / (rest.total * 1000));

  return (
    <div className="rest-timer" role="timer" aria-live="off">
      <div className="rest-timer-bar" style={{ transform: `scaleX(${ratio})` }} />
      <button type="button" onClick={() => adjustRest(-15)}>
        −15
      </button>
      <div className="rest-timer-time">
        <span>Отдых</span>
        <strong>{formatDuration(left)}</strong>
      </div>
      <button type="button" onClick={() => adjustRest(15)}>
        +15
      </button>
      <button type="button" className="rest-timer-skip" onClick={stopRest}>
        Пропустить
      </button>
    </div>
  );
}

function BottomNav() {
  const { tab, setTab } = useUi();
  return (
    <nav className="bottom-nav">
      {TABS.map((item) => (
        <button
          key={item.id}
          type="button"
          className={tab === item.id ? "active" : ""}
          onClick={() => {
            if (tab !== item.id) haptic.select();
            setTab(item.id);
            window.scrollTo({ top: 0 });
          }}
        >
          <Icon name={item.icon} size={22} />
          <span>{item.title}</span>
        </button>
      ))}
    </nav>
  );
}

function Shell() {
  const { data } = useStore();
  const { tab, sheets } = useUi();
  const { Screen } = TABS.find((item) => item.id === tab) || TABS[0];

  const todayWorkout = data.workouts[todayKey()];
  const workoutInProgress = Boolean(todayWorkout) && !isWorkoutDone(todayWorkout);

  useEffect(() => {
    setClosingConfirmation(workoutInProgress);
  }, [workoutInProgress]);

  useEffect(() => {
    document.documentElement.classList.toggle("sheet-open", sheets.length > 0);
  }, [sheets.length]);

  return (
    <div className="app">
      <main className="screen" aria-hidden={sheets.length > 0 || undefined}>
        <Screen />
      </main>
      <BottomNav />

      {sheets.map((sheet, index) => {
        const SheetComponent = SHEETS[sheet.type];
        return (
          <DepthContext.Provider key={sheet.key} value={index + 1}>
            <SheetComponent sheetKey={sheet.key} {...sheet.props} />
          </DepthContext.Provider>
        );
      })}

      <RestTimer />
      <BrowserMainButton />
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
