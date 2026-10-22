@echo off
chcp 65001 >nul
echo ============================================
echo    🔮 占卜平台 - 启动
echo ============================================
echo.

cd /d "%~dp0\backend"

echo [1/2] 检查 Python...
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ 未找到 Python，请先安装 Python 3.8+
    pause
    exit /b 1)
echo ✅ Python 已安装

echo.
echo [2/2] 安装依赖...
pip install -r requirements.txt -q
if errorlevel 1 (
    echo ❌ 依赖安装失败
    pause
    exit /b 1)
echo ✅ 依赖安装完成

echo.
echo ============================================
echo    🚀 启动服务器...
echo    打开浏览器访问: http://localhost:5001
echo ============================================
echo.

python app.py
pause
