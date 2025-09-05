@echo off
chcp 65001 >nul

echo 🎬 游戏视频混剪程序 启动中...

REM 检查 Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js 未安装，请先安装 Node.js
    pause
    exit /b 1
)

REM 检查 FFmpeg
ffmpeg -version >nul 2>&1
if errorlevel 1 (
    echo ⚠️  警告: FFmpeg 未安装，视频处理功能将无法使用
    echo 请下载 FFmpeg 并添加到系统 PATH
)

REM 检查依赖是否已安装
if not exist "node_modules" (
    echo 📦 安装根目录依赖...
    npm install
)

if not exist "client\node_modules" (
    echo 📦 安装前端依赖...
    cd client
    npm install
    cd ..
)

if not exist "server\node_modules" (
    echo 📦 安装后端依赖...
    cd server
    npm install
    cd ..
)

REM 创建 .env 文件（如果不存在）
if not exist "server\.env" (
    echo ⚙️  创建环境配置文件...
    copy ".env.example" "server\.env"
)

echo 🚀 启动服务器...
echo 📱 前端地址: http://localhost:3000
echo 🔧 后端地址: http://localhost:8001
echo.
echo 按 Ctrl+C 停止服务器
echo.

REM 启动开发服务器
npm run dev

pause