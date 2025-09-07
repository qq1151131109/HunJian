// 字幕样式配置

export interface SubtitleStyle {
  id: string
  name: string
  description: string
  fontSize: number // 字体大小
  fontFamily: string // 字体族
  color: string // 字体颜色
  backgroundColor?: string // 背景颜色
  backgroundOpacity?: number // 背景透明度 (0-1)
  borderColor?: string // 边框颜色
  borderWidth?: number // 边框宽度
  shadowColor?: string // 阴影颜色
  shadowOffsetX?: number // 阴影X偏移
  shadowOffsetY?: number // 阴影Y偏移
  position: 'top' | 'top-center' | 'center-up' | 'center' | 'center-down' | 'bottom-center' | 'bottom' // 字幕位置
  alignment: 'left' | 'center' | 'right' // 对齐方式
  marginVertical: number // 垂直边距
  marginHorizontal: number // 水平边距
  bold?: boolean // 是否加粗
  italic?: boolean // 是否斜体
  outline?: boolean // 是否描边
  outlineColor?: string // 描边颜色
  outlineWidth?: number // 描边宽度
  defaultSettings: {
    fontSize: number
    color: string
    outline: boolean
    outlineWidth: number
  }
}

// 预设字幕样式
export const subtitleStyles: SubtitleStyle[] = [
  {
    id: 'tiktok-classic',
    name: 'TikTok经典',
    description: '白色大字，黑色描边，底部居中',
    fontSize: 20,
    fontFamily: 'Roboto Bold',
    color: '#FFFFFF',
    position: 'bottom',
    alignment: 'center',
    marginVertical: 50,
    marginHorizontal: 20,
    bold: true,
    outline: true,
    outlineColor: '#000000',
    outlineWidth: 2,
    defaultSettings: {
      fontSize: 20,
      color: '#FFFFFF',
      outline: true,
      outlineWidth: 2
    }
  },
  {
    id: 'modern-clean',
    name: '现代简洁',
    description: '中等白字，半透明黑底，清爽简洁',
    fontSize: 16,
    fontFamily: 'Roboto',
    color: '#FFFFFF',
    backgroundColor: '#000000',
    backgroundOpacity: 0.6,
    position: 'bottom',
    alignment: 'center',
    marginVertical: 40,
    marginHorizontal: 30,
    bold: false,
    defaultSettings: {
      fontSize: 16,
      color: '#FFFFFF',
      outline: false,
      outlineWidth: 0
    }
  },
  {
    id: 'game-style',
    name: '游戏风格',
    description: '黄色字体，深色描边，适合游戏内容',
    fontSize: 18,
    fontFamily: 'Impact',
    color: '#FFD700',
    position: 'bottom',
    alignment: 'center',
    marginVertical: 45,
    marginHorizontal: 25,
    bold: true,
    outline: true,
    outlineColor: '#2F2F2F',
    outlineWidth: 3,
    shadowColor: '#000000',
    shadowOffsetX: 2,
    shadowOffsetY: 2,
    defaultSettings: {
      fontSize: 18,
      color: '#FFD700',
      outline: true,
      outlineWidth: 3
    }
  },
  {
    id: 'elegant-clean',
    name: '优雅清洁',
    description: 'Open Sans字体，温和配色，专业感',
    fontSize: 14,
    fontFamily: 'Open Sans Bold',
    color: '#F5F5F5',
    backgroundColor: '#1A1A1A',
    backgroundOpacity: 0.8,
    position: 'bottom',
    alignment: 'center',
    marginVertical: 60,
    marginHorizontal: 40,
    bold: false,
    defaultSettings: {
      fontSize: 14,
      color: '#F5F5F5',
      outline: false,
      outlineWidth: 0
    }
  },
  {
    id: 'source-bold',
    name: '加粗突出',
    description: 'Source Sans Pro，加粗效果，醒目',
    fontSize: 22,
    fontFamily: 'Source Sans Pro Bold',
    color: '#FF6B6B',
    position: 'bottom',
    alignment: 'center',
    marginVertical: 35,
    marginHorizontal: 15,
    bold: true,
    outline: true,
    outlineColor: '#4ECDC4',
    outlineWidth: 2,
    shadowColor: '#45B7D1',
    shadowOffsetX: 3,
    shadowOffsetY: 3,
    defaultSettings: {
      fontSize: 22,
      color: '#FF6B6B',
      outline: true,
      outlineWidth: 2
    }
  },
  {
    id: 'minimal-top',
    name: '极简顶部',
    description: '顶部显示，极简风格',
    fontSize: 12,
    fontFamily: 'Roboto',
    color: '#FFFFFF',
    position: 'top',
    alignment: 'center',
    marginVertical: 30,
    marginHorizontal: 50,
    bold: false,
    outline: true,
    outlineColor: '#666666',
    outlineWidth: 1,
    defaultSettings: {
      fontSize: 12,
      color: '#FFFFFF',
      outline: true,
      outlineWidth: 1
    }
  }
]

// 根据字幕样式生成FFmpeg滤镜字符串
export function generateSubtitleFilter(style: SubtitleStyle): string {
  // 基础字体设置
  let fontSettings = `fontsize=${style.fontSize}`
  fontSettings += `:fontcolor=${style.color}`
  fontSettings += `:fontfile='${getFontPath(style.fontFamily)}'`
  
  // 位置设置
  const position = getPositionCoordinates(style.position, style.alignment, style.marginVertical, style.marginHorizontal)
  fontSettings += `:x=${position.x}:y=${position.y}`
  
  // 描边设置
  if (style.outline && style.outlineColor && style.outlineWidth) {
    fontSettings += `:borderw=${style.outlineWidth}:bordercolor=${style.outlineColor}`
  }
  
  // 阴影设置
  if (style.shadowColor && style.shadowOffsetX && style.shadowOffsetY) {
    fontSettings += `:shadowcolor=${style.shadowColor}:shadowx=${style.shadowOffsetX}:shadowy=${style.shadowOffsetY}`
  }
  
  // 背景框设置
  if (style.backgroundColor && style.backgroundOpacity) {
    fontSettings += `:box=1:boxcolor=${style.backgroundColor}@${style.backgroundOpacity}`
    fontSettings += `:boxborderw=5`
  }
  
  return fontSettings
}

// 获取字体文件路径，使用项目内置字体确保跨平台一致性
function getFontPath(fontFamily: string): string {
  // 默认使用当前目录，这个函数主要在服务器端使用
  const projectRoot = '.'
  
  const fontMap: Record<string, string> = {
    'Roboto Bold': `${projectRoot}/fonts/Roboto-Bold.ttf`,
    'Roboto': `${projectRoot}/fonts/Roboto-Regular.ttf`,
    'Open Sans Bold': `${projectRoot}/fonts/OpenSans-Bold.ttf`,
    'Impact': `${projectRoot}/fonts/Impact.ttf`,
    'Source Sans Pro Bold': `${projectRoot}/fonts/SourceSansPro-Bold.ttf`
  }
  
  return fontMap[fontFamily] || `${projectRoot}/fonts/Roboto-Regular.ttf`
}

// 计算字幕位置坐标
function getPositionCoordinates(
  position: 'top' | 'top-center' | 'center-up' | 'center' | 'center-down' | 'bottom-center' | 'bottom',
  alignment: 'left' | 'center' | 'right',
  marginVertical: number,
  marginHorizontal: number
) {
  let x: string, y: string
  
  // 水平位置
  switch (alignment) {
    case 'left':
      x = marginHorizontal.toString()
      break
    case 'right':
      x = `(w-tw-${marginHorizontal})`
      break
    case 'center':
    default:
      x = '(w-tw)/2'
      break
  }
  
  // 垂直位置
  switch (position) {
    case 'top':
      y = marginVertical.toString()
      break
    case 'top-center':
      y = `(h*0.15+${marginVertical})`
      break
    case 'center-up':
      y = `(h*0.35+${marginVertical})`
      break
    case 'center':
      y = '(h-th)/2'
      break
    case 'center-down':
      y = `(h*0.65-${marginVertical})`
      break
    case 'bottom-center':
      y = `(h*0.85-th-${marginVertical})`
      break
    case 'bottom':
    default:
      y = `(h-th-${marginVertical})`
      break
  }
  
  return { x, y }
}

// 根据样式ID生成FFmpeg字幕强制样式字符串
export function generateSubtitleForceStyle(styleId: string): string {
  const style = subtitleStyles.find(s => s.id === styleId)
  if (!style) {
    return 'FontName=Arial,FontSize=20,PrimaryColour=&H00ffffff,OutlineColour=&H00000000,Outline=2'
  }

  let forceStyle = `FontName=${style.fontFamily.replace(' Bold', '')}`
  forceStyle += `,FontSize=${style.fontSize}`
  
  // 颜色转换：从 #RRGGBB 转换为 &H00BBGGRR
  const hexToAss = (hex: string) => {
    const r = hex.substring(1, 3)
    const g = hex.substring(3, 5)
    const b = hex.substring(5, 7)
    return `&H00${b}${g}${r}`
  }
  
  forceStyle += `,PrimaryColour=${hexToAss(style.color)}`
  
  if (style.outline) {
    forceStyle += `,Outline=${style.outlineWidth || 2}`
    if (style.outlineColor) {
      forceStyle += `,OutlineColour=${hexToAss(style.outlineColor)}`
    }
  }
  
  if (style.bold) {
    forceStyle += `,Bold=1`
  }
  
  if (style.italic) {
    forceStyle += `,Italic=1`
  }
  
  return forceStyle
}