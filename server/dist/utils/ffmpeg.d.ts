export declare class FFmpegService {
    /**
     * 获取视频信息
     */
    getVideoInfo(inputPath: string): Promise<any>;
    /**
     * 获取视频时长（秒）
     */
    getVideoDuration(inputPath: string): Promise<number>;
    /**
     * 按指定时长裁切视频，返回所有片段路径
     */
    cutVideoByDuration(inputPath: string, segmentDuration: number, outputDir: string): Promise<string[]>;
    /**
     * 裁切单个视频片段
     */
    private cutVideoSegment;
    /**
     * 为视频添加音频轨道
     */
    addAudioToVideo(videoPath: string, audioPath: string, outputPath: string): Promise<void>;
    /**
     * 为视频添加字幕
     */
    addSubtitleToVideo(videoPath: string, subtitlePath: string, outputPath: string): Promise<void>;
    /**
     * 拼接多个视频
     */
    concatenateVideos(videoPaths: string[], outputPath: string): Promise<void>;
    /**
     * 调整视频分辨率和码率（可选功能）
     */
    resizeVideo(inputPath: string, outputPath: string, width: number, height: number): Promise<void>;
}
//# sourceMappingURL=ffmpeg.d.ts.map