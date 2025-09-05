"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const upload_1 = require("../middleware/upload");
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const router = express_1.default.Router();
// 文件上传接口
router.post('/', upload_1.uploadFiles, async (req, res) => {
    try {
        const files = req.files;
        const { config } = req.body;
        if (!files || !files.videos || files.videos.length === 0) {
            return res.status(400).json({
                error: '没有上传视频文件'
            });
        }
        const processId = req.processId;
        const uploadPath = path_1.default.join(__dirname, '../../uploads', processId);
        // 保存配置信息
        const configData = {
            processId,
            config: JSON.parse(config || '{}'),
            files: {
                videos: files.videos.map(file => ({
                    filename: file.filename,
                    originalName: file.originalname,
                    path: file.path,
                    size: file.size,
                    mimetype: file.mimetype
                })),
                audioFile: files.audioFile ? {
                    filename: files.audioFile[0].filename,
                    originalName: files.audioFile[0].originalname,
                    path: files.audioFile[0].path,
                    size: files.audioFile[0].size,
                    mimetype: files.audioFile[0].mimetype
                } : null,
                trailerVideo: files.trailerVideo ? {
                    filename: files.trailerVideo[0].filename,
                    originalName: files.trailerVideo[0].originalname,
                    path: files.trailerVideo[0].path,
                    size: files.trailerVideo[0].size,
                    mimetype: files.trailerVideo[0].mimetype
                } : null
            },
            createdAt: new Date().toISOString()
        };
        // 保存配置文件
        await fs_extra_1.default.writeJSON(path_1.default.join(uploadPath, 'config.json'), configData, { spaces: 2 });
        res.json({
            success: true,
            processId,
            message: '文件上传成功',
            data: {
                totalVideos: files.videos.length,
                hasAudio: !!files.audioFile,
                hasTrailer: !!files.trailerVideo,
                uploadPath
            }
        });
    }
    catch (error) {
        console.error('文件上传错误:', error);
        res.status(500).json({
            error: '文件上传失败',
            message: error.message
        });
    }
});
// 获取上传状态
router.get('/status/:processId', async (req, res) => {
    try {
        const { processId } = req.params;
        const configPath = path_1.default.join(__dirname, '../../uploads', processId, 'config.json');
        if (!await fs_extra_1.default.pathExists(configPath)) {
            return res.status(404).json({
                error: '上传任务不存在'
            });
        }
        const config = await fs_extra_1.default.readJSON(configPath);
        res.json(config);
    }
    catch (error) {
        console.error('获取上传状态错误:', error);
        res.status(500).json({
            error: '获取状态失败',
            message: error.message
        });
    }
});
exports.default = router;
//# sourceMappingURL=upload.js.map