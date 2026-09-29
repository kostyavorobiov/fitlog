import { Exercise } from '../types/workout';

// All exercises are stored authoritatively in the Supabase database.
// Unused exercises have been cleaned up and are not hardcoded in project files.
export const DEFAULT_EXERCISES: Omit<Exercise, 'id' | 'createdAt'>[] = [];
