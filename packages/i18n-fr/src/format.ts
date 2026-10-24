// Formats de nombres à la française.
export const fmt1 = (n: number): string => n.toFixed(1).replace('.', ',');
export const fmtPct = (n: number): string => fmt1(n) + ' %';
/** 14200 devient « 14 200 ». */
export const fmtInt = (n: number): string => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
/** Signe calculé sur la valeur arrondie : -0,02 donne « +0,0 », pas « -0,0 ». */
export const fmtSigned = (n: number): string => {
  const r = Math.round(n * 10) / 10;
  return (r >= 0 ? '+' : '') + fmt1(r === 0 ? 0 : r);
};
export const fmtDelta = (n: number): string => (n >= 0 ? '+' : '') + n;
