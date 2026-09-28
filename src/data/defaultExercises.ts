import { Exercise } from '../types/workout';

export const DEFAULT_EXERCISES: Omit<Exercise, 'id' | 'createdAt'>[] = [];

