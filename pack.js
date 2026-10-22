const fs = require('fs');
const path = require('path');
const { ZipArchive } = require('archiver');

const files = [
  'index.html', 'dream.html', 'zodiac.html', 'tarot.html', 'bazi.html',
  'css/style.css',
  'js/data.js', 'js/main.js', 'js/tarot.js', 'js/longcat.js', 'js/bazi.js', 'js/pwa.js',
  'icons/icon.svg',
  'functions/tarot.js',
  'netlify.toml', 'manifest.json', 'sw.js'
];

const baseDir = 'D:/桌面/占卜';
const output = fs.createWriteStream('D:/桌面/占卜-netlify.zip');
const zip = new ZipArchive();

zip.pipe(output);

for (const file of files) {
  const fullPath = path.join(baseDir, file);
  if (fs.existsSync(fullPath)) {
    zip.file(fullPath, { name: file });
  }
}

zip.finalize();
output.on('close', () => {
  const size = fs.statSync('D:/桌面/占卜-netlify.zip').size;
  console.log('完成! 大小: ' + (size / 1024).toFixed(1) + 'KB');
});
