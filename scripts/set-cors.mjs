/**
 * Script para configurar CORS en Firebase Storage.
 * Uso: node scripts/set-cors.mjs
 * Requiere: npm install -g firebase-tools  y  firebase login
 */

import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const corsPath = path.join(__dirname, '..', 'cors.json');
const corsJson = readFileSync(corsPath, 'utf8');

// Obtener el bucket del .env.local
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = readFileSync(envPath, 'utf8');
const bucketLine = envContent.split('\n').find(l => l.startsWith('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET'));
const bucket = bucketLine?.split('=')[1]?.trim();

if (!bucket) {
  console.error('❌ No se encontró NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET en .env.local');
  process.exit(1);
}

console.log(`\n📦 Bucket detectado: ${bucket}`);
console.log('⚙️  Aplicando configuración CORS...\n');

try {
  execSync(`gsutil cors set "${corsPath}" gs://${bucket}`, { stdio: 'inherit' });
  console.log('\n✅ CORS configurado correctamente.');
  console.log(`\nVerifica con:\n  gsutil cors get gs://${bucket}\n`);
} catch {
  console.error('\n❌ No se pudo aplicar CORS. Asegúrate de tener gsutil instalado:');
  console.error('   brew install --cask google-cloud-sdk');
  console.error('   gcloud auth login');
  console.error(`   gsutil cors set cors.json gs://${bucket}\n`);
}
