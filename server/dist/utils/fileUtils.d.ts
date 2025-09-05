export declare class FileUtils {
    /**
     * 递归获取目录下的所有视频文件
     */
    static getVideoFiles(dirPath: string, extensions?: string[]): Promise<string[]>;
    /**
     * 获取相对路径
     */
    static getRelativePath(fullPath: string, basePath: string): string;
    /**
     * 确保目录存在
     */
    static ensureDir(dirPath: string): Promise<void>;
    /**
     * 复制文件并保持目录结构
     */
    static copyWithStructure(sourcePath: string, sourceBaseDir: string, targetBaseDir: string): Promise<string>;
    /**
     * 格式化文件大小
     */
    static formatFileSize(bytes: number): string;
    /**
     * 获取文件信息
     */
    static getFileInfo(filePath: string): Promise<{
        size: number;
        created: Date;
        modified: Date;
        extension: string;
        basename: string;
        dirname: string;
    }>;
    /**
     * 清理临时文件
     */
    static cleanupTempFiles(tempDir: string, olderThan?: number): Promise<void>;
    /**
     * 检查磁盘空间
     */
    static checkDiskSpace(dirPath: string): Promise<{
        free: number;
        total: number;
        used: number;
    }>;
    /**
     * 创建唯一的文件名
     */
    static createUniqueFilename(originalName: string, directory: string): string;
    /**
     * 验证文件类型
     */
    static isVideoFile(filename: string): boolean;
    static isAudioFile(filename: string): boolean;
    static isSubtitleFile(filename: string): boolean;
    /**
     * 生成安全的文件名（去除特殊字符）
     */
    static sanitizeFilename(filename: string): string;
    /**
     * 递归删除空目录
     */
    static removeEmptyDirs(dirPath: string): Promise<void>;
}
//# sourceMappingURL=fileUtils.d.ts.map