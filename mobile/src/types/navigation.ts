export type RootTabParamList = {
  index: undefined;        // Workouts
  exercises: undefined;    // Exercise Catalog
  calendar: undefined;     // Calendar View
  profile: undefined;      // User Profile
};

export type RootStackParamList = {
  '(tabs)': undefined;
  'workout/[id]': { id: string };
  'exercise/[id]': { id: string };
  'modal': undefined;
  '+not-found': undefined;
};
