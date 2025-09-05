"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadFiles = void 0;
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const uuid_1 = require("uuid");
const uploadDir = path_1.default.join(__dirname, '../../uploads');
// 确保上传目录存在
fs_extra_1.default.ensureDirSync(uploadDir);
const storage = multer_1.default.diskStorage({
    destination: async (req, file, cb) => {
        try {
            // 为每个请求创建唯一的目录
            const processId = req.body.processId || (0, uuid_1.v4)();
            const userUploadDir = path_1.default.join(uploadDir, processId);
            await fs_extra_1.default.ensureDir(userUploadDir);
            // 如果是视频文件，根据路径信息创建目录结构
            if (file.fieldname === 'videos') {
                const relativePath = req.body[`videoPath_${req.body.videoIndex || 0}`] || file.originalname;
                const dir = path_1.default.dirname(relativePath);
                if (dir && dir !== '.') {
                    const fullDir = path_1.default.join(userUploadDir, 'videos', dir);
                    await fs_extra_1.default.ensureDir(fullDir);
                }
                else {
                    await fs_extra_1.default.ensureDir(path_1.default.join(userUploadDir, 'videos'));
                }
            }
            // 保存 processId 到请求对象
            req.processId = processId;
            cb(null, userUploadDir);
        }
        catch (error) {
            cb(error, '');
        }
    },
    filename: (req, file, cb) => {
        // 保持原始文件名，但确保唯一性
        const ext = path_1.default.extname(file.originalname);
        const name = path_1.default.basename(file.originalname, ext);
        const timestamp = Date.now();
        if (file.fieldname === 'videos') {
            // 视频文件保持相对路径结构
            const relativePath = req.body[`videoPath_${req.body.videoIndex || 0}`] || file.originalname;
            const dir = path_1.default.dirname(relativePath);
            const filename = path_1.default.basename(relativePath);
            if (dir && dir !== '.') {
                cb(null, path_1.default.join('videos', relativePath));
            }
            else {
                cb(null, path_1.default.join('videos', filename));
            }
        }
        else if (file.fieldname === 'audioFile') {
            cb(null, `audio_${timestamp}${ext}`);
        }
        else if (file.fieldname === 'trailerVideo') {
            cb(null, `trailer_${timestamp}${ext}`);
        }
        else {
            cb(null, `${name}_${timestamp}${ext}`);
        }
    }
});
// 文件类型过滤
const fileFilter = (req, file, cb) => {
    if (file.fieldname === 'videos') {
        // 视频文件
        if (file.mimetype.startsWith('video/')) {
            cb(null, true);
        }
        else {
            cb(new Error('只能上传视频文件'));
        }
    }
    else if (file.fieldname === 'audioFile') {
        // 音频文件
        if (file.mimetype.startsWith('audio/')) {
            cb(null, true);
        }
        else {
            cb(new Error('只能上传音频文件'));
        }
    }
    else if (file.fieldname === 'trailerVideo') {
        // 引流视频
        if (file.mimetype.startsWith('video/')) {
            cb(null, true);
        }
        else {
            cb(new Error('只能上传视频文件'));
        }
    }
    else {
        cb(null, true);
    }
};
const upload = (0, multer_1.default)({
    storage,
    fileFilter,
    limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE || '1073741824'), // 默认 1GB
        files: parseInt(process.env.MAX_FILES || '100') // 默认最多100个文件
    }
});
// 处理多种类型文件的上传
exports.uploadFiles = upload.fields([
    { name: 'videos', maxCount: 100 },
    { name: 'audioFile', maxCount: 1 },
    { name: 'trailerVideo', maxCount: 1 }
]);
exports.default = upload;
//# sourceMappingURL=upload.js.map