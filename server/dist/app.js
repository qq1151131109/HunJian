"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const fs_extra_1 = __importDefault(require("fs-extra"));
// 导入路由
const upload_1 = __importDefault(require("./routes/upload"));
const process_1 = __importDefault(require("./routes/process"));
const download_1 = __importDefault(require("./routes/download"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const server = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(server, {
    cors: {
        origin: "http://localhost:3000",
        methods: ["GET", "POST"]
    }
});
const PORT = process.env.PORT || 3001;
// 中间件
app.use((0, cors_1.default)({
    origin: 'http://localhost:3000',
    credentials: true
}));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// 静态文件服务
app.use('/static', express_1.default.static(path_1.default.join(__dirname, '../uploads')));
app.use('/output', express_1.default.static(path_1.default.join(__dirname, '../output')));
// 确保必要的目录存在
const ensureDirectories = async () => {
    const dirs = [
        path_1.default.join(__dirname, '../uploads'),
        path_1.default.join(__dirname, '../output'),
        path_1.default.join(__dirname, '../temp')
    ];
    for (const dir of dirs) {
        await fs_extra_1.default.ensureDir(dir);
    }
};
// Socket.io 连接处理
io.on('connection', (socket) => {
    console.log('用户连接:', socket.id);
    socket.on('join-process', (processId) => {
        socket.join(`process-${processId}`);
        console.log(`用户 ${socket.id} 加入处理任务 ${processId}`);
    });
    socket.on('disconnect', () => {
        console.log('用户断开连接:', socket.id);
    });
});
// 将 io 实例添加到 app 上，以便在路由中使用
app.set('io', io);
// 路由
app.use('/api/upload', upload_1.default);
app.use('/api/process', process_1.default);
app.use('/api/download', download_1.default);
// 健康检查
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        message: '游戏视频混剪服务运行正常'
    });
});
// 错误处理中间件
app.use((err, req, res, next) => {
    console.error('服务器错误:', err);
    res.status(500).json({
        error: '服务器内部错误',
        message: err.message
    });
});
// 404 处理
app.use('*', (req, res) => {
    res.status(404).json({
        error: '接口不存在',
        path: req.originalUrl
    });
});
// 启动服务器
const startServer = async () => {
    try {
        await ensureDirectories();
        server.listen(PORT, () => {
            console.log(`🚀 服务器启动成功`);
            console.log(`📱 服务端口: http://localhost:${PORT}`);
            console.log(`📁 上传目录: ${path_1.default.join(__dirname, '../uploads')}`);
            console.log(`📁 输出目录: ${path_1.default.join(__dirname, '../output')}`);
        });
    }
    catch (error) {
        console.error('服务器启动失败:', error);
        process.exit(1);
    }
};
startServer();
exports.default = app;
//# sourceMappingURL=app.js.map