import type { Birthday } from '../domain'
import { getPhoto } from './photoStore'

export type CardStyle = 'sage' | 'powder' | 'paper'

const palettes: Record<CardStyle, { background: string; ink: string; accent: string }> = {
  sage: { background: '#4f6256', ink: '#efe8d3', accent: '#8fb8e7' },
  powder: { background: '#c8d9dc', ink: '#18201e', accent: '#7fa1cf' },
  paper: { background: '#eee9dc', ink: '#232925', accent: '#bbd0cf' },
}

function loadImage(blob: Blob) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Photo could not be loaded'))
    }
    image.src = url
  })
}

function drawCover(context: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, width: number, height: number) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight)
  const sourceWidth = width / scale
  const sourceHeight = height / scale
  const sourceX = (image.naturalWidth - sourceWidth) / 2
  const sourceY = (image.naturalHeight - sourceHeight) / 2
  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height)
}

function wrapText(context: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines = 4) {
  const words = text.trim().split(/\s+/)
  const lines: string[] = []
  let line = ''
  words.forEach((word) => {
    const test = line ? `${line} ${word}` : word
    if (context.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = word
    } else {
      line = test
    }
  })
  if (line) lines.push(line)
  return lines.slice(0, maxLines)
}

function drawPaperFibres(context: CanvasRenderingContext2D, width: number, height: number) {
  context.save()
  context.globalCompositeOperation = 'soft-light'
  context.lineWidth = 1

  for (let index = 0; index < 420; index += 1) {
    const y = Math.random() * height
    const length = 24 + Math.random() * 190
    const x = Math.random() * (width - length)
    context.globalAlpha = .025 + Math.random() * .035
    context.strokeStyle = index % 3 === 0 ? '#ffffff' : '#283129'
    context.beginPath()
    context.moveTo(x, y)
    context.lineTo(x + length, y + (Math.random() - .5) * 2)
    context.stroke()
  }

  context.restore()
}

export async function renderBirthdayCard(birthday: Birthday, message: string, style: CardStyle) {
  await document.fonts.ready
  const palette = palettes[style]
  const canvas = document.createElement('canvas')
  canvas.width = 1080
  canvas.height = 1350
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas is unavailable')

  context.fillStyle = palette.background
  context.fillRect(0, 0, canvas.width, canvas.height)
  drawPaperFibres(context, canvas.width, canvas.height)

  if (birthday.photoId) {
    const stored = await getPhoto(birthday.photoId)
    if (stored) {
      const image = await loadImage(stored.blob)
      context.save()
      context.globalAlpha = style === 'sage' ? .68 : .88
      drawCover(context, image, 0, 0, canvas.width, 770)
      context.restore()
      const fade = context.createLinearGradient(0, 500, 0, 790)
      fade.addColorStop(0, 'rgba(0,0,0,0)')
      fade.addColorStop(1, palette.background)
      context.fillStyle = fade
      context.fillRect(0, 480, canvas.width, 320)
    }
  }

  context.strokeStyle = palette.ink
  context.globalAlpha = .42
  context.lineWidth = 2
  context.strokeRect(34, 34, canvas.width - 68, canvas.height - 68)
  context.globalAlpha = 1

  context.fillStyle = palette.ink
  context.shadowColor = palette.ink
  context.shadowBlur = .6
  context.font = '600 24px Manrope'
  context.letterSpacing = '1px'
  context.fillText('birthday archive  /  誕生日', 72, 90)
  context.font = '500 17px Manrope'
  context.fillText("snoopy's home · card 001", 72, 1260)

  context.font = '700 116px Manrope'
  context.letterSpacing = '-8px'
  const nameLines = wrapText(context, birthday.name.toLowerCase(), 920, 2)
  nameLines.forEach((line, index) => context.fillText(line, 70, 790 + index * 108))

  context.fillStyle = palette.accent
  context.fillRect(68, 895 + (nameLines.length - 1) * 108, 540, 46)
  context.fillStyle = palette.ink
  context.font = '600 29px Manrope'
  context.letterSpacing = '-1px'
  const messageLines = wrapText(context, message, 820, 4)
  messageLines.forEach((line, index) => context.fillText(line, 76, 930 + (nameLines.length - 1) * 108 + index * 42))

  context.save()
  context.translate(1038, 1150)
  context.rotate(-Math.PI / 2)
  context.font = '600 18px Manrope'
  context.letterSpacing = '1px'
  context.fillText('snoopy\'s home · card', 0, 0)
  context.restore()

  context.globalCompositeOperation = 'soft-light'
  context.globalAlpha = .12
  for (let index = 0; index < 12_000; index += 1) {
    const x = Math.random() * canvas.width
    const y = Math.random() * canvas.height
    const size = Math.random() * 1.6
    context.fillStyle = index % 2 ? '#ffffff' : '#000000'
    context.fillRect(x, y, size, size)
  }
  context.globalAlpha = 1
  context.globalCompositeOperation = 'source-over'

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => result ? resolve(result) : reject(new Error('Card could not be rendered')), 'image/png')
  })
  const safeName = birthday.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'birthday'
  return new File([blob], `${safeName}-card.png`, { type: 'image/png' })
}
