# 游戏视频混剪程序

一个自动化的游戏视频混剪处理程序，支持批量处理、音频添加、字幕嵌入和引流视频拼接。

## 功能特性

✅ **批量视频处理** - 支持文件夹上传，保持目录结构  
✅ **智能裁切** - 按指定时长裁切视频，自动丢弃不足时长的部分  
✅ **音频合成** - 为每个视频片段添加背景音频  
✅ **字幕嵌入** - 自动从指定目录随机选择字幕文件添加  
✅ **引流视频** - 在每个片段末尾拼接固定引流视频  
✅ **实时进度** - WebSocket实时显示处理进度  
✅ **批量下载** - 处理完成后一键打包下载  

## 系统要求

⚠️ **重要**: 开始前请先运行环境检查脚本
```bash
./check-env.sh
```

必需依赖：
- **Node.js** >= 18.0
- **Python** >= 3.8
- **FFmpeg** >= 4.0

详细安装指南请查看 [SYSTEM_REQUIREMENTS.md](./SYSTEM_REQUIREMENTS.md)

## 安装步骤

### 1. 安装依赖

```bash
# 安装所有依赖（包括Node.js和Python依赖）
npm run install:all
```

### 2. 配置环境变量

复制并修改环境变量文件：
```bash
cp .env.example server/.env
```

重要配置项：
- `SUBTITLE_PATH`: 字幕文件目录路径
- `MAX_FILE_SIZE`: 最大文件大小限制
- `FFMPEG_PATH`: FFmpeg路径（可选）

## 使用方法

### 启动程序

**🚀 推荐方式（一键启动）:**
```bash
# Linux/macOS
./start.sh

# Windows
start.bat
```
这些脚本会自动：
- 检查系统依赖（Node.js, Python, FFmpeg）
- 安装所有项目依赖（Node.js + Python）
- 创建配置文件
- 启动开发服务器

**手动启动方式:**
```bash
# 同时启动前后端
npm run dev

# 或分别启动
npm run server:dev  # 后端: http://localhost:8000
npm run client:dev  # 前端: http://localhost:3000
```

### 使用流程

1. **上传视频文件**
   - 支持拖拽上传或选择文件夹
   - 自动过滤非视频文件
   - 保持原有目录结构

2. **配置处理参数**
   - 设置目标时长（秒）
   - 上传背景音频文件（可选）
   - 上传引流视频（可选）
   - 字幕路径自动配置

3. **等待处理完成**
   - 实时显示处理进度
   - 显示当前处理文件
   - 错误信息反馈

4. **下载处理结果**
   - 一键下载压缩包
   - 打开输出文件夹
   - 保持原有目录结构

## 项目结构

```
gamevideo/
├── client/                 # React前端应用
│   ├── src/
│   │   ├── components/     # 组件目录
│   │   ├── services/       # API服务
│   │   └── ...
├── server/                 # Node.js后端
│   ├── src/
│   │   ├── controllers/    # 控制器
│   │   ├── services/       # 业务逻辑
│   │   ├── utils/          # 工具类
│   │   └── ...
│   ├── uploads/            # 上传文件目录
│   └── output/             # 输出文件目录
├── shared/                 # 共享类型定义
└── package.json           # 项目管理脚本
```

## 处理流程

对于每个上传的视频文件，程序会执行以下步骤：

1. **视频分析** - 获取视频时长和基本信息
2. **智能裁切** - 按目标时长切割成多个片段
3. **音频合成** - 为每个片段添加背景音频
4. **字幕嵌入** - 随机选择字幕文件并硬编码到视频
5. **引流拼接** - 在片段末尾拼接引流视频
6. **文件整理** - 按原目录结构组织输出文件

## 性能优化

- 使用FFmpeg硬件加速（如可用）
- 临时文件自动清理
- 多进程并行处理（未来版本）
- 进度实时更新

## 常见问题

**Q: 处理速度慢怎么办？**  
A: 检查FFmpeg是否支持硬件加速，确保有足够的磁盘空间

**Q: 字幕没有显示？**  
A: 检查字幕文件路径是否正确，支持.srt/.ass/.vtt格式

**Q: 内存不够？**  
A: 调整处理批次大小，或增加系统内存

## 技术栈

- **前端**: React + TypeScript + Ant Design
- **后端**: Node.js + Express + Socket.io
- **视频处理**: FFmpeg + fluent-ffmpeg
- **AI字幕**: faster-whisper
- **文件处理**: Multer + fs-extra

## 开发者

由 Claude Code 协助开发完成。

## 许可证

MIT License