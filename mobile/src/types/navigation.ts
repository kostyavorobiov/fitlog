export type RootTabParamList = {
  index: undefined;        // Workouts
  calendar: undefined;     // Calendar View
  analytics: undefined;    // Analytics View
  profile: undefined;      // User Profile
  exercises?: undefined;   // Hidden/Auxiliary Exercise Catalog
};


export type RootStackParamList = {
  '(tabs)': undefined;
  '(auth)': undefined;
  'auth/callback': undefined;
  'workout/[id]': { id: string };
  'exercise/[id]': { id: string };
  'modal': undefined;
  '+not-found': undefined;
};

