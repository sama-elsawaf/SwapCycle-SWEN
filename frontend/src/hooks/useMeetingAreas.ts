import { listMeetingAreas } from '../api/auth';
import type { MeetingArea } from '../types';
import { useAsync } from './useAsync';

// Meeting areas are reference data that rarely change, so one request per page load is enough.
let cached: Promise<MeetingArea[]> | undefined;

function loadAreas(): Promise<MeetingArea[]> {
  if (!cached) {
    cached = listMeetingAreas().catch((error: unknown) => {
      cached = undefined;
      throw error;
    });
  }
  return cached;
}

export function useMeetingAreas() {
  const { data, error, loading } = useAsync(loadAreas, []);
  return { areas: data ?? [], error, loading };
}

/** Test helper: forget the cached list. */
export function resetMeetingAreasCache(): void {
  cached = undefined;
}
