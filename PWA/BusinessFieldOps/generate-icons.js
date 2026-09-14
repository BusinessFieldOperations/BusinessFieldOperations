import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';
import sharp from 'sharp';
const UsageMsg = 'Usage: node generate-icons.js [--only-pwa|--only-tauri]'
const rawArgs = new Set(process.argv.slice(2));
const targetMode = (() => {
  if (rawArgs.has('--only-pwa')) return 'pwa';
  if (rawArgs.has('--only-tauri')) return 'tauri';
  if (rawArgs.has('--help') || rawArgs.has('-h')) {
    console.log(UsageMsg);
    process.exit(0);
  }
  if (rawArgs.size > 0) {
    console.error('Unknown option(s):', [...rawArgs].join(', '));
    console.error(UsageMsg);
    process.exit(1);
  }
  return 'all';
})();

const sourceFile = path.resolve('../../src/favicon.svg');
const publicDir = path.resolve('public');
const tauriIconsDir = path.resolve('src-tauri/icons');

const cacheDir = path.resolve('node_modules/.cache/app-icons');
const hashFile = path.join(cacheDir, '.icon-hash');

const shouldGeneratePWA = targetMode === 'all' || targetMode === 'pwa';
const shouldGenerateTauri = targetMode === 'all' || targetMode === 'tauri';

const copyDir = (src, dest) => {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
};

const saveToCache = () => {
  fs.mkdirSync(cacheDir, { recursive: true });

  if (shouldGeneratePWA) {
    fs.mkdirSync(path.join(cacheDir, 'public'), { recursive: true });
    copyDir(publicDir, path.join(cacheDir, 'public'));
  }

  if (shouldGenerateTauri) {
    fs.mkdirSync(path.join(cacheDir, 'tauri'), { recursive: true });
    copyDir(tauriIconsDir, path.join(cacheDir, 'tauri'));
  }

  fs.writeFileSync(hashFile, currentHash);
};

if (!fs.existsSync(sourceFile)) {
  console.error(`Source file not found: ${sourceFile}`);
  process.exit(1);
}

const svgContent = fs.readFileSync(sourceFile);
const currentHash = crypto.createHash('md5').update(svgContent).digest('hex');

if (fs.existsSync(hashFile)) {
  const previousHash = fs.readFileSync(hashFile, 'utf-8');
  const hasPwaCache = fs.existsSync(path.join(cacheDir, 'public', 'favicon-192.png')) && fs.existsSync(path.join(cacheDir, 'public', 'favicon-512.png'));
  const hasTauriCache = fs.existsSync(path.join(cacheDir, 'tauri'));

  if (previousHash === currentHash) {
    const canRestorePWA = !shouldGeneratePWA || hasPwaCache;
    const canRestoreTauri = !shouldGenerateTauri || hasTauriCache;

    if (canRestorePWA && canRestoreTauri) {
      console.log(`SVG has not changed. Restoring cached ${targetMode === 'all' ? 'icons' : `${targetMode} icons`}...`);

      if (shouldGeneratePWA) {
        fs.mkdirSync(publicDir, { recursive: true });
        copyDir(path.join(cacheDir, 'public'), publicDir);
      }

      if (shouldGenerateTauri) {
        fs.mkdirSync(tauriIconsDir, { recursive: true });
        copyDir(path.join(cacheDir, 'tauri'), tauriIconsDir);
      }

      process.exit(0);
    }
  }
}

console.log(`SVG changed or cache missing. Generating ${targetMode === 'all' ? 'all icons' : `${targetMode} icons`}...`);

if (shouldGeneratePWA) {
  fs.mkdirSync(publicDir, { recursive: true });
  fs.copyFileSync(sourceFile, path.join(publicDir, 'favicon.svg'));
}

if (shouldGenerateTauri) {
  fs.mkdirSync(tauriIconsDir, { recursive: true });
}

if (shouldGenerateTauri) {
  try {
    console.log('Generating Tauri icons...');
    execSync(`pnpm tauri icon "${sourceFile}"`, { stdio: 'inherit' });
  } catch (err) {
    console.error('Failed to generate Tauri icons:', err);
    process.exit(1);
  }
}

async function generatePWAIcons() {
  try {
    console.log('Generating PWA icons...');
    await sharp(sourceFile).resize(192, 192).toFile(path.join(publicDir, 'favicon-192.png'));
    await sharp(sourceFile).resize(512, 512).toFile(path.join(publicDir, 'favicon-512.png'));
  } catch (err) {
    console.error('Error generating PWA icons:', err);
    process.exit(1);
  }
}

try {
  if (shouldGeneratePWA) {
    await generatePWAIcons();
  }

  saveToCache();

  if (targetMode === 'all') {
    console.log('All icons successfully generated and cached!');
  } else if (targetMode === 'pwa') {
    console.log('PWA icons successfully generated and cached!');
  } else {
    console.log('Tauri icons successfully generated and cached!');
  }
} catch (err) {
  console.error('Unexpected error:', err);
  process.exit(1);
}