import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));

for (const mode of [{ VERCEL_ENV: 'preview' }, { VERCEL_ENV: 'production', SMO_DEMO_MODE: 'true' }]) {
  test(`demo API blocks real side effects (${JSON.stringify(mode)})`, () => {
    const scratch = mkdtempSync(path.join(tmpdir(), 'smooa-demo-api-'));
    try {
      execFileSync(process.execPath, ['--input-type=module', '-e', `
        import assert from 'node:assert/strict';
        import { mkdirSync, writeFileSync, readdirSync } from 'node:fs';
        import path from 'node:path';
        import { tmpdir } from 'node:os';
        import { getApps } from 'firebase-admin/app';
        import nodemailer from 'nodemailer';
        nodemailer.createTransport = () => { throw Error('SMTP must stay disabled'); };
        const uploads = path.join(tmpdir(), 'smooa-equipment-uploads');
        mkdirSync(uploads);
        writeFileSync(path.join(uploads, 'fixture.png'), 'private fixture');
        const app = (await import('./server.js')).default;
        assert.equal(getApps().length, 0, 'demo must not initialize Firebase Admin');
        const server = app.listen(0, '127.0.0.1');
        await new Promise(resolve => server.once('listening', resolve));
        const origin = 'http://127.0.0.1:' + server.address().port;
        try {
          for (const route of ['upload-image', 'notify-admin-booking', 'notify-borrower-approved', 'notify-borrower-rejected']) {
            const response = await fetch(origin + '/api/' + route, {
              method: 'POST', headers: { 'Content-Type': 'application/json' }, body: 'invalid JSON',
            });
            assert.equal(response.status, 403);
            assert.equal((await response.json()).code, 'DEMO_MODE');
          }
          const form = new FormData();
          form.append('image', new Blob(['must not be stored'], { type: 'image/png' }), 'new.png');
          assert.equal((await fetch(origin + '/api/upload-image', { method: 'POST', body: form })).status, 403);
          for (const route of ['/api/admin/notifications', '/api/not-found', '/uploads/fixture.png']) {
            const response = await fetch(origin + route);
            assert.equal(response.status, 403);
            assert.equal((await response.json()).code, 'DEMO_MODE');
          }
          assert.deepEqual(readdirSync(uploads), ['fixture.png']);
        } finally {
          await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
        }
      `], {
        cwd: root,
        timeout: 20_000,
        env: {
          PATH: process.env.PATH,
          TMPDIR: scratch,
          VERCEL: '1',
          SMO_DEMO_MODE: 'false',
          VITE_DEMO_MODE: 'false',
          ...mode,
          DOTENV_CONFIG_PATH: path.join(scratch, 'missing.env'),
          SMTP_HOST: 'smtp.example.invalid',
          SMTP_USER: 'fixture@example.invalid',
          SMTP_PASS: 'fixture-only',
        },
        stdio: 'pipe',
      });
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  });
}

for (const publicUrl of ['', 'https://equipment.example.invalid']) {
  test(`Vercel Express paths, temporary uploads and email origin (${publicUrl || 'deployment URL'})`, () => {
    const scratch = mkdtempSync(path.join(tmpdir(), 'smooa-server-test-'));
    try {
      execFileSync(process.execPath, ['--input-type=module', '-e', `
        import assert from 'node:assert/strict';
        import { existsSync, readFileSync } from 'node:fs';
        import { tmpdir } from 'node:os';
        import path from 'node:path';
        import { initializeApp } from 'firebase-admin/app';
        import nodemailer from 'nodemailer';
        initializeApp({ projectId: 'demo-smooa-fixture' });
        let mail;
        nodemailer.createTransport = () => ({ sendMail: async (value) => { mail = value; } });
        const app = (await import('./server.js')).default;
        const server = app.listen(0, '127.0.0.1');
        await new Promise(resolve => server.once('listening', resolve));
        const origin = 'http://127.0.0.1:' + server.address().port;
        const request = globalThis.fetch;
        globalThis.fetch = (url, options) => {
          assert.equal(new URL(url).origin, origin, 'only local fixture requests are allowed');
          return request(url, options);
        };
        try {
          assert.equal((await fetch(origin + '/api/not-found')).status, 404);
          assert.equal((await fetch(origin + '/uploads/not-found')).status, 404);
          assert.equal((await fetch(origin + '/api/admin/notifications')).status, 401);
          const form = new FormData();
          const bytes = Buffer.from('fixture image');
          form.append('image', new Blob([bytes], { type: 'image/png' }), 'fixture.png');
          const uploaded = await fetch(origin + '/api/upload-image', { method: 'POST', body: form });
          assert.equal(uploaded.status, 200);
          const { imageUrl, filename } = await uploaded.json();
          assert.equal(imageUrl, '/uploads/' + filename);
          const tempFile = path.join(tmpdir(), 'smooa-equipment-uploads', filename);
          assert(existsSync(tempFile));
          assert.deepEqual(readFileSync(tempFile), bytes);
          assert.deepEqual(Buffer.from(await (await fetch(origin + imageUrl)).arrayBuffer()), bytes);
          const notified = await fetch(origin + '/api/notify-admin-booking', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bookingId: 'fixture-only', fullName: 'Fixture', equipmentName: 'Fixture equipment' }),
          });
          assert.equal(notified.status, 200);
          assert.equal((await notified.json()).deliveredToSMTP, true);
          const publicOrigin = process.env.PUBLIC_APP_URL || 'https://' + process.env.VERCEL_URL;
          assert(mail.html.includes('href="' + publicOrigin + '/admin.html"'));
          assert(!mail.html.includes('run.app'));
        } finally {
          await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
        }
      `], {
        cwd: root,
        timeout: 20_000,
        env: {
          PATH: process.env.PATH,
          TMPDIR: scratch,
          VERCEL: '1',
          VERCEL_URL: 'preview.example.invalid',
          PUBLIC_APP_URL: publicUrl,
          DOTENV_CONFIG_PATH: path.join(scratch, 'missing.env'),
          SMTP_HOST: 'smtp.example.invalid',
          SMTP_USER: 'fixture@example.invalid',
          SMTP_PASS: 'fixture-only',
          ADMIN_NOTIFICATION_EMAIL: 'admin@example.invalid',
        },
        stdio: 'pipe',
      });
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  });
}
