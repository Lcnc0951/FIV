// Leser 3D-filer fra skanneapper (Scaniverse, 3d Scanner App, Polycam, FIV LiDAR) uten eksterne biblioteker.
// Støtter PLY (ascii/binær), OBJ, GLB (glTF binær), STL (ascii/binær) og ZIP som inneholder en av disse.

export interface Mesh {
  /** x, y, z for hvert punkt, i filens egne enheter */
  positions: Float32Array
  /** tre punktindekser per trekant. Tom for punktskyer. */
  indices: Uint32Array
}

export interface LoadedMesh { mesh: Mesh; format: string; fileName: string }

export const MESH_ACCEPT = '.ply,.obj,.glb,.stl,.zip'

export async function loadMeshFile(fileName: string, buf: ArrayBuffer): Promise<LoadedMesh> {
  const bytes = new Uint8Array(buf)
  const ext = fileName.toLowerCase().split('.').pop() ?? ''
  const magic = String.fromCharCode(...bytes.subarray(0, 4))
  if (magic === 'PK\u0003\u0004') {
    const entry = await unzipMesh(bytes)
    const inner = await loadMeshFile(entry.name, entry.data)
    return { ...inner, fileName }
  }
  let mesh: Mesh, format: string
  if (magic === 'glTF') { mesh = parseGLB(buf); format = 'GLB' }
  else if (magic === 'ply\n' || magic === 'ply\r' || ext === 'ply') { mesh = parsePLY(buf); format = 'PLY' }
  else if (ext === 'stl') { mesh = parseSTL(buf); format = 'STL' }
  else if (ext === 'obj') { mesh = parseOBJ(new TextDecoder().decode(bytes)); format = 'OBJ' }
  else if (ext === 'usdz' || ext === 'usd' || ext === 'usdc') {
    throw new Error('USDZ kan ikke leses i nettleseren. Eksporter skannet som PLY, OBJ, GLB eller STL i stedet.')
  } else if (ext === 'gltf') {
    throw new Error('Velg GLB (én fil) i stedet for GLTF. GLTF består av flere filer.')
  } else {
    throw new Error('Ukjent filtype. Bruk PLY, OBJ, GLB, STL eller ZIP.')
  }
  if (mesh.positions.length < 300) throw new Error('Filen inneholder nesten ingen 3D-punkter.')
  return { mesh, format, fileName }
}

// MARK: OBJ

export function parseOBJ(text: string): Mesh {
  const pos: number[] = []
  const idx: number[] = []
  let start = 0
  const len = text.length
  while (start < len) {
    let end = text.indexOf('\n', start)
    if (end < 0) end = len
    const c0 = text.charCodeAt(start), c1 = text.charCodeAt(start + 1)
    if (c0 === 118 /* v */ && (c1 === 32 || c1 === 9)) {
      const p = text.slice(start + 2, end).trim().split(/\s+/)
      pos.push(+p[0], +p[1], +p[2])
    } else if (c0 === 102 /* f */ && (c1 === 32 || c1 === 9)) {
      const parts = text.slice(start + 2, end).trim().split(/\s+/)
      const n = pos.length / 3
      const vs = parts.map((s) => { const i = parseInt(s, 10); return i < 0 ? n + i : i - 1 })
      for (let k = 1; k + 1 < vs.length; k++) idx.push(vs[0], vs[k], vs[k + 1])
    }
    start = end + 1
  }
  return { positions: new Float32Array(pos), indices: new Uint32Array(idx) }
}

// MARK: PLY

type PlyType = 'int8' | 'uint8' | 'int16' | 'uint16' | 'int32' | 'uint32' | 'float32' | 'float64'
const PLY_TYPES: Record<string, PlyType> = {
  char: 'int8', int8: 'int8', uchar: 'uint8', uint8: 'uint8', short: 'int16', int16: 'int16', ushort: 'uint16', uint16: 'uint16',
  int: 'int32', int32: 'int32', uint: 'uint32', uint32: 'uint32', float: 'float32', float32: 'float32', double: 'float64', float64: 'float64',
}
const SIZE: Record<PlyType, number> = { int8: 1, uint8: 1, int16: 2, uint16: 2, int32: 4, uint32: 4, float32: 4, float64: 8 }
interface PlyProp { name: string; type: PlyType; listCount?: PlyType }
interface PlyElement { name: string; count: number; props: PlyProp[] }

export function parsePLY(buf: ArrayBuffer): Mesh {
  const bytes = new Uint8Array(buf)
  // Finn slutten av headeren
  const headText = new TextDecoder().decode(bytes.subarray(0, Math.min(bytes.length, 65536)))
  const endMatch = /end_header\r?\n/.exec(headText)
  if (!endMatch) throw new Error('Ugyldig PLY-fil (fant ikke slutten av headeren).')
  const headerLen = new TextEncoder().encode(headText.slice(0, endMatch.index + endMatch[0].length)).length
  const lines = headText.slice(0, endMatch.index).split(/\r?\n/)
  let format = 'ascii'
  const elements: PlyElement[] = []
  for (const line of lines) {
    const t = line.trim().split(/\s+/)
    if (t[0] === 'format') format = t[1]
    else if (t[0] === 'element') elements.push({ name: t[1], count: parseInt(t[2], 10), props: [] })
    else if (t[0] === 'property' && elements.length) {
      const el = elements[elements.length - 1]
      if (t[1] === 'list') el.props.push({ name: t[4], type: PLY_TYPES[t[3]], listCount: PLY_TYPES[t[2]] })
      else el.props.push({ name: t[2], type: PLY_TYPES[t[1]] })
    }
  }
  const vertexEl = elements.find((e) => e.name === 'vertex')
  if (!vertexEl) throw new Error('PLY-filen har ingen punkter.')
  const xi = vertexEl.props.findIndex((p) => p.name === 'x')
  const yi = vertexEl.props.findIndex((p) => p.name === 'y')
  const zi = vertexEl.props.findIndex((p) => p.name === 'z')
  if (xi < 0 || yi < 0 || zi < 0) throw new Error('PLY-filen mangler x, y eller z.')

  const positions = new Float32Array(vertexEl.count * 3)
  const indices: number[] = []
  const isFaceList = (el: PlyElement, p: PlyProp) => el.name === 'face' && p.listCount && (p.name === 'vertex_indices' || p.name === 'vertex_index')

  if (format === 'ascii') {
    const body = new TextDecoder().decode(bytes.subarray(headerLen))
    const tok = body.split(/\s+/).filter((s) => s.length > 0)
    let k = 0
    for (const el of elements) {
      for (let i = 0; i < el.count; i++) {
        el.props.forEach((p, pi) => {
          if (p.listCount) {
            const n = +tok[k++]
            const vs = tok.slice(k, k + n).map(Number); k += n
            if (isFaceList(el, p)) for (let j = 1; j + 1 < n; j++) indices.push(vs[0], vs[j], vs[j + 1])
          } else {
            const v = +tok[k++]
            if (el === vertexEl) { if (pi === xi) positions[i * 3] = v; else if (pi === yi) positions[i * 3 + 1] = v; else if (pi === zi) positions[i * 3 + 2] = v }
          }
        })
      }
    }
  } else {
    const little = format === 'binary_little_endian'
    if (!little && format !== 'binary_big_endian') throw new Error(`Ukjent PLY-format: ${format}`)
    const dv = new DataView(buf)
    let off = headerLen
    const read = (t: PlyType): number => {
      let v: number
      switch (t) {
        case 'int8': v = dv.getInt8(off); break
        case 'uint8': v = dv.getUint8(off); break
        case 'int16': v = dv.getInt16(off, little); break
        case 'uint16': v = dv.getUint16(off, little); break
        case 'int32': v = dv.getInt32(off, little); break
        case 'uint32': v = dv.getUint32(off, little); break
        case 'float32': v = dv.getFloat32(off, little); break
        default: v = dv.getFloat64(off, little)
      }
      off += SIZE[t]
      return v
    }
    for (const el of elements) {
      for (let i = 0; i < el.count; i++) {
        for (let pi = 0; pi < el.props.length; pi++) {
          const p = el.props[pi]
          if (p.listCount) {
            const n = read(p.listCount)
            if (isFaceList(el, p)) {
              const v0 = read(p.type); let prev = read(p.type)
              for (let j = 2; j < n; j++) { const v = read(p.type); indices.push(v0, prev, v); prev = v }
            } else off += n * SIZE[p.type]
          } else if (el === vertexEl && (pi === xi || pi === yi || pi === zi)) {
            positions[i * 3 + (pi === xi ? 0 : pi === yi ? 1 : 2)] = read(p.type)
          } else off += SIZE[p.type]
        }
      }
    }
  }
  return { positions, indices: new Uint32Array(indices) }
}

// MARK: STL

export function parseSTL(buf: ArrayBuffer): Mesh {
  const dv = new DataView(buf)
  const n = buf.byteLength >= 84 ? dv.getUint32(80, true) : 0
  if (buf.byteLength === 84 + n * 50 && n > 0) {
    const positions = new Float32Array(n * 9)
    for (let i = 0; i < n; i++) {
      const o = 84 + i * 50 + 12
      for (let k = 0; k < 9; k++) positions[i * 9 + k] = dv.getFloat32(o + k * 4, true)
    }
    return { positions, indices: sequential(n * 3) }
  }
  const text = new TextDecoder().decode(new Uint8Array(buf))
  const pos: number[] = []
  const re = /vertex\s+(\S+)\s+(\S+)\s+(\S+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) pos.push(+m[1], +m[2], +m[3])
  return { positions: new Float32Array(pos), indices: sequential(pos.length / 3) }
}

const sequential = (n: number) => { const a = new Uint32Array(n); for (let i = 0; i < n; i++) a[i] = i; return a }

// MARK: GLB

type Mat4 = number[] // kolonne-major, 16 tall
const IDENTITY: Mat4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
function mul(a: Mat4, b: Mat4): Mat4 {
  const r = new Array(16).fill(0)
  for (let c = 0; c < 4; c++) for (let rr = 0; rr < 4; rr++) for (let k = 0; k < 4; k++) r[c * 4 + rr] += a[k * 4 + rr] * b[c * 4 + k]
  return r
}
function trs(t = [0, 0, 0], q = [0, 0, 0, 1], s = [1, 1, 1]): Mat4 {
  const [x, y, z, w] = q
  return [
    (1 - 2 * (y * y + z * z)) * s[0], (2 * (x * y + z * w)) * s[0], (2 * (x * z - y * w)) * s[0], 0,
    (2 * (x * y - z * w)) * s[1], (1 - 2 * (x * x + z * z)) * s[1], (2 * (y * z + x * w)) * s[1], 0,
    (2 * (x * z + y * w)) * s[2], (2 * (y * z - x * w)) * s[2], (1 - 2 * (x * x + y * y)) * s[2], 0,
    t[0], t[1], t[2], 1,
  ]
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function parseGLB(buf: ArrayBuffer): Mesh {
  const dv = new DataView(buf)
  if (dv.getUint32(0, true) !== 0x46546c67) throw new Error('Ugyldig GLB-fil.')
  let off = 12
  let json: any = null
  let bin: DataView | null = null
  while (off + 8 <= buf.byteLength) {
    const len = dv.getUint32(off, true), type = dv.getUint32(off + 4, true)
    if (type === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, off + 8, len)))
    else if (type === 0x004e4942) bin = new DataView(buf, off + 8, len)
    off += 8 + len
  }
  if (!json || !bin) throw new Error('GLB-filen mangler data.')
  const required: string[] = json.extensionsRequired ?? []
  if (required.some((e) => e.includes('draco') || e.includes('meshopt'))) {
    throw new Error('GLB-filen er komprimert (Draco/Meshopt). Eksporter uten komprimering, eller velg PLY eller OBJ.')
  }
  const pos: number[] = []
  const idx: number[] = []

  const accessor = (i: number) => {
    const a = json.accessors[i]
    const view = json.bufferViews[a.bufferView]
    const comps = ({ SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 } as Record<string, number>)[a.type]
    const csize = ({ 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 } as Record<number, number>)[a.componentType]
    const stride = view.byteStride || comps * csize
    const base = (view.byteOffset ?? 0) + (a.byteOffset ?? 0)
    const get = (n: number, c: number): number => {
      const o = base + n * stride + c * csize
      switch (a.componentType) {
        case 5126: return bin!.getFloat32(o, true)
        case 5125: return bin!.getUint32(o, true)
        case 5123: return bin!.getUint16(o, true)
        case 5121: return bin!.getUint8(o)
        case 5122: return bin!.getInt16(o, true)
        default: return bin!.getInt8(o)
      }
    }
    return { count: a.count as number, get }
  }

  const visit = (nodeIndex: number, parent: Mat4) => {
    const node = json.nodes[nodeIndex]
    const local = node.matrix ?? trs(node.translation, node.rotation, node.scale)
    const m = mul(parent, local)
    if (node.mesh != null) {
      for (const prim of json.meshes[node.mesh].primitives) {
        if (prim.mode != null && prim.mode !== 4) continue
        if (prim.attributes?.POSITION == null) continue
        const p = accessor(prim.attributes.POSITION)
        const base = pos.length / 3
        for (let i = 0; i < p.count; i++) {
          const x = p.get(i, 0), y = p.get(i, 1), z = p.get(i, 2)
          pos.push(m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14])
        }
        if (prim.indices != null) {
          const ia = accessor(prim.indices)
          for (let i = 0; i < ia.count; i++) idx.push(base + ia.get(i, 0))
        } else for (let i = 0; i < p.count; i++) idx.push(base + i)
      }
    }
    for (const c of node.children ?? []) visit(c, m)
  }
  const scene = json.scenes?.[json.scene ?? 0]
  const roots: number[] = scene?.nodes ?? json.nodes?.map((_: unknown, i: number) => i) ?? []
  roots.forEach((r) => visit(r, IDENTITY))
  return { positions: new Float32Array(pos), indices: new Uint32Array(idx) }
}

// MARK: ZIP

/** Finner første 3D-fil i et ZIP-arkiv (f.eks. OBJ-eksport fra Scaniverse med tekstur). */
export async function unzipMesh(bytes: Uint8Array): Promise<{ name: string; data: ArrayBuffer }> {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let eocd = -1
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break }
  }
  if (eocd < 0) throw new Error('Ugyldig ZIP-fil.')
  const count = dv.getUint16(eocd + 10, true)
  let off = dv.getUint32(eocd + 16, true)
  const entries: { name: string; method: number; size: number; local: number }[] = [] // size = komprimert størrelse
  for (let i = 0; i < count; i++) {
    if (dv.getUint32(off, true) !== 0x02014b50) break
    const method = dv.getUint16(off + 10, true)
    const size = dv.getUint32(off + 20, true)
    const nameLen = dv.getUint16(off + 28, true), extraLen = dv.getUint16(off + 30, true), commentLen = dv.getUint16(off + 32, true)
    const local = dv.getUint32(off + 42, true)
    const name = new TextDecoder().decode(bytes.subarray(off + 46, off + 46 + nameLen))
    entries.push({ name, method, size, local })
    off += 46 + nameLen + extraLen + commentLen
  }
  const order = ['ply', 'obj', 'glb', 'stl']
  const pick = entries
    .filter((e) => !e.name.startsWith('__MACOSX') && order.includes(e.name.toLowerCase().split('.').pop() ?? ''))
    .sort((a, b) => order.indexOf(a.name.toLowerCase().split('.').pop()!) - order.indexOf(b.name.toLowerCase().split('.').pop()!))[0]
  if (!pick) throw new Error('Fant ingen PLY-, OBJ-, GLB- eller STL-fil i ZIP-arkivet.')
  if (pick.size === 0xffffffff) throw new Error('ZIP-filen er for stor (ZIP64). Pakk ut filen først.')
  const nameLen = dv.getUint16(pick.local + 26, true), extraLen = dv.getUint16(pick.local + 28, true)
  const start = pick.local + 30 + nameLen + extraLen
  const raw = bytes.slice(start, start + pick.size)
  if (pick.method === 0) return { name: pick.name, data: raw.buffer }
  if (pick.method !== 8) throw new Error('ZIP-filen bruker en ukjent komprimering.')
  const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return { name: pick.name, data: await new Response(stream).arrayBuffer() }
}
