export const n0 = (v: number) => Math.round(v).toLocaleString('en-US');
export const n1 = (v: number) => (Math.round(v * 10) / 10).toLocaleString('en-US', { maximumFractionDigits: 1 });
export const n2 = (v: number) => (Math.round(v * 100) / 100).toLocaleString('en-US', { maximumFractionDigits: 2 });
