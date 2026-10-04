import { useEffect, useState } from 'react';
import type { Place, SavedPlaces } from '../routing/types';
import { searchPlaces } from '../routing/geocode';
import { errorMessage } from '../routing/errors';

const MIN_CHARS = 3;
const DEBOUNCE_MS = 400;

interface Props {
  saved: SavedPlaces;
  busy: boolean;
  onChoose(place: Place): void;
  onError(message: string): void; // precisa ser estável (useCallback)
}

export function SearchBar({ saved, busy, onChoose, onError }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [empty, setEmpty] = useState(false);

  useEffect(() => {
    const q = query.trim();
    setEmpty(false);
    if (q.length < MIN_CHARS) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await searchPlaces(q);
        if (cancelled) return;
        setResults(r);
        setEmpty(r.length === 0);
      } catch (e) {
        if (!cancelled) onError(errorMessage(e));
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, onError]);

  const pick = (place: Place) => {
    setQuery('');
    setResults([]);
    setOpen(false);
    onChoose(place);
  };

  const typing = query.trim().length >= MIN_CHARS;

  return (
    <div className="search">
      <input
        type="search"
        placeholder="Para onde?"
        value={query}
        disabled={busy}
        onFocus={() => setOpen(true)}
        // adia o fechamento para o toque na sugestão chegar antes do blur
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => setQuery(e.target.value)}
      />
      {open && (
        <div className="search-list">
          {!typing &&
            (['home', 'work'] as const).map((slot) => {
              const p = saved[slot];
              return (
                p && (
                  <button key={slot} onClick={() => pick(p)}>
                    {slot === 'home' ? '🏠 Casa' : '💼 Trabalho'}
                    <small>{p.name}</small>
                  </button>
                )
              );
            })}
          {!typing && !saved.home && !saved.work && <div className="search-note">Digite um endereço ou lugar.</div>}
          {searching && <div className="search-note">Buscando…</div>}
          {empty && !searching && <div className="search-note">Nenhum lugar encontrado.</div>}
          {results.map((p) => (
            <button key={`${p.lat},${p.lon}`} onClick={() => pick(p)}>
              {p.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
