import type { VolumeUnit } from '../../types';

export const ACTIVITY_VOLUME_UNIT_OPTIONS: { value: VolumeUnit; label: string }[] = [
  { value: 'km', label: 'km' },
  { value: 'mi', label: 'miles' },
  { value: 'minutes', label: 'minutes' },
  { value: 'reps', label: 'reps' },
  { value: 'sets', label: 'sets' },
  { value: 'sessions', label: 'sessions' },
];
