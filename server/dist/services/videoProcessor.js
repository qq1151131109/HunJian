"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VideoProcessor = void 0;
const path_1 = __importDefault(require("path"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const ffmpeg_1 = require("../utils/ffmpeg");
class VideoProcessor {
    constructor(processId, io) {
        this.isProcessing = false;
        this.shouldStop = false;
        this.processId = processId;
        this.io = io;
        this.ffmpeg = new ffmpeg_1.FFmpegService();
        this.status = {
            id: processId,
            status: 'pending',
            progress: 0,
            totalFiles: 0,
            processedFiles: 0
        };
    }
    async startProcessing(options) {
        try {
            if (this.isProcessing) {
                throw new Error('任务正在处理中');
            }
            this.isProcessing = true;
            this.shouldStop = false;
            // 更新初始状态
            this.status = {
                ...this.status,
                status: 'processing',
                totalFiles: options.videos.length,
                processedFiles: 0,
                progress: 0
            };
            await this.saveStatus();
            this.emitStatusUpdate();
            const outputDir = path_1.default.join(__dirname, '../../output', this.processId);
            await fs_extra_1.default.ensureDir(outputDir);
            const results = [];
            // 处理每个视频文件
            for (let i = 0; i < options.videos.length; i++) {
                if (this.shouldStop) {
                    break;
                }
                const videoFile = options.videos[i];
                const result = await this.processVideo(videoFile, options, outputDir, i);
                results.push(result);
                this.status.processedFiles++;
                this.status.progress = (this.status.processedFiles / this.status.totalFiles) * 100;
                await this.saveStatus();
                this.emitStatusUpdate();
                this.emitFileProcessed(result);
            }
            // 完成处理
            if (!this.shouldStop) {
                this.status.status = 'completed';
                this.status.progress = 100;
            }
            else {
                this.status.status = 'error';
                this.status.error = '处理被用户取消';
            }
            await this.saveStatus();
            this.emitProcessComplete();
        }
        catch (error) {
            console.error(`处理任务 ${this.processId} 失败:`, error);
            this.status.status = 'error';
            this.status.error = error.message;
            await this.saveStatus();
            this.emitProcessComplete();
        }
        finally {
            this.isProcessing = false;
        }
    }
    async processVideo(videoFile, options, outputDir, index) {
        try {
            this.status.currentFile = videoFile.originalname;
            this.emitStatusUpdate();
            const inputPath = videoFile.path;
            const relativePath = this.getVideoRelativePath(videoFile);
            const outputSubDir = path_1.default.join(outputDir, 'videos', path_1.default.dirname(relativePath));
            await fs_extra_1.default.ensureDir(outputSubDir);
            const baseName = path_1.default.basename(relativePath, path_1.default.extname(relativePath));
            const tempDir = path_1.default.join(outputDir, 'temp', `video_${index}`);
            await fs_extra_1.default.ensureDir(tempDir);
            // 步骤1: 获取视频信息并裁切
            const segments = await this.ffmpeg.cutVideoByDuration(inputPath, options.config.audioDuration, tempDir);
            const processedSegments = [];
            // 处理每个片段
            for (let segIndex = 0; segIndex < segments.length; segIndex++) {
                const segment = segments[segIndex];
                let currentSegment = segment;
                // 步骤2: 添加音频（如果有）
                if (options.audioFile) {
                    const withAudioPath = path_1.default.join(tempDir, `segment_${segIndex}_with_audio.mp4`);
                    await this.ffmpeg.addAudioToVideo(currentSegment, options.audioFile.path, withAudioPath);
                    currentSegment = withAudioPath;
                }
                // 步骤3: 添加字幕（如果字幕目录存在）
                if (await fs_extra_1.default.pathExists(options.config.subtitlePath)) {
                    const subtitleFiles = await this.findSubtitleFiles(options.config.subtitlePath);
                    if (subtitleFiles.length > 0) {
                        // 随机选择一个字幕文件
                        const randomSubtitle = subtitleFiles[Math.floor(Math.random() * subtitleFiles.length)];
                        const withSubtitlePath = path_1.default.join(tempDir, `segment_${segIndex}_with_subtitle.mp4`);
                        await this.ffmpeg.addSubtitleToVideo(currentSegment, randomSubtitle, withSubtitlePath);
                        currentSegment = withSubtitlePath;
                    }
                }
                // 步骤4: 添加引流视频（如果有）
                let finalPath;
                if (options.trailerVideo) {
                    finalPath = path_1.default.join(outputSubDir, `${baseName}_segment_${segIndex}_final.mp4`);
                    await this.ffmpeg.concatenateVideos([currentSegment, options.trailerVideo.path], finalPath);
                }
                else {
                    finalPath = path_1.default.join(outputSubDir, `${baseName}_segment_${segIndex}_final.mp4`);
                    await fs_extra_1.default.copy(currentSegment, finalPath);
                }
                processedSegments.push(finalPath);
            }
            // 清理临时文件
            await fs_extra_1.default.remove(tempDir);
            return {
                id: `${this.processId}_${index}`,
                originalFile: videoFile.originalname,
                outputFile: `处理完成，生成 ${processedSegments.length} 个片段`,
                status: 'success'
            };
        }
        catch (error) {
            console.error(`处理视频 ${videoFile.originalname} 失败:`, error);
            return {
                id: `${this.processId}_${index}`,
                originalFile: videoFile.originalname,
                outputFile: '',
                status: 'error',
                error: error.message
            };
        }
    }
    getVideoRelativePath(videoFile) {
        // 从文件路径中提取相对路径
        const pathParts = videoFile.path.split('/');
        const videosIndex = pathParts.findIndex(part => part === 'videos');
        if (videosIndex !== -1 && videosIndex < pathParts.length - 1) {
            return pathParts.slice(videosIndex + 1).join('/');
        }
        return videoFile.originalname;
    }
    async findSubtitleFiles(subtitlePath) {
        try {
            if (!await fs_extra_1.default.pathExists(subtitlePath)) {
                return [];
            }
            const files = await fs_extra_1.default.readdir(subtitlePath);
            return files
                .filter(file => /\.(srt|ass|ssa|vtt)$/i.test(file))
                .map(file => path_1.default.join(subtitlePath, file));
        }
        catch (error) {
            console.error('查找字幕文件失败:', error);
            return [];
        }
    }
    async saveStatus() {
        try {
            const statusPath = path_1.default.join(__dirname, '../../output', this.processId, 'status.json');
            await fs_extra_1.default.ensureDir(path_1.default.dirname(statusPath));
            await fs_extra_1.default.writeJSON(statusPath, this.status, { spaces: 2 });
        }
        catch (error) {
            console.error('保存状态失败:', error);
        }
    }
    emitStatusUpdate() {
        this.io.to(`process-${this.processId}`).emit('progress-update', this.status);
    }
    emitFileProcessed(result) {
        this.io.to(`process-${this.processId}`).emit('file-processed', result);
    }
    emitProcessComplete() {
        this.io.to(`process-${this.processId}`).emit('process-complete', this.status);
    }
    async stopProcessing() {
        this.shouldStop = true;
    }
    getStatus() {
        return this.status;
    }
}
exports.VideoProcessor = VideoProcessor;
//# sourceMappingURL=videoProcessor.js.map