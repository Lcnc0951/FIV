import { describe, expect, it } from 'vitest'
import { loadMeshFile, type Mesh } from './files'
import { analyzeMesh } from './measure'

// Syntetisk person, 1,80 m, Y opp, meter, vender mot +z (høyre side er da −x).
type P3 = [number, number, number]
interface Section { c: P3; u: P3; v: P3 }
const SEG = 48

function buildBody(): Mesh {
  const pos: number[] = []
  const idx: number[] = []
  const tube = (secs: Section[]) => {
    const base = pos.length / 3
    for (const s of secs) for (let k = 0; k < SEG; k++) {
      const a = (k / SEG) * Math.PI * 2
      pos.push(s.c[0] + Math.cos(a) * s.u[0] + Math.sin(a) * s.v[0], s.c[1] + Math.cos(a) * s.u[1] + Math.sin(a) * s.v[1], s.c[2] + Math.cos(a) * s.u[2] + Math.sin(a) * s.v[2])
    }
    for (let r = 0; r + 1 < secs.length; r++) for (let k = 0; k < SEG; k++) {
      const a = base + r * SEG + k, b = base + r * SEG + ((k + 1) % SEG), c = a + SEG, d = b + SEG
      idx.push(a, b, c, b, d, c)
    }
  }
  const ring = (x: number, y: number, z: number, rx: number, rz: number): Section => ({ c: [x, y, z], u: [rx, 0, 0], v: [0, 0, rz] })
  // Gulv 2 × 2 m
  const f = pos.length / 3
  pos.push(-1, 0, -1, 1, 0, -1, 1, 0, 1, -1, 0, 1)
  idx.push(f, f + 2, f + 1, f, f + 3, f + 2)
  // Føtter (stikker frem) og bein. Høyre bein (−x) er 0,5 cm tykkere.
  for (const [x, extra] of [[-0.1, 0.005], [0.1, 0]] as const) {
    tube([ring(x, 0.0, 0.07, 0.045, 0.06), ring(x, 0.06, 0.07, 0.045, 0.06)])
    tube([ring(x, 0.06, 0, 0.05, 0.05), ring(x, 0.45, 0, 0.055, 0.055), ring(x, 0.86, 0, 0.08 + extra, 0.08 + extra)])
  }
  // Overkropp
  tube([ring(0, 0.84, 0, 0.17, 0.11), ring(0, 0.95, 0, 0.18, 0.12), ring(0, 1.08, 0, 0.15, 0.10), ring(0, 1.30, 0, 0.17, 0.12), ring(0, 1.45, 0, 0.2, 0.11), ring(0, 1.47, 0, 0.12, 0.08)])
  // Hals og hode
  tube([ring(0, 1.46, 0, 0.06, 0.06), ring(0, 1.56, 0, 0.06, 0.06)])
  tube([ring(0, 1.56, 0, 0.075, 0.09), ring(0, 1.68, 0, 0.09, 0.1), ring(0, 1.80, 0, 0.02, 0.02)])
  // Armer i A-stilling (25° ut fra kroppen). Høyre arm (−x) har radius 4,8 cm, venstre 4,5 cm.
  for (const [sx, r] of [[-1, 0.048], [1, 0.045]] as const) {
    const top: P3 = [sx * 0.22, 1.44, 0], bottom: P3 = [sx * 0.45, 0.95, 0]
    const d = [bottom[0] - top[0], bottom[1] - top[1], 0]
    const len = Math.hypot(d[0], d[1])
    const u: P3 = [(d[1] / len) * r, (-d[0] / len) * r, 0] // vinkelrett på armen i xy-planet
    const v: P3 = [0, 0, r]
    const secs: Section[] = []
    for (let i = 0; i <= 10; i++) { const t = i / 10; secs.push({ c: [top[0] + d[0] * t, top[1] + d[1] * t, 0], u, v }) }
    tube(secs)
  }
  return { positions: new Float32Array(pos), indices: new Uint32Array(idx) }
}

const ellipse = (a: number, b: number) => Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b))) * 100
const body = buildBody()

function expectBody(r: ReturnType<typeof analyzeMesh>) {
  const m = r.measurements
  expect(r.heightCm).toBeCloseTo(180, -0.5)
  expect(m.waistCm!).toBeCloseTo(ellipse(0.15, 0.10), -0.5)
  expect(m.hipCm!).toBeCloseTo(ellipse(0.18, 0.12), -0.5)
  expect(m.neckCm!).toBeCloseTo(2 * Math.PI * 6, -0.5)
  expect(Math.abs(m.chestCm! - ellipse(0.17, 0.12))).toBeLessThan(2)
  // Lår like under skrittet: radius ≈ 7,7 cm (venstre) og 8,2 cm (høyre)
  expect(m.thighLeftCm!).toBeGreaterThan(44)
  expect(m.thighLeftCm!).toBeLessThan(52)
  expect(m.thighRightCm!).toBeGreaterThan(m.thighLeftCm!)
  // Overarm målt vinkelrett på armen, ikke skrått
  expect(m.upperArmLeftCm!).toBeCloseTo(2 * Math.PI * 4.5, -0.5)
  expect(m.upperArmRightCm!).toBeCloseTo(2 * Math.PI * 4.8, -0.5)
  expect(r.sidesKnown).toBe(true)
}

describe('analyzeMesh', () => {
  it('måler en syntetisk kropp riktig', () => {
    const r = analyzeMesh(body, { sex: 'male', profileHeightCm: 180 })
    expect(r.up).toBe('y')
    expect(r.unit).toBe('m')
    expectBody(r)
    expect(r.warnings).toEqual([])
  })

  it('håndterer centimeter og Z som opp-akse', () => {
    const p = body.positions
    const out = new Float32Array(p.length)
    for (let i = 0; i < p.length; i += 3) { out[i] = p[i] * 100; out[i + 1] = -p[i + 2] * 100; out[i + 2] = p[i + 1] * 100 }
    const r = analyzeMesh({ positions: out, indices: body.indices }, { sex: 'male' })
    expect(r.up).toBe('z')
    expect(r.unit).toBe('cm')
    expectBody(r)
  })

  it('tåler at personen står skrått og at en vegg er med i skannet', () => {
    const p = body.positions, a = (40 * Math.PI) / 180
    const pos = Array.from(p)
    for (let i = 0; i < pos.length; i += 3) {
      const x = pos[i], z = pos[i + 2]
      pos[i] = x * Math.cos(a) + z * Math.sin(a) + 0.7
      pos[i + 2] = -x * Math.sin(a) + z * Math.cos(a) - 0.4
    }
    const idx = Array.from(body.indices)
    const w = pos.length / 3
    pos.push(-2, 0, -1.6, 3, 0, -1.6, 3, 2.5, -1.6, -2, 2.5, -1.6) // vegg 1,2 m bak
    idx.push(w, w + 1, w + 2, w, w + 2, w + 3)
    expectBody(analyzeMesh({ positions: new Float32Array(pos), indices: new Uint32Array(idx) }, { sex: 'male' }))
  })

  it('avviser en modell uten person', () => {
    const flat: Mesh = { positions: new Float32Array([0, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0.1, 0]), indices: new Uint32Array([0, 1, 2, 0, 2, 3]) }
    expect(() => analyzeMesh(flat, { sex: 'male' })).toThrow()
  })
})

// MARK: Filformater

const toOBJ = (m: Mesh) => {
  let s = '# test\no body\n'
  for (let i = 0; i < m.positions.length; i += 3) s += `v ${m.positions[i]} ${m.positions[i + 1]} ${m.positions[i + 2]}\n`
  s += 'vt 0 0\n'
  for (let i = 0; i < m.indices.length; i += 3) s += `f ${m.indices[i] + 1}/1 ${m.indices[i + 1] + 1}/1 ${m.indices[i + 2] + 1}/1\n`
  return new TextEncoder().encode(s).buffer
}
const toPLYAscii = (m: Mesh) => {
  const nv = m.positions.length / 3, nf = m.indices.length / 3
  let s = `ply\nformat ascii 1.0\nelement vertex ${nv}\nproperty float x\nproperty float y\nproperty float z\nproperty uchar red\nproperty uchar green\nproperty uchar blue\nelement face ${nf}\nproperty list uchar int vertex_indices\nend_header\n`
  for (let i = 0; i < nv; i++) s += `${m.positions[i * 3]} ${m.positions[i * 3 + 1]} ${m.positions[i * 3 + 2]} 200 100 50\n`
  for (let i = 0; i < nf; i++) s += `3 ${m.indices[i * 3]} ${m.indices[i * 3 + 1]} ${m.indices[i * 3 + 2]}\n`
  return new TextEncoder().encode(s).buffer
}
const toPLYBinary = (m: Mesh) => {
  const nv = m.positions.length / 3, nf = m.indices.length / 3
  const head = new TextEncoder().encode(`ply\nformat binary_little_endian 1.0\nelement vertex ${nv}\nproperty float x\nproperty float y\nproperty float z\nproperty float nx\nproperty uchar alpha\nelement face ${nf}\nproperty list uchar uint vertex_indices\nend_header\n`)
  const buf = new ArrayBuffer(head.length + nv * 17 + nf * 13)
  new Uint8Array(buf).set(head)
  const dv = new DataView(buf)
  let o = head.length
  for (let i = 0; i < nv; i++) { for (let k = 0; k < 3; k++) { dv.setFloat32(o, m.positions[i * 3 + k], true); o += 4 } dv.setFloat32(o, 0, true); o += 4; dv.setUint8(o++, 255) }
  for (let i = 0; i < nf; i++) { dv.setUint8(o++, 3); for (let k = 0; k < 3; k++) { dv.setUint32(o, m.indices[i * 3 + k], true); o += 4 } }
  return buf
}
const toSTL = (m: Mesh) => {
  const nf = m.indices.length / 3
  const buf = new ArrayBuffer(84 + nf * 50)
  const dv = new DataView(buf)
  dv.setUint32(80, nf, true)
  for (let i = 0; i < nf; i++) for (let v = 0; v < 3; v++) for (let k = 0; k < 3; k++) {
    dv.setFloat32(84 + i * 50 + 12 + v * 12 + k * 4, m.positions[m.indices[i * 3 + v] * 3 + k], true)
  }
  return buf
}
const toGLB = (m: Mesh) => {
  // Lagrer modellen i millimeter og skalerer med nodens skala, så transformene testes også
  const posBytes = new Uint8Array(m.positions.buffer.slice(0))
  const idxBytes = new Uint8Array(m.indices.buffer.slice(0))
  const binLen = posBytes.length + idxBytes.length
  const json = {
    asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0] }],
    nodes: [{ children: [1], translation: [3, 0, 2] }, { mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
    buffers: [{ byteLength: binLen }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: posBytes.length }, { buffer: 0, byteOffset: posBytes.length, byteLength: idxBytes.length }],
    accessors: [
      { bufferView: 0, componentType: 5126, count: m.positions.length / 3, type: 'VEC3' },
      { bufferView: 1, componentType: 5125, count: m.indices.length, type: 'SCALAR' },
    ],
  }
  let jsonBytes = new TextEncoder().encode(JSON.stringify(json))
  const pad = (4 - (jsonBytes.length % 4)) % 4
  jsonBytes = new Uint8Array([...jsonBytes, ...new Array(pad).fill(32)])
  const total = 12 + 8 + jsonBytes.length + 8 + binLen
  const buf = new ArrayBuffer(total)
  const dv = new DataView(buf), u8 = new Uint8Array(buf)
  dv.setUint32(0, 0x46546c67, true); dv.setUint32(4, 2, true); dv.setUint32(8, total, true)
  dv.setUint32(12, jsonBytes.length, true); dv.setUint32(16, 0x4e4f534a, true); u8.set(jsonBytes, 20)
  const b = 20 + jsonBytes.length
  dv.setUint32(b, binLen, true); dv.setUint32(b + 4, 0x004e4942, true); u8.set(posBytes, b + 8); u8.set(idxBytes, b + 8 + posBytes.length)
  return buf
}
const toZIP = async (name: string, data: ArrayBuffer, deflate: boolean) => {
  const raw = new Uint8Array(data)
  const body = deflate ? new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer()) : raw
  const nameB = new TextEncoder().encode(name)
  const local = new Uint8Array(30 + nameB.length), central = new Uint8Array(46 + nameB.length), end = new Uint8Array(22)
  const ldv = new DataView(local.buffer), cdv = new DataView(central.buffer), edv = new DataView(end.buffer)
  ldv.setUint32(0, 0x04034b50, true); ldv.setUint16(8, deflate ? 8 : 0, true); ldv.setUint32(18, body.length, true); ldv.setUint32(22, raw.length, true); ldv.setUint16(26, nameB.length, true); local.set(nameB, 30)
  cdv.setUint32(0, 0x02014b50, true); cdv.setUint16(10, deflate ? 8 : 0, true); cdv.setUint32(20, body.length, true); cdv.setUint32(24, raw.length, true); cdv.setUint16(28, nameB.length, true); cdv.setUint32(42, 0, true); central.set(nameB, 46)
  edv.setUint32(0, 0x06054b50, true); edv.setUint16(8, 1, true); edv.setUint16(10, 1, true); edv.setUint32(12, central.length, true); edv.setUint32(16, local.length + body.length, true)
  const out = new Uint8Array(local.length + body.length + central.length + end.length)
  out.set(local, 0); out.set(body, local.length); out.set(central, local.length + body.length); out.set(end, local.length + body.length + central.length)
  return out.buffer
}

describe('loadMeshFile', () => {
  const cases: [string, () => ArrayBuffer | Promise<ArrayBuffer>][] = [
    ['kropp.obj', () => toOBJ(body)],
    ['kropp.ply', () => toPLYAscii(body)],
    ['kropp-binær.ply', () => toPLYBinary(body)],
    ['kropp.stl', () => toSTL(body)],
    ['kropp.glb', () => toGLB(body)],
    ['scaniverse.zip', () => toZIP('model/kropp.obj', toOBJ(body), true)],
    ['lagret.zip', () => toZIP('kropp.ply', toPLYBinary(body), false)],
  ]
  for (const [name, make] of cases) {
    it(`leser og måler ${name}`, async () => {
      const { mesh } = await loadMeshFile(name, await make())
      expect(mesh.indices.length).toBe(body.indices.length)
      expectBody(analyzeMesh(mesh, { sex: 'male' }))
    })
  }

  it('gir en forståelig feil for USDZ', async () => {
    await expect(loadMeshFile('scan.usdz', new ArrayBuffer(10))).rejects.toThrow(/USDZ/)
  })

  it('måler en punktsky uten trekanter', async () => {
    // Tett punktsky: punkter langs alle trekantkanter
    const pts: number[] = []
    const p = body.positions, ix = body.indices
    for (let t = 0; t < ix.length; t += 3) for (let e = 0; e < 3; e++) {
      const a = ix[t + e] * 3, b = ix[t + ((e + 1) % 3)] * 3
      for (let s = 0; s < 1; s += 0.1) pts.push(p[a] + (p[b] - p[a]) * s, p[a + 1] + (p[b + 1] - p[a + 1]) * s, p[a + 2] + (p[b + 2] - p[a + 2]) * s)
    }
    const r = analyzeMesh({ positions: new Float32Array(pts), indices: new Uint32Array(0) }, { sex: 'male' })
    expect(r.isPointCloud).toBe(true)
    expect(Math.abs(r.measurements.waistCm! - ellipse(0.15, 0.10))).toBeLessThan(4)
  })
})
