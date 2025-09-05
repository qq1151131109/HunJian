"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FFmpegService = void 0;
const fluent_ffmpeg_1 = __importDefault(require("fluent-ffmpeg"));
const path_1 = __importDefault(require("path"));
const fs_extra_1 = __importDefault(require("fs-extra"));
// 设置 FFmpeg 路径（如果需要）
if (process.env.FFMPEG_PATH) {
    fluent_ffmpeg_1.default.setFfmpegPath(process.env.FFMPEG_PATH);
}
if (process.env.FFPROBE_PATH) {
    fluent_ffmpeg_1.default.setFfprobePath(process.env.FFPROBE_PATH);
}
class FFmpegService {
    /**
     * 获取视频信息
     */
    async getVideoInfo(inputPath) {
        return new Promise((resolve, reject) => {
            fluent_ffmpeg_1.default.ffprobe(inputPath, (err, metadata) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(metadata);
                }
            });
        });
    }
    /**
     * 获取视频时长（秒）
     */
    async getVideoDuration(inputPath) {
        const metadata = await this.getVideoInfo(inputPath);
        return metadata.format.duration || 0;
    }
    /**
     * 按指定时长裁切视频，返回所有片段路径
     */
    async cutVideoByDuration(inputPath, segmentDuration, outputDir) {
        try {
            const totalDuration = await this.getVideoDuration(inputPath);
            const numSegments = Math.floor(totalDuration / segmentDuration);
            if (numSegments === 0) {
                console.log(`视频时长 ${totalDuration}s 小于目标时长 ${segmentDuration}s，跳过处理`);
                return [];
            }
            const segments = [];
            // 生成每个片段
            for (let i = 0; i < numSegments; i++) {
                const startTime = i * segmentDuration;
                const outputPath = path_1.default.join(outputDir, `segment_${i}.mp4`);
                await this.cutVideoSegment(inputPath, startTime, segmentDuration, outputPath);
                segments.push(outputPath);
            }
            console.log(`视频裁切完成，生成 ${segments.length} 个片段`);
            return segments;
        }
        catch (error) {
            console.error('视频裁切失败:', error);
            throw error;
        }
    }
    /**
     * 裁切单个视频片段
     */
    async cutVideoSegment(inputPath, startTime, duration, outputPath) {
        return new Promise((resolve, reject) => {
            (0, fluent_ffmpeg_1.default)(inputPath)
                .seekInput(startTime)
                .duration(duration)
                .videoCodec('libx264')
                .audioCodec('aac')
                .outputOptions([
                '-preset fast',
                '-crf 23',
                '-movflags +faststart'
            ])
                .output(outputPath)
                .on('end', () => {
                console.log(`片段生成完成: ${outputPath}`);
                resolve();
            })
                .on('error', (err) => {
                console.error(`片段生成失败: ${outputPath}`, err);
                reject(err);
            })
                .run();
        });
    }
    /**
     * 为视频添加音频轨道
     */
    async addAudioToVideo(videoPath, audioPath, outputPath) {
        return new Promise((resolve, reject) => {
            (0, fluent_ffmpeg_1.default)()
                .input(videoPath)
                .input(audioPath)
                .outputOptions([
                '-c:v copy', // 保持视频编码不变
                '-c:a aac', // 音频编码为AAC
                '-map 0:v:0', // 使用第一个输入的视频流
                '-map 1:a:0', // 使用第二个输入的音频流
                '-shortest', // 以最短的流为准
                '-movflags +faststart'
            ])
                .output(outputPath)
                .on('end', () => {
                console.log(`音频添加完成: ${outputPath}`);
                resolve();
            })
                .on('error', (err) => {
                console.error(`音频添加失败: ${outputPath}`, err);
                reject(err);
            })
                .run();
        });
    }
    /**
     * 为视频添加字幕
     */
    async addSubtitleToVideo(videoPath, subtitlePath, outputPath) {
        return new Promise((resolve, reject) => {
            const subtitleExt = path_1.default.extname(subtitlePath).toLowerCase();
            let subtitleFilter;
            if (subtitleExt === '.srt' || subtitleExt === '.vtt') {
                // SRT/VTT 字幕，硬编码到视频中
                subtitleFilter = `subtitles='${subtitlePath.replace(/'/g, "\\'")}':force_style='FontName=Arial,FontSize=24,PrimaryColour=&H00ffffff,OutlineColour=&H00000000,Outline=2'`;
            }
            else if (subtitleExt === '.ass' || subtitleExt === '.ssa') {
                // ASS/SSA 字幕
                subtitleFilter = `ass='${subtitlePath.replace(/'/g, "\\'")}'`;
            }
            else {
                reject(new Error(`不支持的字幕格式: ${subtitleExt}`));
                return;
            }
            (0, fluent_ffmpeg_1.default)(videoPath)
                .videoFilters(subtitleFilter)
                .videoCodec('libx264')
                .audioCodec('copy') // 保持音频不变
                .outputOptions([
                '-preset fast',
                '-crf 23',
                '-movflags +faststart'
            ])
                .output(outputPath)
                .on('end', () => {
                console.log(`字幕添加完成: ${outputPath}`);
                resolve();
            })
                .on('error', (err) => {
                console.error(`字幕添加失败: ${outputPath}`, err);
                // 如果字幕添加失败，尝试复制原视频
                fs_extra_1.default.copy(videoPath, outputPath).then(() => {
                    console.log('字幕添加失败，使用原视频');
                    resolve();
                }).catch(reject);
            })
                .run();
        });
    }
    /**
     * 拼接多个视频
     */
    async concatenateVideos(videoPaths, outputPath) {
        return new Promise((resolve, reject) => {
            if (videoPaths.length === 0) {
                reject(new Error('没有视频文件需要拼接'));
                return;
            }
            if (videoPaths.length === 1) {
                // 只有一个视频，直接复制
                fs_extra_1.default.copy(videoPaths[0], outputPath).then(resolve).catch(reject);
                return;
            }
            const command = (0, fluent_ffmpeg_1.default)();
            // 添加所有输入文件
            videoPaths.forEach(videoPath => {
                command.input(videoPath);
            });
            // 构建复杂过滤器字符串
            let filterComplex = '';
            for (let i = 0; i < videoPaths.length; i++) {
                filterComplex += `[${i}:v][${i}:a]`;
            }
            filterComplex += `concat=n=${videoPaths.length}:v=1:a=1[outv][outa]`;
            command
                .complexFilter(filterComplex)
                .outputOptions(['-map [outv]', '-map [outa]'])
                .videoCodec('libx264')
                .audioCodec('aac')
                .outputOptions([
                '-preset fast',
                '-crf 23',
                '-movflags +faststart'
            ])
                .output(outputPath)
                .on('end', () => {
                console.log(`视频拼接完成: ${outputPath}`);
                resolve();
            })
                .on('error', (err) => {
                console.error(`视频拼接失败: ${outputPath}`, err);
                reject(err);
            })
                .run();
        });
    }
    /**
     * 调整视频分辨率和码率（可选功能）
     */
    async resizeVideo(inputPath, outputPath, width, height) {
        return new Promise((resolve, reject) => {
            (0, fluent_ffmpeg_1.default)(inputPath)
                .size(`${width}x${height}`)
                .aspect('16:9')
                .videoCodec('libx264')
                .audioCodec('aac')
                .outputOptions([
                '-preset fast',
                '-crf 23',
                '-movflags +faststart'
            ])
                .output(outputPath)
                .on('end', () => {
                console.log(`视频调整完成: ${outputPath}`);
                resolve();
            })
                .on('error', (err) => {
                console.error(`视频调整失败: ${outputPath}`, err);
                reject(err);
            })
                .run();
        });
    }
}
exports.FFmpegService = FFmpegService;
//# sourceMappingURL=ffmpeg.js.map