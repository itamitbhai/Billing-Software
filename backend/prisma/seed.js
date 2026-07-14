// No global seed data — each company gets its chart of accounts seeded
// individually by seedTallyDefaults() when it registers (see
// src/shared/utils/tally-seed.js, called from auth.service.registerCeo).
// This file exists only so `prisma migrate reset` (which always runs the
// configured seed command) has something to run.
console.log('No global seed data. Per-company defaults are seeded at registration time.');
