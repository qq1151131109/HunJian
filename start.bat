@echo off
chcp 65001 >nul

REM 游戏视频混剪程序快速启动脚本
REM 功能：自动检查并安装所有依赖，然后启动程序
REM 依赖：Node.js, Python, FFmpeg

echo 🎬 游戏视频混剪程序 启动中...
echo ✨ 自动检查系统环境和依赖...

REM 检查 Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js 未安装，请先安装 Node.js
    pause
    exit /b 1
)

REM 检查 Python
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python 未安装，请先安装 Python
    pause
    exit /b 1
)

REM 检查 FFmpeg
ffmpeg -version >nul 2>&1
if errorlevel 1 (
    echo ❌ FFmpeg 未安装，视频处理功能将无法使用
    echo 请下载 FFmpeg 并添加到系统 PATH
    pause
    exit /b 1
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

REM 检查并安装 Python 依赖
echo 🐍 检查Python依赖...
python -c "import faster_whisper" >nul 2>&1
if errorlevel 1 (
    echo 📦 安装Python依赖 (faster-whisper)...
    python -m pip install -r requirements.txt
    if errorlevel 0 (
        echo ✅ Python依赖安装成功
    ) else (
        echo ❌ Python依赖安装失败，字幕生成功能可能无法使用
    )
) else (
    echo ✅ Python依赖已安装
)

REM 创建 .env 文件（如果不存在）
if not exist "server\.env" (
    echo ⚙️  创建环境配置文件...
    copy ".env.example" "server\.env"
)

echo 🚀 启动服务器...
echo.
echo ⚠️  注意：端口可能会根据系统可用性自动调整
echo 📱 前端默认端口: 3000 (如被占用会自动递增到3001、3002...)
echo 🔧 后端默认端口: 8000 (可通过环境变量PORT指定)
echo.
echo 🌐 启动完成后请查看终端输出中显示的实际访问地址
echo 按 Ctrl+C 停止服务器
echo.

REM 启动开发服务器
npm run dev

pause