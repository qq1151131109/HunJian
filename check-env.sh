#!/bin/bash

echo "🔍 检查系统环境..."
echo

# 检查颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

check_command() {
    if command -v "$1" &> /dev/null; then
        echo -e "✅ $1: ${GREEN}已安装${NC}"
        if [ "$2" = "version" ]; then
            echo "   版本: $($1 --version | head -1)"
        fi
        return 0
    else
        echo -e "❌ $1: ${RED}未安装${NC}"
        return 1
    fi
}

check_node() {
    if command -v node &> /dev/null; then
        VERSION=$(node --version | sed 's/v//')
        MAJOR_VERSION=$(echo $VERSION | cut -d. -f1)
        if [ "$MAJOR_VERSION" -ge 18 ]; then
            echo -e "✅ Node.js: ${GREEN}v$VERSION${NC} (>= 18.0 ✓)"
        else
            echo -e "⚠️  Node.js: ${YELLOW}v$VERSION${NC} (推荐 >= 18.0)"
        fi
        return 0
    else
        echo -e "❌ Node.js: ${RED}未安装${NC}"
        return 1
    fi
}

check_python() {
    if command -v python3 &> /dev/null; then
        VERSION=$(python3 --version | sed 's/Python //')
        echo -e "✅ Python: ${GREEN}$VERSION${NC}"
        return 0
    else
        echo -e "❌ Python: ${RED}未安装${NC}"
        return 1
    fi
}

check_ffmpeg() {
    if command -v ffmpeg &> /dev/null; then
        VERSION=$(ffmpeg -version | head -1 | grep -o 'version [0-9.]*' | cut -d' ' -f2)
        echo -e "✅ FFmpeg: ${GREEN}$VERSION${NC}"
        return 0
    else
        echo -e "❌ FFmpeg: ${RED}未安装${NC}"
        return 1
    fi
}

echo "📋 必需依赖检查:"
echo "===================="

# 检查所有依赖
check_node
NODE_OK=$?

check_command npm
NPM_OK=$?

check_python  
PYTHON_OK=$?

check_command pip3
PIP_OK=$?

check_ffmpeg
FFMPEG_OK=$?

check_command ffprobe
FFPROBE_OK=$?

echo
echo "📋 可选依赖检查:"
echo "===================="
check_command git

echo
echo "📊 检查结果:"
echo "===================="

if [ $NODE_OK -eq 0 ] && [ $NPM_OK -eq 0 ] && [ $PYTHON_OK -eq 0 ] && [ $PIP_OK -eq 0 ] && [ $FFMPEG_OK -eq 0 ] && [ $FFPROBE_OK -eq 0 ]; then
    echo -e "${GREEN}🎉 所有必需依赖已安装！可以运行项目了。${NC}"
    echo
    echo "下一步:"
    echo "  npm run install:all  # 安装项目依赖"
    echo "  npm run dev          # 启动开发环境"
else
    echo -e "${RED}⚠️  部分依赖缺失，请参考 SYSTEM_REQUIREMENTS.md 安装缺失的依赖。${NC}"
fi

echo