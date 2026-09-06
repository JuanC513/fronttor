#!/usr/bin/env node
// Angular (Vite/esbuild) no compila archivos fuera de `src/` — `rootDir` en tsconfig.app.json
// lo impide, y el intento de import cruzado directo hace fallar el build del frontend. Como
// Angular y las Edge Functions de Deno son dos programas de TypeScript separados sin import
// compartido posible, este script es lo que garantiza que ciertos números duplicados a
// propósito no se desincronicen: lee el valor de cada lado y falla si no coinciden.
//
// Corre como parte de `npm run check`, y lint-staged lo dispara al tocar cualquiera de los
// archivos involucrados, así que Husky lo hace cumplir en el pre-commit.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Cada patrón debe tener exactamente un grupo de captura: el número a comparar. */
function readValue(relativePath, pattern) {
  const filePath = join(rootDir, relativePath);
  const content = readFileSync(filePath, 'utf-8');
  const match = content.match(pattern);

  if (!match) {
    throw new Error(`No se encontró "${pattern}" en ${relativePath}`);
  }

  return { value: Number(match[1].replace(/_/g, '')), filePath: relativePath };
}

const pairs = [
  {
    name: 'MAX_PREGUNTA_LENGTH',
    a: {
      file: 'supabase/functions/_shared/prompts/question-prompt.ts',
      pattern: /MAX_PREGUNTA_LENGTH\s*=\s*([\d_]+)\s*;/,
    },
    b: {
      file: 'src/app/domain/ai/services/ai-chat-service.ts',
      pattern: /MAX_PREGUNTA_LENGTH\s*=\s*([\d_]+)\s*;/,
    },
  },
  {
    name: 'MAX_INSTRUCCION_LENGTH',
    a: {
      file: 'supabase/functions/_shared/prompts/content-prompt.ts',
      pattern: /MAX_INSTRUCCION_LENGTH\s*=\s*([\d_]+)\s*;/,
    },
    // Del lado del frontend no hay una constante nombrada: el tope vive inline en el
    // validador del campo `instruccion`.
    b: {
      file: 'src/app/features/admin/components/block-form-dialog/block-form-dialog/block-form-dialog.ts',
      pattern: /instruccion:\s*\[undefined,\s*Validators\.maxLength\(([\d_]+)\)\]/,
    },
  },
];

let hasMismatch = false;

for (const pair of pairs) {
  const a = readValue(pair.a.file, pair.a.pattern);
  const b = readValue(pair.b.file, pair.b.pattern);

  if (a.value !== b.value) {
    hasMismatch = true;
    console.error(
      `✗ ${pair.name} desincronizado: ${a.value} en ${a.filePath}, ${b.value} en ${b.filePath}`,
    );
  } else {
    console.log(`✓ ${pair.name} = ${a.value} (${a.filePath} ↔ ${b.filePath})`);
  }
}

if (hasMismatch) {
  process.exit(1);
}
