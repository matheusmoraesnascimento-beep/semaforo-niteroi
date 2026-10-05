import { useEffect, useState } from 'react';
import { loadProfile, saveProfile } from './profileStore';
import type { Profile } from './profile';

export function useProfile() {
  const [profile, setProfile] = useState<Profile>(() => loadProfile());
  useEffect(() => saveProfile(profile), [profile]);
  return { profile, update: setProfile };
}
