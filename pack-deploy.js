// 打包部署目录为 zip，自动排除敏感/临时文件
const fs = require('fs');
const path = require('path');
const { ZipArchive } = require('archiver');

const IGNORE_NAMES = new Set([
  'data.db', '__pycache__', '.pytest_cache', '.env',
  '.coverage', '_ui_test.db', 'server.log', 'node_modules'
]);

function addDir(zip, srcDir, zipBase) {
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    if (IGNORE_NAMES.has(entry.name)) continue;
    const full = path.join(srcDir, entry.name);
    const rel = zipBase ? `${zipBase}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      addDir(zip, full, rel);
    } else {
      zip.file(full, { name: rel });
    }
  }
}

function pack(srcDir, outFile) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outFile);
    const zip = new ZipArchive();
    zip.pipe(output);
    addDir(zip, srcDir, '');
    zip.finalize();
    output.on('close', () => {
      const kb = (fs.statSync(outFile).size / 1024).toFixed(1);
      console.log(`✓ ${path.basename(outFile)}  ${kb} KB`);
      resolve();
    });
    output.on('error', reject);
  });
}

(async () => {
  await pack('D:/桌面/占卜-netlify', 'D:/桌面/占卜-netlify.zip');
  await pack('D:/桌面/占卜-backend', 'D:/桌面/占卜-backend.zip');
  console.log('打包完成');
})();
