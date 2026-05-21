import 'dotenv/config';
import fs from 'node:fs';
import { Readable } from 'node:stream';
import { google } from 'googleapis';

async function main() {
  const creds = JSON.parse(fs.readFileSync(process.env.GOOGLE_SERVICE_ACCOUNT_PATH!, 'utf-8'));
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  });
  const drive = google.drive({ version: 'v3', auth });

  console.log('Looking for folder...');
  const list = await drive.files.list({
    q: "name = 'Tử Vi - Screenshots' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
    fields: 'files(id, name)',
  });
  console.log('Folder match:', list.data.files?.length, list.data.files);

  const buf = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgAAIAAAUAAeImBZsAAAAASUVORK5CYII=',
    'base64',
  );
  console.log('Uploading test file...');
  const folderId = list.data.files?.[0]?.id;
  const r = await drive.files.create({
    requestBody: {
      name: 'test-' + Date.now() + '.png',
      mimeType: 'image/png',
      parents: folderId ? [folderId] : undefined,
    },
    media: { mimeType: 'image/png', body: Readable.from(buf) },
    fields: 'id',
  });
  console.log('OK uploaded:', r.data.id);
  await drive.permissions.create({
    fileId: r.data.id!,
    requestBody: { role: 'reader', type: 'anyone' },
  });
  console.log('Permission set');
}
main().catch((e) => {
  console.error('ERR:', e.message);
  process.exit(1);
});
