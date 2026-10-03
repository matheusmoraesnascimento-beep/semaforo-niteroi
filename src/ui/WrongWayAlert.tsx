export function WrongWayAlert({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div className="wrong-way" role="alert">
      <div className="wrong-way-title">⚠ POSSÍVEL CONTRAMÃO</div>
      <div className="wrong-way-sub">dado do mapa — confira a sinalização</div>
    </div>
  );
}
