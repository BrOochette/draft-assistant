import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { StatsSnapshotSchema } from '@draft/schemas';
import { buildSampleSnapshot, writeSnapshot } from '../src/sample';

const SAMPLE = fileURLToPath(new URL('../../../data/sample', import.meta.url));

describe('ingest sample', () => {
  it('écrit un snapshot valide', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'draft-ingest-'));
    try {
      const file = join(dir, 'snapshot.json');
      await writeSnapshot(await buildSampleSnapshot(SAMPLE), file);
      const snap = StatsSnapshotSchema.parse(JSON.parse(await readFile(file, 'utf8')));
      expect(snap.champions).toHaveLength(80);
      expect(snap.candidates.Jungle?.map((c) => c.name)).toEqual(['Sejuani', 'Fiddlesticks', 'Viego', 'Lee Sin', 'Zac']);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
