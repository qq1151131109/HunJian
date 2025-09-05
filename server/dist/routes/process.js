"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const upload_1 = require("../middleware/upload");
const videoProcessor_1 = require("../services/videoProcessor");
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
const router = express_1.default.Router();
// 存储处理任务的映射
const processingTasks = new Map();
// 开始处理视频
router.post('/start', upload_1.uploadFiles, async (req, res) => {
    try {
        const files = req.files;
        const { config } = req.body;
        if (!files || !files.videos || files.videos.length === 0) {
            return res.status(400).json({
                error: '没有上传视频文件'
            });
        }
        const processId = req.processId;
        const io = req.app.get('io');
        // 创建视频处理器实例
        const processor = new videoProcessor_1.VideoProcessor(processId, io);
        processingTasks.set(processId, processor);
        // 解析配置
        const processConfig = JSON.parse(config || '{}');
        // 准备处理参数
        const processingOptions = {
            videos: files.videos,
            audioFile: files.audioFile?.[0],
            trailerVideo: files.trailerVideo?.[0],
            config: {
                audioDuration: processConfig.audioDuration || 30,
                subtitlePath: processConfig.subtitlePath || '/Users/shenglin/Library/Mobile Documents/com~apple~CloudDocs/code/游戏混剪/remotion-subtitles'
            }
        };
        // 异步开始处理
        processor.startProcessing(processingOptions).catch(error => {
            console.error(`处理任务 ${processId} 失败:`, error);
        });
        res.json({
            success: true,
            processId,
            message: '开始处理视频',
            totalFiles: files.videos.length
        });
    }
    catch (error) {
        console.error('启动处理失败:', error);
        res.status(500).json({
            error: '启动处理失败',
            message: error.message
        });
    }
});
// 获取处理状态
router.get('/status/:processId', async (req, res) => {
    try {
        const { processId } = req.params;
        const processor = processingTasks.get(processId);
        if (!processor) {
            // 尝试从文件系统读取状态
            const statusPath = path_1.default.join(__dirname, '../../output', processId, 'status.json');
            if (await fs_extra_1.default.pathExists(statusPath)) {
                const status = await fs_extra_1.default.readJSON(statusPath);
                return res.json(status);
            }
            return res.status(404).json({
                error: '处理任务不存在'
            });
        }
        const status = processor.getStatus();
        res.json(status);
    }
    catch (error) {
        console.error('获取处理状态错误:', error);
        res.status(500).json({
            error: '获取状态失败',
            message: error.message
        });
    }
});
// 停止处理
router.post('/stop/:processId', async (req, res) => {
    try {
        const { processId } = req.params;
        const processor = processingTasks.get(processId);
        if (!processor) {
            return res.status(404).json({
                error: '处理任务不存在'
            });
        }
        await processor.stopProcessing();
        processingTasks.delete(processId);
        res.json({
            success: true,
            message: '处理已停止'
        });
    }
    catch (error) {
        console.error('停止处理错误:', error);
        res.status(500).json({
            error: '停止处理失败',
            message: error.message
        });
    }
});
// 打开输出文件夹
router.post('/open-folder/:processId', async (req, res) => {
    try {
        const { processId } = req.params;
        const outputDir = path_1.default.join(__dirname, '../../output', processId);
        if (!await fs_extra_1.default.pathExists(outputDir)) {
            return res.status(404).json({
                error: '输出目录不存在'
            });
        }
        // 根据操作系统打开文件夹
        const platform = process.platform;
        let command;
        if (platform === 'darwin') {
            command = `open "${outputDir}"`;
        }
        else if (platform === 'win32') {
            command = `explorer "${outputDir}"`;
        }
        else {
            command = `xdg-open "${outputDir}"`;
        }
        await execAsync(command);
        res.json({
            success: true,
            message: '文件夹已打开'
        });
    }
    catch (error) {
        console.error('打开文件夹错误:', error);
        res.status(500).json({
            error: '打开文件夹失败',
            message: error.message
        });
    }
});
exports.default = router;
//# sourceMappingURL=process.js.map