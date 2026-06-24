// Une clases condicionalmente sin dependencias externas (clsx-lite).
export type ClassValue = string | number | false | null | undefined | ClassValue[];

export function cn(...inputs: ClassValue[]): string {
  const out: string[] = [];
  const walk = (v: ClassValue) => {
    if (!v && v !== 0) return;
    if (Array.isArray(v)) v.forEach(walk);
    else out.push(String(v));
  };
  inputs.forEach(walk);
  return out.join(' ');
}

// Selecciona una variante de un mapa tipado, con fallback.
export function variant<T extends string>(
  map: Record<T, string>,
  key: T | undefined,
  fallback: T,
): string {
  return map[key ?? fallback] ?? map[fallback];
}
