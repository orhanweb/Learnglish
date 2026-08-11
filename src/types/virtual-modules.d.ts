// src/types/virtual-modules.d.ts

declare module 'virtual:words-manifest' {
  const manifest: import('@/lib/words-payload').WordsManifest;
  export default manifest;
}
