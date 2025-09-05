import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { Server } from 'socket.io'
import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs-extra'

// 导入路由
import uploadRoutes from './routes/upload'
import processRoutes from './routes/process'
import downloadRoutes from './routes/download'

dotenv.config()

const app = express()
const server = createServer(app)
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
})

const PORT = process.env.PORT || 9001

// 中间件
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}))

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// 静态文件服务
app.use('/static', express.static(path.join(__dirname, '../uploads')))
app.use('/output', express.static(path.join(__dirname, '../output')))

// 确保必要的目录存在
const ensureDirectories = async () => {
  const dirs = [
    path.join(__dirname, '../uploads'),
    path.join(__dirname, '../output'),
    path.join(__dirname, '../temp')
  ]
  
  for (const dir of dirs) {
    await fs.ensureDir(dir)
  }
}

// Socket.io 连接处理
io.on('connection', (socket) => {
  console.log('用户连接:', socket.id)

  socket.on('join-process', (processId: string) => {
    socket.join(`process-${processId}`)
    console.log(`用户 ${socket.id} 加入处理任务 ${processId}`)
  })

  socket.on('disconnect', () => {
    console.log('用户断开连接:', socket.id)
  })
})

// 将 io 实例添加到 app 上，以便在路由中使用
app.set('io', io)

// 路由
app.use('/api/upload', uploadRoutes)
app.use('/api/process', processRoutes)
app.use('/api/download', downloadRoutes)

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    message: '游戏视频混剪服务运行正常'
  })
})

// 错误处理中间件
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('服务器错误:', err)
  res.status(500).json({
    error: '服务器内部错误',
    message: err.message
  })
})

// 404 处理
app.use('*', (req, res) => {
  res.status(404).json({
    error: '接口不存在',
    path: req.originalUrl
  })
})

// 启动服务器
const startServer = async () => {
  try {
    await ensureDirectories()
    
    server.listen(PORT, () => {
      console.log(`🚀 服务器启动成功`)
      console.log(`📱 服务端口: http://localhost:${PORT}`)
      console.log(`📁 上传目录: ${path.join(__dirname, '../uploads')}`)
      console.log(`📁 输出目录: ${path.join(__dirname, '../output')}`)
    })
  } catch (error) {
    console.error('服务器启动失败:', error)
    process.exit(1)
  }
}

startServer()

export default app