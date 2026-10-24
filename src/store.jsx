import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DataContext, UiContext } from "./useStore";
import { loadData, saveData } from "./data/storage";
import { todayKey } from "./lib/dates";
import { haptic } from "./telegram";

let sheetSequence = 0;

export function StoreProvider({ children }) {
  const [data, setData] = useState(loadData);

  useEffect(() => {
    saveData(data);
  }, [data]);

  const update = useCallback((action, ...args) => {
    setData((prev) => action(prev, ...args));
  }, []);

  const [tab, setTab] = useState("today");
  const [foodDate, setFoodDate] = useState(todayKey);
  const [sheets, setSheets] = useState([]);
  const [rest, setRest] = useState(null); // { endsAt, total }
  const restTimeout = useRef(null);

  const openSheet = useCallback((type, props = {}) => {
    const key = ++sheetSequence;
    setSheets((prev) => [...prev, { key, type, props }]);
    return key;
  }, []);

  const closeSheet = useCallback((key) => {
    setSheets((prev) => (key ? prev.filter((sheet) => sheet.key !== key) : prev.slice(0, -1)));
  }, []);

  const closeAllSheets = useCallback(() => setSheets([]), []);

  const scheduleRestEnd = useCallback((endsAt) => {
    clearTimeout(restTimeout.current);
    restTimeout.current = setTimeout(() => {
      haptic.warning();
      setRest(null);
    }, Math.max(0, endsAt - Date.now()));
  }, []);

  const startRest = useCallback(
    (seconds) => {
      if (!seconds) return;
      const endsAt = Date.now() + seconds * 1000;
      setRest({ endsAt, total: seconds });
      scheduleRestEnd(endsAt);
    },
    [scheduleRestEnd]
  );

  const adjustRest = useCallback(
    (deltaSeconds) => {
      setRest((prev) => {
        if (!prev) return prev;
        const endsAt = Math.max(Date.now() + 1000, prev.endsAt + deltaSeconds * 1000);
        scheduleRestEnd(endsAt);
        return { endsAt, total: Math.max(prev.total + deltaSeconds, 1) };
      });
    },
    [scheduleRestEnd]
  );

  const stopRest = useCallback(() => {
    clearTimeout(restTimeout.current);
    setRest(null);
  }, []);

  useEffect(() => () => clearTimeout(restTimeout.current), []);

  const ui = useMemo(
    () => ({
      tab,
      setTab,
      foodDate,
      setFoodDate,
      sheets,
      openSheet,
      closeSheet,
      closeAllSheets,
      rest,
      startRest,
      adjustRest,
      stopRest,
    }),
    [tab, foodDate, sheets, openSheet, closeSheet, closeAllSheets, rest, startRest, adjustRest, stopRest]
  );

  const store = useMemo(() => ({ data, update }), [data, update]);

  return (
    <DataContext.Provider value={store}>
      <UiContext.Provider value={ui}>{children}</UiContext.Provider>
    </DataContext.Provider>
  );
}
