import multer from 'multer'
import path from 'path'
import fs from 'fs-extra'
import { v4 as uuidv4 } from 'uuid'

const uploadDir = path.join(__dirname, '../../uploads')

// 确保上传目录存在
fs.ensureDirSync(uploadDir)

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      // 为每个请求创建唯一的目录
      const processId = req.body.processId || uuidv4()
      const userUploadDir = path.join(uploadDir, processId)
      
      await fs.ensureDir(userUploadDir)
      
      // 如果是视频文件，根据路径信息创建目录结构
      if (file.fieldname === 'videos') {
        const relativePath = req.body[`videoPath_${req.body.videoIndex || 0}`] || file.originalname
        const dir = path.dirname(relativePath)
        
        if (dir && dir !== '.') {
          const fullDir = path.join(userUploadDir, 'videos', dir)
          await fs.ensureDir(fullDir)
        } else {
          await fs.ensureDir(path.join(userUploadDir, 'videos'))
        }
      }
      
      // 保存 processId 到请求对象
      req.processId = processId
      
      cb(null, userUploadDir)
    } catch (error) {
      cb(error as Error, '')
    }
  },
  filename: (req, file, cb) => {
    // 保持原始文件名，但确保唯一性
    const ext = path.extname(file.originalname)
    const name = path.basename(file.originalname, ext)
    const timestamp = Date.now()
    
    if (file.fieldname === 'videos') {
      // 视频文件保持相对路径结构
      const relativePath = req.body[`videoPath_${req.body.videoIndex || 0}`] || file.originalname
      const dir = path.dirname(relativePath)
      const filename = path.basename(relativePath)
      
      if (dir && dir !== '.') {
        cb(null, path.join('videos', relativePath))
      } else {
        cb(null, path.join('videos', filename))
      }
    } else if (file.fieldname === 'audioFile') {
      cb(null, `audio_${timestamp}${ext}`)
    } else if (file.fieldname === 'trailerVideo') {
      cb(null, `trailer_${timestamp}${ext}`)
    } else {
      cb(null, `${name}_${timestamp}${ext}`)
    }
  }
})

// 文件类型过滤
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.fieldname === 'videos') {
    // 视频文件
    if (file.mimetype.startsWith('video/')) {
      cb(null, true)
    } else {
      cb(new Error('只能上传视频文件'))
    }
  } else if (file.fieldname === 'audioFile') {
    // 音频文件
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true)
    } else {
      cb(new Error('只能上传音频文件'))
    }
  } else if (file.fieldname === 'trailerVideo') {
    // 引流视频
    if (file.mimetype.startsWith('video/')) {
      cb(null, true)
    } else {
      cb(new Error('只能上传视频文件'))
    }
  } else {
    cb(null, true)
  }
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '1073741824'), // 默认 1GB
    files: parseInt(process.env.MAX_FILES || '100') // 默认最多100个文件
  }
})

// 处理多种类型文件的上传
export const uploadFiles = upload.fields([
  { name: 'videos', maxCount: 100 },
  { name: 'audioFile', maxCount: 1 },
  { name: 'trailerVideo', maxCount: 1 }
])

export default upload

// 扩展 Request 类型
declare global {
  namespace Express {
    interface Request {
      processId?: string
    }
  }
}