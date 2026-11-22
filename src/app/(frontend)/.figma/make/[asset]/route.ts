import { readFile } from 'node:fs/promises'
import path from 'node:path'

export const dynamic = 'force-dynamic'

export async function GET(_request: Request, { params }: { params: Promise<{ asset: string }> }) {
  const { asset } = await params

  try {
    let contents: Buffer
    // Đọc trực tiếp từ thư mục public thay vì .figma
    const filePath = path.join(process.cwd(), 'public', asset)
    contents = await readFile(filePath)
    
    return new Response(new Uint8Array(contents), {
      headers: {
        'Cache-Control': 'public, max-age=300',
        'Content-Type': asset.endsWith('.svg') ? 'image/svg+xml' : 'image/png',
      },
    })
  } catch {
    return new Response('Not found', { status: 404 })
  }
}