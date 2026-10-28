/** Vite resolves an imported `.svg` to its emitted, `'self'`-served URL (no `data:` inlining). */
declare module '*.svg' {
  const url: string;
  export default url;
}
