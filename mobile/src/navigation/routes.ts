export const ROUTES = {
  TABS: {
    ROOT: '/(tabs)',
    WORKOUTS: '/(tabs)',
    EXERCISES: '/(tabs)/exercises',
    CALENDAR: '/(tabs)/calendar',
    PROFILE: '/(tabs)/profile',
  },
  WORKOUT_DETAIL: (id: string) => `/workout/${id}` as const,
  EXERCISE_DETAIL: (id: string) => `/exercise/${id}` as const,
} as const;

export type AppRoutes = typeof ROUTES;
