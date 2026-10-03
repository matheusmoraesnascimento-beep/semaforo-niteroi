export interface RoadInfo {
  name: string | null;
  oneway: 0 | 1 | -1;
  allowed: number | null; // sentido permitido (graus) se mão única
}

interface Props {
  road: RoadInfo | null;
  heading: number | null;
}

export function StreetBanner({ road, heading }: Props) {
  if (!road) return <div className="street-banner muted">Rua não identificada</div>;
  const name = road.name ?? 'Rua sem nome';

  if (road.oneway !== 0 && road.allowed !== null) {
    // seta relativa ao meu rumo: para cima = estou no sentido permitido
    const rotation = road.allowed - (heading ?? 0);
    return (
      <div className="street-banner">
        <span className="street-arrow" style={{ transform: `rotate(${rotation}deg)` }}>⬆</span>
        <div>
          <div className="street-name">{name}</div>
          <div className="street-kind">Mão única</div>
        </div>
      </div>
    );
  }

  return (
    <div className="street-banner">
      <span className="street-arrow">⇅</span>
      <div>
        <div className="street-name">{name}</div>
        <div className="street-kind">Mão dupla</div>
      </div>
    </div>
  );
}
