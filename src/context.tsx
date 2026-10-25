import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import * as api from "./lib/data";
import type {
  Equipment,
  Booking,
  CalendarEntry,
  CollectionName,
} from "./lib/types";
type State = {
  equipment: Equipment[];
  bookings: Booking[];
  calendarEntries: CalendarEntry[];
  loading: boolean;
  isLoading: (name: CollectionName) => boolean;
  errors: Partial<Record<CollectionName, string>>;
  retry: () => void;
  user: { email: string | null } | null;
  authReady: boolean;
  message: string;
  announce: (text: string) => void;
};
const Context = createContext<State | null>(null);
export function DataProvider({ children }: { children: ReactNode }) {
  const [equipment, setEquipment] = useState<Equipment[]>([]),
    [bookings, setBookings] = useState<Booking[]>([]),
    [calendarEntries, setCalendar] = useState<CalendarEntry[]>([]),
    [loaded, setLoaded] = useState<string[]>([]),
    [errors, setErrors] = useState<State["errors"]>({}),
    [version, setVersion] = useState(0),
    [user, setUser] = useState<State["user"]>(null),
    [authReady, setReady] = useState(false),
    [message, announce] = useState("");
  useEffect(() => {
    setLoaded([]);
    setErrors({});
    const setters = {
      equipment: setEquipment,
      bookings: setBookings,
      calendarEntries: setCalendar,
    };
    const stops = (Object.keys(setters) as CollectionName[]).map((name) =>
      api.watch(
        name,
        (rows) => {
          (
            setters[name] as (
              items: (Equipment | Booking | CalendarEntry)[],
            ) => void
          )(rows);
          setLoaded((x) => (x.includes(name) ? x : [...x, name]));
        },
        (error) => {
          setErrors((x) => ({ ...x, [name]: error }));
          setLoaded((x) => (x.includes(name) ? x : [...x, name]));
        },
      ),
    );
    return () => stops.forEach((s) => s());
  }, [version]);
  useEffect(
    () =>
      api.watchAuth((u) => {
        setUser(u);
        setReady(true);
      }),
    [],
  );
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => announce(""), 7000);
    return () => clearTimeout(timer);
  }, [message]);
  return (
    <Context.Provider
      value={{
        equipment,
        bookings,
        calendarEntries,
        loading: loaded.length < 3,
        isLoading: (name) => !loaded.includes(name),
        errors,
        retry: () => setVersion((v) => v + 1),
        user,
        authReady,
        message,
        announce,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useData() {
  const state = useContext(Context);
  if (!state) throw Error("DataProvider missing");
  return state;
}
