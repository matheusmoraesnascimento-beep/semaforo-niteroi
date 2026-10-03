import type { LocalState, TrafficLight } from '../types';

export function upsertLight(s: LocalState, light: TrafficLight): LocalState {
  return {
    lights: [...s.lights.filter((l) => l.id !== light.id), light],
    deleted: s.deleted.filter((id) => id !== light.id),
  };
}

export function removeLight(s: LocalState, id: string): LocalState {
  return {
    lights: s.lights.filter((l) => l.id !== id),
    deleted: s.deleted.includes(id) ? s.deleted : [...s.deleted, id],
  };
}
