import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import { beuiLicense } from '../../scripts/beui-vite.ts';
export default defineConfig({plugins:[tailwindcss(),beuiLicense()],root:fileURLToPath(new URL('.',import.meta.url)),build:{outDir:'../../dist/web',emptyOutDir:true}});
