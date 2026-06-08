const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
const BUCKET       = 'pods';

async function uploadFile(buffer, filename, mimeType) {
  const url = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${filename}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': mimeType || 'application/octet-stream',
      'x-upsert': 'true',
    },
    body: buffer,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase upload failed: ${res.status} ${text}`);
  }

  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${filename}`;
}

module.exports = { uploadFile };
