#!/bin/bash

# 游戏视频混剪程序快速启动脚本

echo "🎬 游戏视频混剪程序 启动中..."

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js 未安装，请先安装 Node.js"
    exit 1
fi

# 检查 FFmpeg
if ! command -v ffmpeg &> /dev/null; then
    echo "⚠️  警告: FFmpeg 未安装，视频处理功能将无法使用"
    echo "请运行以下命令安装 FFmpeg:"
    echo "  macOS: brew install ffmpeg"
    echo "  Ubuntu: sudo apt install ffmpeg"
fi

# 检查依赖是否已安装
if [ ! -d "node_modules" ]; then
    echo "📦 安装根目录依赖..."
    npm install
fi

if [ ! -d "client/node_modules" ]; then
    echo "📦 安装前端依赖..."
    cd client && npm install && cd ..
fi

if [ ! -d "server/node_modules" ]; then
    echo "📦 安装后端依赖..."
    cd server && npm install && cd ..
fi

# 创建 .env 文件（如果不存在）
if [ ! -f "server/.env" ]; then
    echo "⚙️  创建环境配置文件..."
    cp .env.example server/.env
fi

echo "🚀 启动服务器..."
echo "📱 前端地址: http://localhost:3000"
echo "🔧 后端地址: http://localhost:8000"
echo ""
echo "按 Ctrl+C 停止服务器"
echo ""

# 启动开发服务器
npm run dev