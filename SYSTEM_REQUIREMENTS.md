# 系统环境要求

本项目需要以下系统级依赖：

## 必需工具

### 1. Node.js 环境
- **Node.js**: >= 18.0.0
- **npm**: >= 8.0.0

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install nodejs npm

# macOS (使用 Homebrew)
brew install node

# Windows
# 下载并安装 Node.js: https://nodejs.org/
```

### 2. Python 环境
- **Python**: >= 3.8
- **pip**: 最新版本

```bash
# Ubuntu/Debian
sudo apt install python3 python3-pip

# macOS
brew install python3

# Windows
# 下载并安装 Python: https://python.org/
```

### 3. FFmpeg (视频处理核心)
- **FFmpeg**: >= 4.0 (推荐 >= 6.0)
- **FFprobe**: 通常与FFmpeg一起安装

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install ffmpeg

# macOS
brew install ffmpeg

# Windows
# 下载 FFmpeg: https://ffmpeg.org/download.html
# 并添加到系统PATH
```

## 验证安装

运行以下命令验证所有依赖是否正确安装：

```bash
# 检查 Node.js
node --version
npm --version

# 检查 Python
python3 --version
pip3 --version

# 检查 FFmpeg
ffmpeg -version
ffprobe -version
```

## 自动安装

项目提供了自动安装脚本：

```bash
# 安装所有 Node.js 和 Python 依赖
npm run install:all
```

## 可选依赖

### Git (版本控制)
```bash
# Ubuntu/Debian
sudo apt install git

# macOS
brew install git

# Windows
# 下载 Git: https://git-scm.com/
```

## 系统要求

- **操作系统**: Linux, macOS, Windows 10/11
- **内存**: 至少 4GB RAM (推荐 8GB+)
- **磁盘空间**: 至少 2GB 可用空间
- **网络**: 首次运行需要网络下载模型文件

## 故障排除

### FFmpeg 问题
如果遇到 FFmpeg 相关错误，请确保：
1. FFmpeg 已正确安装并在 PATH 中
2. 版本 >= 4.0
3. 支持常见的视频编码格式

### Python 问题
如果遇到 Python 模块问题：
```bash
# 重新安装 Python 依赖
pip3 install -r requirements.txt --upgrade
```

### 权限问题
在 Linux/macOS 上如遇到权限问题：
```bash
# 给脚本执行权限
chmod +x start.sh
```