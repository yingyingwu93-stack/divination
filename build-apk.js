#!/usr/bin/env node
/**
 * 一键打包 APK
 * 用法：node build-apk.js <后端地址>
 * 示例：node build-apk.js https://guanxiang-backend.onrender.com
 *
 * 流程：
 *   1. 把后端地址写入 js/api.js
 *   2. 复制前端文件到 www/
 *   3. 同步到 Android 项目
 *   4. 调用 gradlew 生成 debug APK
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BACKEND_URL = process.argv[2];

if (!BACKEND_URL) {
  console.error('❌ 请提供后端地址');
  console.error('   用法：node build-apk.js https://你的后端地址');
  process.exit(1);
}

const cleanUrl = BACKEND_URL.replace(/\/+$/, '');
const apiBase = `${cleanUrl}/api`;

function run(cmd, opts = {}) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { stdio: 'inherit', shell: true, ...opts });
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return false;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
  return true;
}

// ---------- 1. 写入 API 地址 ----------
console.log('=== 第 1 步：写入后端地址 ===');
const apiJsPath = path.join(__dirname, 'js', 'api.js');
let apiJs = fs.readFileSync(apiJsPath, 'utf8');

const newApiJs = apiJs.replace(
  /(const BACKEND_URL\s*=\s*)['"][^'"]*['"]/,
  `$1'${apiBase}'`
);

if (newApiJs === apiJs) {
  console.log('⚠️  未找到 BACKEND_URL 变量，请手动检查 js/api.js');
} else {
  fs.writeFileSync(apiJsPath, newApiJs, 'utf8');
  console.log(`✅ API 地址已设为：${apiBase}`);
}

// ---------- 2. 复制前端文件到 www/ ----------
console.log('\n=== 第 2 步：同步前端文件到 www/ ===');
const wwwDir = path.join(__dirname, 'www');
fs.mkdirSync(wwwDir, { recursive: true });

const itemsToCopy = [
  'index.html', 'bazi.html', 'ziwei.html', 'tarot.html', 'dream.html',
  'zodiac.html', 'history.html', 'settings.html', 'auth.html', 'admin.html',
  'manifest.json', 'sw.js', 'css', 'js', 'icons'
];

for (const item of itemsToCopy) {
  const src = path.join(__dirname, item);
  const dest = path.join(wwwDir, item);
  if (!fs.existsSync(src)) {
    console.log(`⚠️  跳过不存在的：${item}`);
    continue;
  }
  copyDir(src, dest);
}
console.log('✅ 前端文件已复制');

// ---------- 3. 同步到 Android ----------
console.log('\n=== 第 3 步：同步到 Android 项目 ===');
run('npx cap sync android');

// ---------- 4. 打包 APK ----------
console.log('\n=== 第 4 步：生成 APK（约 3-10 分钟）===');
const androidDir = path.join(__dirname, 'android');

// Windows 用 gradlew.bat，其他系统用 ./gradlew
const isWindows = process.platform === 'win32';
const gradleCmd = isWindows
  ? 'gradlew.bat assembleDebug'
  : './gradlew assembleDebug';

try {
  run(gradleCmd, { cwd: androidDir });
} catch (e) {
  console.error('\n❌ APK 构建失败。常见原因：');
  console.error('   1. 未安装 Android Studio / Android SDK');
  console.error('   2. 缺少 JAVA_HOME 环境变量');
  console.error('   3. 首次构建需要下载依赖（耗时较长）');
  console.error('\n👉 也可以直接用 Android Studio 打开 android 目录，');
  console.error('   然后 Build → Build Bundle(s) / APK(s) → Build APK(s)');
  process.exit(1);
}

// ---------- 5. 输出结果 ----------
const apkPath = path.join(
  androidDir, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk'
);

console.log('\n========================================');
if (fs.existsSync(apkPath)) {
  const sizeMB = (fs.statSync(apkPath).size / 1024 / 1024).toFixed(1);
  console.log('✅ APK 生成成功！');
  console.log(`   路径：${apkPath}`);
  console.log(`   大小：${sizeMB} MB`);
  console.log('\n📱 安装到手机：');
  console.log(`   把 ${apkPath} 发到手机，点击安装即可`);
  console.log('\n⚠️  首次安装需在手机上允许「安装未知来源应用」');
} else {
  console.log('❌ 未找到 APK，请检查上面的构建日志');
}
console.log('========================================');
