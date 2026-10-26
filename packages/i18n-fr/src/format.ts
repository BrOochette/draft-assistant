// Formats de nombres à la française.
export const fmt1 = (n: number): string => n.toFixed(1).replace('.', ',');
export const fmtPct = (n: number): string => fmt1(n) + ' %';
/** Niveau de scaling (1 à 5 par demi-point) sur 10, sans décimale inutile. */
export const fmtScal = (v: number): string => (Number.isInteger(v * 2) ? String(v * 2) : fmt1(v * 2));
/** 14200 devient « 14 200 ». */
export const fmtInt = (n: number): string => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
/** Signe calculé sur la valeur arrondie : -0,02 donne « +0,0 », pas « -0,0 ». */
export const fmtSigned = (n: number): string => {
  const r = Math.round(n * 10) / 10;
  return (r >= 0 ? '+' : '') + fmt1(r === 0 ? 0 : r);
};
export const fmtDelta = (n: number): string => (n >= 0 ? '+' : '') + n;
