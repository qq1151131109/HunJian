"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileUtils = void 0;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
class FileUtils {
    /**
     * 递归获取目录下的所有视频文件
     */
    static async getVideoFiles(dirPath, extensions = ['.mp4', '.avi', '.mov', '.mkv', '.flv', '.wmv']) {
        const videoFiles = [];
        try {
            const items = await fs_extra_1.default.readdir(dirPath, { withFileTypes: true });
            for (const item of items) {
                const fullPath = path_1.default.join(dirPath, item.name);
                if (item.isDirectory()) {
                    // 递归处理子目录
                    const subFiles = await this.getVideoFiles(fullPath, extensions);
                    videoFiles.push(...subFiles);
                }
                else if (item.isFile()) {
                    // 检查文件扩展名
                    const ext = path_1.default.extname(item.name).toLowerCase();
                    if (extensions.includes(ext)) {
                        videoFiles.push(fullPath);
                    }
                }
            }
        }
        catch (error) {
            console.error(`读取目录失败: ${dirPath}`, error);
        }
        return videoFiles;
    }
    /**
     * 获取相对路径
     */
    static getRelativePath(fullPath, basePath) {
        return path_1.default.relative(basePath, fullPath);
    }
    /**
     * 确保目录存在
     */
    static async ensureDir(dirPath) {
        await fs_extra_1.default.ensureDir(dirPath);
    }
    /**
     * 复制文件并保持目录结构
     */
    static async copyWithStructure(sourcePath, sourceBaseDir, targetBaseDir) {
        const relativePath = this.getRelativePath(sourcePath, sourceBaseDir);
        const targetPath = path_1.default.join(targetBaseDir, relativePath);
        await this.ensureDir(path_1.default.dirname(targetPath));
        await fs_extra_1.default.copy(sourcePath, targetPath);
        return targetPath;
    }
    /**
     * 格式化文件大小
     */
    static formatFileSize(bytes) {
        if (bytes === 0)
            return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    /**
     * 获取文件信息
     */
    static async getFileInfo(filePath) {
        const stats = await fs_extra_1.default.stat(filePath);
        const ext = path_1.default.extname(filePath);
        const basename = path_1.default.basename(filePath, ext);
        const dirname = path_1.default.dirname(filePath);
        return {
            size: stats.size,
            created: stats.birthtime,
            modified: stats.mtime,
            extension: ext,
            basename,
            dirname
        };
    }
    /**
     * 清理临时文件
     */
    static async cleanupTempFiles(tempDir, olderThan = 24 * 60 * 60 * 1000) {
        try {
            if (!await fs_extra_1.default.pathExists(tempDir)) {
                return;
            }
            const items = await fs_extra_1.default.readdir(tempDir, { withFileTypes: true });
            const now = Date.now();
            for (const item of items) {
                const itemPath = path_1.default.join(tempDir, item.name);
                const stats = await fs_extra_1.default.stat(itemPath);
                if (now - stats.mtime.getTime() > olderThan) {
                    if (item.isDirectory()) {
                        await fs_extra_1.default.remove(itemPath);
                        console.log(`清理临时目录: ${itemPath}`);
                    }
                    else {
                        await fs_extra_1.default.unlink(itemPath);
                        console.log(`清理临时文件: ${itemPath}`);
                    }
                }
            }
        }
        catch (error) {
            console.error(`清理临时文件失败: ${tempDir}`, error);
        }
    }
    /**
     * 检查磁盘空间
     */
    static async checkDiskSpace(dirPath) {
        // 这个功能需要系统调用，简化实现
        // 在实际项目中可以使用 'check-disk-space' 包
        return {
            free: 0,
            total: 0,
            used: 0
        };
    }
    /**
     * 创建唯一的文件名
     */
    static createUniqueFilename(originalName, directory) {
        const ext = path_1.default.extname(originalName);
        const basename = path_1.default.basename(originalName, ext);
        let counter = 1;
        let newName = originalName;
        while (fs_extra_1.default.existsSync(path_1.default.join(directory, newName))) {
            newName = `${basename}_${counter}${ext}`;
            counter++;
        }
        return newName;
    }
    /**
     * 验证文件类型
     */
    static isVideoFile(filename) {
        const videoExtensions = ['.mp4', '.avi', '.mov', '.mkv', '.flv', '.wmv', '.webm', '.m4v'];
        const ext = path_1.default.extname(filename).toLowerCase();
        return videoExtensions.includes(ext);
    }
    static isAudioFile(filename) {
        const audioExtensions = ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.wma', '.m4a'];
        const ext = path_1.default.extname(filename).toLowerCase();
        return audioExtensions.includes(ext);
    }
    static isSubtitleFile(filename) {
        const subtitleExtensions = ['.srt', '.ass', '.ssa', '.vtt', '.sub'];
        const ext = path_1.default.extname(filename).toLowerCase();
        return subtitleExtensions.includes(ext);
    }
    /**
     * 生成安全的文件名（去除特殊字符）
     */
    static sanitizeFilename(filename) {
        return filename
            .replace(/[^\w\s.-]/g, '') // 移除特殊字符
            .replace(/\s+/g, '_') // 替换空格为下划线
            .replace(/_{2,}/g, '_') // 合并多个下划线
            .trim();
    }
    /**
     * 递归删除空目录
     */
    static async removeEmptyDirs(dirPath) {
        try {
            if (!await fs_extra_1.default.pathExists(dirPath)) {
                return;
            }
            const items = await fs_extra_1.default.readdir(dirPath);
            if (items.length === 0) {
                await fs_extra_1.default.rmdir(dirPath);
                console.log(`删除空目录: ${dirPath}`);
                // 递归检查父目录
                const parentDir = path_1.default.dirname(dirPath);
                if (parentDir !== dirPath) {
                    await this.removeEmptyDirs(parentDir);
                }
            }
        }
        catch (error) {
            // 忽略错误，可能是权限问题或目录不为空
        }
    }
}
exports.FileUtils = FileUtils;
//# sourceMappingURL=fileUtils.js.map