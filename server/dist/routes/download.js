"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const archiver_1 = __importDefault(require("archiver"));
const router = express_1.default.Router();
// 获取下载信息
router.get('/info/:processId', async (req, res) => {
    try {
        const { processId } = req.params;
        const outputDir = path_1.default.join(__dirname, '../../output', processId);
        if (!await fs_extra_1.default.pathExists(outputDir)) {
            return res.status(404).json({
                error: '处理结果不存在'
            });
        }
        const zipPath = path_1.default.join(outputDir, `${processId}_processed.zip`);
        if (!await fs_extra_1.default.pathExists(zipPath)) {
            // 如果压缩包不存在，创建它
            await createZipArchive(processId);
        }
        const stats = await fs_extra_1.default.stat(zipPath);
        res.json({
            id: processId,
            filename: `${processId}_processed.zip`,
            size: stats.size,
            url: `/api/download/${processId}`
        });
    }
    catch (error) {
        console.error('获取下载信息错误:', error);
        res.status(500).json({
            error: '获取下载信息失败',
            message: error.message
        });
    }
});
// 下载处理结果
router.get('/:processId', async (req, res) => {
    try {
        const { processId } = req.params;
        const outputDir = path_1.default.join(__dirname, '../../output', processId);
        const zipPath = path_1.default.join(outputDir, `${processId}_processed.zip`);
        if (!await fs_extra_1.default.pathExists(zipPath)) {
            // 如果压缩包不存在，创建它
            await createZipArchive(processId);
        }
        const stats = await fs_extra_1.default.stat(zipPath);
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${processId}_processed.zip"`);
        res.setHeader('Content-Length', stats.size);
        const stream = fs_extra_1.default.createReadStream(zipPath);
        stream.pipe(res);
    }
    catch (error) {
        console.error('下载文件错误:', error);
        res.status(500).json({
            error: '下载失败',
            message: error.message
        });
    }
});
// 创建压缩包
async function createZipArchive(processId) {
    return new Promise((resolve, reject) => {
        const outputDir = path_1.default.join(__dirname, '../../output', processId);
        const zipPath = path_1.default.join(outputDir, `${processId}_processed.zip`);
        const output = fs_extra_1.default.createWriteStream(zipPath);
        const archive = (0, archiver_1.default)('zip', {
            zlib: { level: 9 } // 最高压缩级别
        });
        output.on('close', () => {
            console.log(`压缩包创建完成: ${archive.pointer()} bytes`);
            resolve();
        });
        archive.on('error', (err) => {
            reject(err);
        });
        archive.pipe(output);
        // 添加所有处理后的文件
        const videosDir = path_1.default.join(outputDir, 'videos');
        if (fs_extra_1.default.existsSync(videosDir)) {
            archive.directory(videosDir, 'videos');
        }
        archive.finalize();
    });
}
exports.default = router;
//# sourceMappingURL=download.js.map