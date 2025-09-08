# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

这是一个游戏视频混剪处理程序，支持批量视频处理、音频添加、字幕嵌入和引流视频拼接。项目采用前后端分离架构，前端使用React + Ant Design，后端使用Node.js + Express + Socket.io，核心视频处理依赖FFmpeg。

## 系统要求

⚠️ **开始开发前，请先查看 [系统环境要求](./SYSTEM_REQUIREMENTS.md)**

项目需要以下系统依赖：
- Node.js >= 18.0
- Python >= 3.8 
- FFmpeg >= 4.0

## 核心开发命令

```bash
# 启动完整开发环境（前后端同时运行）
npm run dev

# 分别启动前后端
npm run server:dev  # 后端: http://localhost:8002
npm run client:dev  # 前端: http://localhost:3000

# 安装所有依赖（包括Node.js和Python依赖）
npm run install:all

# 如果需要单独安装Python依赖
python3 -m pip install -r requirements.txt

# 构建项目
npm run client:build
npm run server:build

# 运行测试
npx playwright test
```

## 关键架构和工作流程

### 视频处理核心流程
1. **智能音频时长计算**: 系统根据上传的音频文件和引流视频自动计算裁切时长
   - 引流视频有音频: 裁切时长 = 音频时长
   - 引流视频无音频: 裁切时长 = 音频时长 - 引流视频时长
2. **视频标准化**: 所有视频先标准化为720x1280 TikTok竖屏格式
3. **批量处理**: 按时长裁切 → 添加音频 → 嵌入字幕 → 拼接引流视频

### 关键服务类
- `FFmpegService` (`server/src/utils/ffmpeg.ts`): 封装所有FFmpeg操作，包括音频时长检测、视频标准化、拼接等
- `VideoProcessor` (`server/src/services/videoProcessor.ts`): 处理单个任务的完整工作流，管理Socket.io通信
- `ProcessorManager` (`server/src/routes/process.ts`): 管理多个处理任务的生命周期

### 实时通信架构
使用Socket.io实现前后端实时通信：
- `progress-update`: 处理进度更新  
- `file-processed`: 单个文件处理完成
- `process-complete`: 整个任务完成

### 共享类型定义
核心接口定义在 `shared/types.ts` 中，前后端共享：
- `ProcessStatus`: 处理状态和进度
- `ProcessResult`: 单个文件处理结果
- `ProcessConfig`: 处理配置参数

## 重要配置文件

### 环境变量配置

**服务器配置 (`server/.env`)**
```
PORT=8000
UPLOAD_DIR=./uploads           # 上传文件目录（相对路径）
OUTPUT_DIR=./output            # 输出文件目录（相对路径）
SUBTITLE_PATH=../subtitles     # 字幕文件目录（相对路径）
MAX_FILE_SIZE=1073741824       # 最大文件大小（1GB）
FFMPEG_PATH=/usr/bin/ffmpeg    # FFmpeg路径（可选）
```

**前端配置 (`client/.env`)**
```
VITE_SUBTITLE_PATH=../subtitles  # 字幕文件目录（相对路径）
```

**路径配置说明：**
- 所有路径均使用相对路径，方便项目部署
- `../subtitles` 指向项目根目录下的 `subtitles` 文件夹
- 字幕文件放在项目根目录的 `subtitles` 文件夹中

### nodemon配置 (`server/nodemon.json`)
已配置忽略uploads、output等目录，防止文件处理过程中重启服务器。

## 文件结构要点

```
├── client/src/
│   ├── App.tsx              # 主应用组件，包含完整的处理流程UI
│   ├── services/api.ts      # API服务封装
│   └── types/shared.ts      # 前端类型定义
├── server/src/
│   ├── app.ts              # 服务器入口，Socket.io配置
│   ├── routes/process.ts   # 处理任务路由和管理器
│   ├── services/videoProcessor.ts  # 视频处理核心逻辑
│   ├── utils/ffmpeg.ts     # FFmpeg操作封装
│   └── middleware/upload.ts # 文件上传处理
├── shared/types.ts         # 前后端共享类型定义
├── subtitles/              # 字幕文件目录（项目级）
│   └── *.srt/*.ass/*.vtt   # 支持的字幕格式文件
├── server/uploads/         # 上传文件临时目录
└── server/output/          # 处理结果输出目录
```

## FFmpeg关键功能

系统实现了完整的FFmpeg操作封装，包括：
- `getAudioDuration()`: 获取音频文件时长
- `getVideoAudioDuration()`: 获取视频中音频轨道时长
- `normalizeVideo()`: 视频格式标准化为TikTok格式
- `concatenateVideos()`: 视频拼接（使用concat demuxer方法）
- `cutVideoByDuration()`: 按时长裁切视频

## 开发注意事项

- 视频处理过程中需要大量临时文件，系统会自动清理
- 使用Socket.io房间机制隔离不同用户的处理任务  
- 所有视频操作都是异步的，需要适当的错误处理和超时控制
- nodemon已配置忽略output和uploads目录，避免处理过程中服务重启