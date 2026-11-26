import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export type RoadTheme = 'day' | 'golden' | 'mist' | 'night';
export type RoadQuality = 'eco' | 'normal';
export type RoadWorld = 'valley' | 'newyork' | 'roma' | 'paris';

interface RoadScene3DProps {
  /** Current speed in km/h (strictly drives forward movement; 0 = completely stopped) */
  speedKmh: number;
  /** Visual lighting/atmosphere theme */
  theme: RoadTheme;
  /** Eco caps DPR=1, disables AA, targets ~30fps; Normal uses up to 1.5 DPR & 60fps */
  quality: RoadQuality;
  /** Scenic world/city */
  world: RoadWorld;
}

interface ThemePalette {
  skyTop: number;
  skyHorizon: number;
  fogColor: number;
  fogDensity: number;
  sunColor: number;
  sunIntensity: number;
  hemiSky: number;
  hemiGround: number;
  hemiIntensity: number;
  cloudColor: number;
  sunDiscColor: number;
  sunPos: [number, number, number];
  isNight: boolean;
}

const THEME_PALETTES: Record<RoadTheme, ThemePalette> = {
  day: {
    skyTop: 0x3b82f6,
    skyHorizon: 0xbae6fd,
    fogColor: 0xb8dff8,
    fogDensity: 0.0036,
    sunColor: 0xfff8e7,
    sunIntensity: 1.2,
    hemiSky: 0xdbeafe,
    hemiGround: 0x3f6212,
    hemiIntensity: 0.78,
    cloudColor: 0xffffff,
    sunDiscColor: 0xfef08a,
    sunPos: [80, 95, -180],
    isNight: false,
  },
  golden: {
    skyTop: 0x312e81,
    skyHorizon: 0xfb923c,
    fogColor: 0xe89b6c,
    fogDensity: 0.0042,
    sunColor: 0xffb366,
    sunIntensity: 1.35,
    hemiSky: 0xfed7aa,
    hemiGround: 0x451a03,
    hemiIntensity: 0.68,
    cloudColor: 0xffd7b5,
    sunDiscColor: 0xfde047,
    sunPos: [30, 26, -210],
    isNight: false,
  },
  mist: {
    skyTop: 0x475569,
    skyHorizon: 0xcbd5e1,
    fogColor: 0x94a3b8,
    fogDensity: 0.0074,
    sunColor: 0xe2e8f0,
    sunIntensity: 0.75,
    hemiSky: 0xe2e8f0,
    hemiGround: 0x334155,
    hemiIntensity: 0.85,
    cloudColor: 0xdbe4ee,
    sunDiscColor: 0xf1f5f9,
    sunPos: [-60, 70, -180],
    isNight: false,
  },
  night: {
    skyTop: 0x050816,
    skyHorizon: 0x172554,
    fogColor: 0x0b1224,
    fogDensity: 0.0054,
    sunColor: 0x93c5fd,
    sunIntensity: 0.55,
    hemiSky: 0x1e3a8a,
    hemiGround: 0x090d16,
    hemiIntensity: 0.55,
    cloudColor: 0x1e293b,
    sunDiscColor: 0xe0f2fe,
    sunPos: [-50, 75, -190],
    isNight: true,
  },
};

function seededRandom(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/**
 * Tiny 128x256 procedural road texture tailored to each world.
 */
function createRoadTexture(world: RoadWorld, maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  if (world === 'roma') {
    ctx.fillStyle = '#47433e';
    ctx.fillRect(0, 0, 128, 256);
    for (let y = 0; y < 256; y += 8) {
      const offset = (y / 8) % 2 === 0 ? 0 : 6;
      for (let x = -6; x < 128; x += 12) {
        const v = 64 + ((x * 11 + y * 5) % 18);
        ctx.fillStyle = `rgb(${v + 4},${v},${v - 5})`;
        ctx.fillRect(x + offset, y, 10, 6);
      }
    }
    ctx.fillStyle = '#d6cfc2';
    ctx.fillRect(0, 0, 7, 256);
    ctx.fillRect(121, 0, 7, 256);
    ctx.fillStyle = 'rgba(241, 245, 249, 0.8)';
    ctx.fillRect(62, 32, 4, 96);
  } else if (world === 'newyork') {
    ctx.fillStyle = '#292d34';
    ctx.fillRect(0, 0, 128, 256);
    for (let y = 0; y < 256; y += 4) {
      for (let x = 0; x < 128; x += 4) {
        const s = 38 + ((x * 17 + y * 9) % 10);
        ctx.fillStyle = `rgb(${s},${s + 2},${s + 5})`;
        ctx.fillRect(x, y, 4, 4);
      }
    }
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(0, 0, 5, 256);
    ctx.fillRect(123, 0, 5, 256);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(59, 0, 4, 256);
    ctx.fillRect(66, 0, 4, 256);
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(28, 20, 3, 84);
    ctx.fillRect(97, 20, 3, 84);
  } else {
    ctx.fillStyle = '#33363d';
    ctx.fillRect(0, 0, 128, 256);
    for (let y = 0; y < 256; y += 4) {
      for (let x = 0; x < 128; x += 4) {
        const shade = 48 + ((x * 13 + y * 7) % 12);
        ctx.fillStyle = `rgb(${shade},${shade + 2},${shade + 6})`;
        ctx.fillRect(x, y, 4, 4);
      }
    }
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(6, 0, 4, 256);
    ctx.fillRect(118, 0, 4, 256);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(62, 24, 4, 112);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.anisotropy = Math.min(8, Math.max(1, maxAnisotropy));
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Tiny 64x128 procedural building facade + optional night emissive glow map.
 */
function createBuildingTextures(
  world: 'newyork' | 'roma' | 'paris',
  isNight: boolean
): { map: THREE.CanvasTexture; emissiveMap: THREE.CanvasTexture | null } {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  let glowCanvas: HTMLCanvasElement | null = null;
  let glowCtx: CanvasRenderingContext2D | null = null;
  if (isNight) {
    glowCanvas = document.createElement('canvas');
    glowCanvas.width = 64;
    glowCanvas.height = 128;
    glowCtx = glowCanvas.getContext('2d')!;
    glowCtx.fillStyle = '#000000';
    glowCtx.fillRect(0, 0, 64, 128);
  }

  if (world === 'newyork') {
    ctx.fillStyle = isNight ? '#111827' : '#475569';
    ctx.fillRect(0, 0, 64, 128);
    for (let y = 6; y < 124; y += 10) {
      for (let x = 6; x < 58; x += 10) {
        const hash = (x * 13 + y * 7) % 7;
        const lit = hash !== 0 && hash !== 3;
        if (isNight) {
          const warm = hash % 2 === 0 ? '#ffe58f' : '#ffd166';
          ctx.fillStyle = lit ? warm : '#0b1120';
          if (lit && glowCtx) {
            glowCtx.fillStyle = warm;
            glowCtx.fillRect(x, y, 6, 6);
          }
        } else {
          ctx.fillStyle = lit ? '#93c5fd' : '#334155';
        }
        ctx.fillRect(x, y, 6, 6);
      }
    }
  } else if (world === 'paris') {
    // Cream Haussmann limestone with tall wrought-iron balcony windows
    ctx.fillStyle = isNight ? '#2b2a2f' : '#e8e0d2';
    ctx.fillRect(0, 0, 64, 128);
    ctx.fillStyle = isNight ? '#1f1e24' : '#d2c7b4';
    ctx.fillRect(0, 0, 64, 4);
    ctx.fillRect(0, 42, 64, 3);
    ctx.fillRect(0, 84, 64, 3);
    for (let y = 10; y < 120; y += 26) {
      for (let x = 8; x < 56; x += 16) {
        const lit = (x * 7 + y * 11) % 3 !== 0;
        if (isNight) {
          const glowCol = lit ? '#ffdf85' : '#11131a';
          ctx.fillStyle = glowCol;
          if (lit && glowCtx) {
            glowCtx.fillStyle = glowCol;
            glowCtx.fillRect(x, y, 8, 15);
          }
        } else {
          ctx.fillStyle = '#334155';
        }
        ctx.fillRect(x, y, 8, 15);
        // Dark wrought-iron balcony rail
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(x - 1, y + 12, 10, 2);
      }
    }
  } else {
    // Roma warm ochre/terracotta facade with shuttered windows
    ctx.fillStyle = isNight ? '#3a261c' : '#d69e6c';
    ctx.fillRect(0, 0, 64, 128);
    ctx.fillStyle = isNight ? '#281a13' : '#e7d5bc';
    ctx.fillRect(0, 0, 64, 4);
    ctx.fillRect(0, 62, 64, 3);
    for (let y = 12; y < 120; y += 22) {
      for (let x = 8; x < 56; x += 16) {
        const lit = (x * 5 + y * 13) % 3 !== 0;
        if (isNight) {
          const glowCol = lit ? '#ffd670' : '#1a120e';
          ctx.fillStyle = glowCol;
          if (lit && glowCtx) {
            glowCtx.fillStyle = glowCol;
            glowCtx.fillRect(x, y, 8, 12);
          }
        } else {
          ctx.fillStyle = '#3b2f2f';
        }
        ctx.fillRect(x, y, 8, 12);
        ctx.fillStyle = isNight ? '#143322' : '#2f5e3e';
        ctx.fillRect(x - 2, y, 2, 12);
        ctx.fillRect(x + 8, y, 2, 12);
      }
    }
  }

  const map = new THREE.CanvasTexture(canvas);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.magFilter = THREE.NearestFilter;
  map.minFilter = THREE.LinearMipmapLinearFilter;
  map.colorSpace = THREE.SRGBColorSpace;

  let emissiveMap: THREE.CanvasTexture | null = null;
  if (glowCanvas) {
    emissiveMap = new THREE.CanvasTexture(glowCanvas);
    emissiveMap.wrapS = THREE.RepeatWrapping;
    emissiveMap.wrapT = THREE.RepeatWrapping;
    emissiveMap.magFilter = THREE.NearestFilter;
    emissiveMap.minFilter = THREE.LinearMipmapLinearFilter;
    emissiveMap.colorSpace = THREE.SRGBColorSpace;
  }

  return { map, emissiveMap };
}

/**
 * Creates a smooth closed-loop road tailored to the world.
 */
function createLoopCurve(world: RoadWorld): THREE.CatmullRomCurve3 {
  const controlPoints: THREE.Vector3[] = [];
  const count = 24;
  const baseRadius = world === 'newyork' ? 400 : 360;

  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    let radialWave = 0;
    let y = 0;

    if (world === 'newyork' || world === 'paris') {
      radialWave = Math.sin(a * 4) * 32 + Math.cos(a * 2) * 28;
      y = Math.sin(a * 2) * 2.0;
    } else if (world === 'roma') {
      radialWave = Math.sin(a * 3) * 48 + Math.cos(a * 5) * 24;
      y = Math.sin(a * 3) * 5.5 + Math.cos(a * 2) * 3.0;
    } else {
      radialWave =
        Math.sin(a * 3) * 65 +
        Math.cos(a * 5) * 32 +
        Math.sin(a * 2 + 1.1) * 40;
      y = Math.sin(a * 3) * 9 + Math.cos(a * 2) * 5;
    }

    const r = baseRadius + radialWave;
    controlPoints.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r));
  }

  return new THREE.CatmullRomCurve3(controlPoints, true, 'catmullrom', 0.5);
}

/**
 * Builds road ribbon + flanking ground/sidewalk terrain in 2 BufferGeometries.
 */
function buildRoadAndTerrain(
  curve: THREE.CatmullRomCurve3,
  segments: number,
  roadHalfWidth: number,
  terrainHalfWidth: number,
  world: RoadWorld
): { roadGeo: THREE.BufferGeometry; terrainGeo: THREE.BufferGeometry } {
  const roadPositions: number[] = [];
  const roadUvs: number[] = [];
  const roadIndices: number[] = [];

  const terrainPositions: number[] = [];
  const terrainColors: number[] = [];
  const terrainIndices: number[] = [];

  const up = new THREE.Vector3(0, 1, 0);
  const totalLen = curve.getLength();

  const crossOffsets = [
    -terrainHalfWidth,
    -42,
    -18,
    -roadHalfWidth - 0.8,
    roadHalfWidth + 0.8,
    18,
    42,
    terrainHalfWidth,
  ];
  const cols = crossOffsets.length;

  const tmpPos = new THREE.Vector3();
  const tmpTan = new THREE.Vector3();
  const tmpRight = new THREE.Vector3();

  for (let i = 0; i <= segments; i++) {
    const t = (i % segments) / segments;
    curve.getPointAt(t, tmpPos);
    curve.getTangentAt(t, tmpTan).normalize();
    tmpRight.crossVectors(tmpTan, up).normalize();

    const vCoord = (i / segments) * (totalLen / 16);

    const lx = tmpPos.x - tmpRight.x * roadHalfWidth;
    const ly = tmpPos.y + 0.08;
    const lz = tmpPos.z - tmpRight.z * roadHalfWidth;

    const rx = tmpPos.x + tmpRight.x * roadHalfWidth;
    const ry = tmpPos.y + 0.08;
    const rz = tmpPos.z + tmpRight.z * roadHalfWidth;

    roadPositions.push(lx, ly, lz, rx, ry, rz);
    roadUvs.push(0, vCoord, 1, vCoord);

    if (i < segments) {
      const base = i * 2;
      roadIndices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
    }

    const angle = t * Math.PI * 2;
    for (let c = 0; c < cols; c++) {
      const offset = crossOffsets[c];
      const absOff = Math.abs(offset);
      let heightDelta = -0.05;

      if (world === 'valley' && absOff > roadHalfWidth + 2) {
        const hillFactor = (absOff - roadHalfWidth) / terrainHalfWidth;
        const undulation =
          Math.sin(angle * 7 + c * 1.3) * 4.5 +
          Math.cos(angle * 11 - c * 0.9) * 2.5;
        heightDelta = hillFactor * hillFactor * 18 + undulation * hillFactor - 0.3;
      } else if (world === 'roma' && absOff > 20) {
        const hillFactor = (absOff - 20) / terrainHalfWidth;
        heightDelta = hillFactor * hillFactor * 10 + Math.sin(angle * 6 + c) * 2 * hillFactor;
      } else if (world === 'newyork') {
        heightDelta = absOff <= 18 ? 0.12 : 0.0;
      }

      terrainPositions.push(
        tmpPos.x + tmpRight.x * offset,
        tmpPos.y + heightDelta,
        tmpPos.z + tmpRight.z * offset
      );

      const shade = 0.88 + 0.12 * Math.sin(angle * 11 + c * 1.7);
      terrainColors.push(shade, shade, shade);
    }

    if (i < segments) {
      const rowA = i * cols;
      const rowB = (i + 1) * cols;
      for (let c = 0; c < cols - 1; c++) {
        if (c === 3) continue;
        const a = rowA + c;
        const b = rowA + c + 1;
        const d = rowB + c;
        const e = rowB + c + 1;
        terrainIndices.push(a, d, b, b, d, e);
      }
    }
  }

  const roadGeo = new THREE.BufferGeometry();
  roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(roadPositions, 3));
  roadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(roadUvs, 2));
  roadGeo.setIndex(roadIndices);
  roadGeo.computeVertexNormals();

  const terrainGeo = new THREE.BufferGeometry();
  terrainGeo.setAttribute('position', new THREE.Float32BufferAttribute(terrainPositions, 3));
  terrainGeo.setAttribute('color', new THREE.Float32BufferAttribute(terrainColors, 3));
  terrainGeo.setIndex(terrainIndices);
  terrainGeo.computeVertexNormals();

  return { roadGeo, terrainGeo };
}

interface LegRig {
  thigh: THREE.Mesh;
  shin: THREE.Mesh;
  sock: THREE.Mesh;
  shoe: THREE.Mesh;
  crank: THREE.Mesh;
  hipX: number;
  pedalX: number;
}

interface CyclistRig {
  group: THREE.Group;
  leftLeg: LegRig;
  rightLeg: LegRig;
  rearWheel: THREE.Group;
  frontWheel: THREE.Group;
  phase: number;
}

/**
 * Helper: positions & orients a unit-Y cylinder (height 1) between two 3D points.
 */
function orientSegmentBetween(
  mesh: THREE.Object3D,
  p1: THREE.Vector3,
  p2: THREE.Vector3,
  radiusScale = 1
) {
  const dir = _segDir.subVectors(p2, p1);
  const len = dir.length();
  if (len < 0.0001) return;
  mesh.position.copy(p1).addScaledVector(dir, 0.5);
  mesh.scale.set(radiusScale, len, radiusScale);
  mesh.quaternion.setFromUnitVectors(_upVec, dir.divideScalar(len));
}

const _segDir = new THREE.Vector3();
const _upVec = new THREE.Vector3(0, 1, 0);
const _hipPos = new THREE.Vector3();
const _pedalPos = new THREE.Vector3();
const _kneePos = new THREE.Vector3();
const _anklePos = new THREE.Vector3();
const _bbPos = new THREE.Vector3();

/**
 * Analytic 2-bone IK in the YZ plane (knee bends forward toward +Z) for realistic pedaling.
 */
function updateArticulatedLeg(leg: LegRig, crankAngle: number) {
  const bbY = 0.28;
  const bbZ = -0.06;
  const crankR = 0.175;
  const hipY = 0.99;
  const hipZ = -0.23;

  // Forward pedaling (+Z is forward): Top (+Y) -> Forward (+Z) -> Bottom (-Y) -> Back (-Z)
  const pedalY = bbY + Math.cos(crankAngle) * crankR;
  const pedalZ = bbZ + Math.sin(crankAngle) * crankR;

  // Ankle sits slightly above & behind the pedal cleat
  const ankleY = pedalY + 0.06;
  const ankleZ = pedalZ - 0.05;

  const dy = ankleY - hipY;
  const dz = ankleZ - hipZ;
  const dist = Math.max(0.18, Math.min(0.84, Math.hypot(dy, dz)));

  const thighLen = 0.43;
  const shinLen = 0.43;

  // Law of cosines for knee bend
  const cosA = Math.max(
    -1,
    Math.min(1, (thighLen * thighLen + dist * dist - shinLen * shinLen) / (2 * thighLen * dist))
  );
  const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));

  // Unit vector from hip to ankle in YZ plane
  const uy = dy / dist;
  const uz = dz / dist;

  // Perpendicular pointing forward (+Z, slightly upward) for the knee
  // Since ankle is below hip (uy < 0), (-uz, uy) has Z-component < 0, so (+uz, -uy) points +Z!
  const py = uz;
  const pz = -uy;

  const kneeY = hipY + (uy * cosA + py * sinA) * thighLen;
  const kneeZ = hipZ + (uz * cosA + pz * sinA) * thighLen;
  const kneeX = leg.hipX * 1.05;

  _hipPos.set(leg.hipX, hipY, hipZ);
  _kneePos.set(kneeX, kneeY, kneeZ);
  _anklePos.set(leg.pedalX, ankleY, ankleZ);
  _pedalPos.set(leg.pedalX, pedalY, pedalZ);
  _bbPos.set(leg.pedalX * 0.65, bbY, bbZ);

  orientSegmentBetween(leg.thigh, _hipPos, _kneePos, 1);
  orientSegmentBetween(leg.shin, _kneePos, _anklePos, 1);

  // Cycling sock covers lower third of shin
  const sockTopY = kneeY + (ankleY - kneeY) * 0.65;
  const sockTopZ = kneeZ + (ankleZ - kneeZ) * 0.65;
  _kneePos.set(leg.pedalX, sockTopY, sockTopZ);
  orientSegmentBetween(leg.sock, _kneePos, _anklePos, 1);

  // Shoe rests flat on the pedal
  leg.shoe.position.set(leg.pedalX, pedalY + 0.03, pedalZ + 0.03);
  leg.shoe.rotation.set(0.12, 0, 0);

  // Crank arm from bottom bracket to pedal
  orientSegmentBetween(leg.crank, _bbPos, _pedalPos, 1);
}

/**
 * Realistic low-poly road cyclist & racing bike (diamond frame, drop bars, aero helmet,
 * jersey pockets, articulated 2-segment IK pedaling legs & spoked wheels).
 * Faces +Z in local space.
 */
function createCyclistRig(
  jerseyColor: number,
  helmetColor: number,
  frameColor: number,
  shared: {
    tireGeo: THREE.TorusGeometry;
    rimGeo: THREE.TorusGeometry;
    hubGeo: THREE.CylinderGeometry;
    spokeGeo: THREE.BoxGeometry;
    unitCylGeo: THREE.CylinderGeometry;
    saddleGeo: THREE.BoxGeometry;
    torsoGeo: THREE.CylinderGeometry;
    shoulderGeo: THREE.SphereGeometry;
    pelvisGeo: THREE.SphereGeometry;
    headGeo: THREE.SphereGeometry;
    helmetGeo: THREE.SphereGeometry;
    glassesGeo: THREE.BoxGeometry;
    shoeGeo: THREE.BoxGeometry;
    tireMat: THREE.MeshLambertMaterial;
    rimMat: THREE.MeshLambertMaterial;
    metalMat: THREE.MeshLambertMaterial;
    shortsMat: THREE.MeshLambertMaterial;
    skinMat: THREE.MeshLambertMaterial;
    sockMat: THREE.MeshLambertMaterial;
    glassesMat: THREE.MeshBasicMaterial;
    tailLightGeo: THREE.BoxGeometry;
    tailLightMat: THREE.MeshBasicMaterial;
    stripeMat: THREE.MeshBasicMaterial;
  },
  track: <T extends { dispose: () => void }>(item: T) => T
): CyclistRig {
  const group = new THREE.Group();

  const frameMat = track(new THREE.MeshLambertMaterial({ color: frameColor }));
  const jerseyMat = track(new THREE.MeshLambertMaterial({ color: jerseyColor }));
  const helmetMat = track(new THREE.MeshLambertMaterial({ color: helmetColor }));
  const shoeMat = track(new THREE.MeshLambertMaterial({ color: helmetColor }));

  const addTube = (p1: [number, number, number], p2: [number, number, number], r: number, mat: THREE.Material) => {
    const m = new THREE.Mesh(shared.unitCylGeo, mat);
    orientSegmentBetween(m, new THREE.Vector3(...p1), new THREE.Vector3(...p2), r);
    group.add(m);
    return m;
  };

  // --- WHEELS (tire + deep carbon rim + hub + crossed spokes) ---
  const makeWheel = (zPos: number) => {
    const wg = new THREE.Group();
    wg.position.set(0, 0.34, zPos);

    const tire = new THREE.Mesh(shared.tireGeo, shared.tireMat);
    tire.rotation.y = Math.PI / 2;
    wg.add(tire);

    const rim = new THREE.Mesh(shared.rimGeo, shared.rimMat);
    rim.rotation.y = Math.PI / 2;
    wg.add(rim);

    const hub = new THREE.Mesh(shared.hubGeo, shared.metalMat);
    hub.rotation.z = Math.PI / 2;
    wg.add(hub);

    for (let s = 0; s < 3; s++) {
      const spoke = new THREE.Mesh(shared.spokeGeo, shared.metalMat);
      spoke.rotation.x = (s / 3) * Math.PI;
      wg.add(spoke);
    }

    group.add(wg);
    return wg;
  };

  const rearWheel = makeWheel(-0.5);
  const frontWheel = makeWheel(0.52);

  // --- REAL ROAD BIKE DIAMOND FRAME ---
  // Seat tube & seatpost
  addTube([0, 0.28, -0.06], [0, 0.79, -0.22], 0.02, frameMat);
  addTube([0, 0.79, -0.22], [0, 0.93, -0.26], 0.015, shared.tireMat);
  // Down tube & Top tube
  addTube([0, 0.28, -0.06], [0, 0.78, 0.36], 0.024, frameMat);
  addTube([0, 0.77, -0.21], [0, 0.88, 0.33], 0.018, frameMat);
  // Head tube
  addTube([0, 0.76, 0.36], [0, 0.91, 0.32], 0.022, frameMat);
  // Front fork blades
  addTube([-0.045, 0.77, 0.36], [-0.045, 0.34, 0.52], 0.014, frameMat);
  addTube([0.045, 0.77, 0.36], [0.045, 0.34, 0.52], 0.014, frameMat);
  // Chainstays & Seatstays
  addTube([-0.04, 0.28, -0.06], [-0.055, 0.34, -0.5], 0.012, frameMat);
  addTube([0.04, 0.28, -0.06], [0.055, 0.34, -0.5], 0.012, frameMat);
  addTube([-0.03, 0.76, -0.21], [-0.055, 0.34, -0.5], 0.01, frameMat);
  addTube([0.03, 0.76, -0.21], [0.055, 0.34, -0.5], 0.01, frameMat);
  // Stem & Drop Handlebars
  addTube([0, 0.91, 0.32], [0, 0.94, 0.43], 0.015, shared.tireMat);
  addTube([-0.21, 0.94, 0.43], [0.21, 0.94, 0.43], 0.014, shared.tireMat);
  // Brake hoods & drops
  addTube([-0.21, 0.94, 0.43], [-0.21, 0.96, 0.51], 0.016, shared.tireMat);
  addTube([0.21, 0.94, 0.43], [0.21, 0.96, 0.51], 0.016, shared.tireMat);
  addTube([-0.21, 0.94, 0.43], [-0.21, 0.82, 0.46], 0.013, shared.tireMat);
  addTube([0.21, 0.94, 0.43], [0.21, 0.82, 0.46], 0.013, shared.tireMat);

  // Saddle & Rear Red LED Tail Light
  const saddle = new THREE.Mesh(shared.saddleGeo, shared.tireMat);
  saddle.position.set(0, 0.95, -0.25);
  group.add(saddle);

  const tailLight = new THREE.Mesh(shared.tailLightGeo, shared.tailLightMat);
  tailLight.position.set(0, 0.89, -0.34);
  group.add(tailLight);

  // --- ANATOMICAL ROAD CYCLIST ---
  // Pelvis / Bib shorts on saddle
  const pelvis = new THREE.Mesh(shared.pelvisGeo, shared.shortsMat);
  pelvis.scale.set(1.25, 0.85, 1.05);
  pelvis.position.set(0, 1.02, -0.23);
  group.add(pelvis);

  // Tapered athletic torso leaning forward (~43 deg) — smooth shoulders, no protruding spheres
  const torso = new THREE.Mesh(shared.torsoGeo, jerseyMat);
  torso.position.set(0, 1.22, -0.01);
  torso.rotation.x = 0.82;
  torso.scale.set(1.24, 1.02, 0.78);
  group.add(torso);

  // Subtle horizontal back jersey stripe (instantly readable from chase cam!)
  const backStripe = new THREE.Mesh(shared.torsoGeo, shared.stripeMat);
  backStripe.position.set(0, 1.25, -0.01);
  backStripe.rotation.x = 0.82;
  backStripe.scale.set(1.27, 0.16, 0.81);
  group.add(backStripe);

  // Bent 2-segment arms smoothly joining the upper torso & gripping the hoods
  // Left arm: upper back/shoulder -> elbow -> hand
  addTube([-0.165, 1.34, 0.14], [-0.21, 1.13, 0.27], 0.044, jerseyMat);
  addTube([-0.21, 1.13, 0.27], [-0.21, 0.97, 0.48], 0.035, shared.skinMat);
  // Right arm: upper back/shoulder -> elbow -> hand
  addTube([0.165, 1.34, 0.14], [0.21, 1.13, 0.27], 0.044, jerseyMat);
  addTube([0.21, 1.13, 0.27], [0.21, 0.97, 0.48], 0.035, shared.skinMat);

  // Neck + Head + Sleek Aero Helmet + Cycling Sunglasses
  addTube([0, 1.38, 0.21], [0, 1.46, 0.29], 0.045, shared.skinMat);

  const head = new THREE.Mesh(shared.headGeo, shared.skinMat);
  head.position.set(0, 1.5, 0.32);
  head.scale.set(0.92, 1.04, 1.0);
  group.add(head);

  const helmet = new THREE.Mesh(shared.helmetGeo, helmetMat);
  helmet.position.set(0, 1.56, 0.3);
  helmet.rotation.x = 0.22;
  helmet.scale.set(1.06, 0.78, 1.38);
  group.add(helmet);

  const glasses = new THREE.Mesh(shared.glassesGeo, shared.glassesMat);
  glasses.position.set(0, 1.5, 0.41);
  group.add(glasses);

  // --- ARTICULATED 2-SEGMENT IK LEGS + SHOES + CRANKS ---
  const makeLeg = (hipX: number, pedalX: number): LegRig => {
    const thigh = new THREE.Mesh(shared.unitCylGeo, shared.shortsMat);
    const shin = new THREE.Mesh(shared.unitCylGeo, shared.skinMat);
    const sock = new THREE.Mesh(shared.unitCylGeo, shared.sockMat);
    const shoe = new THREE.Mesh(shared.shoeGeo, shoeMat);
    const crank = new THREE.Mesh(shared.unitCylGeo, shared.metalMat);

    // Override base radius via initial scale; orientSegmentBetween sets (radiusScale, len, radiusScale)
    // We use thin wrapper scaling by baking cylinder radius into dedicated geometries via scale
    group.add(thigh, shin, sock, shoe, crank);
    return { thigh, shin, sock, shoe, crank, hipX, pedalX };
  };

  // Use dedicated radius multipliers by wrapping orientSegmentBetween with exact radii
  const leftLeg = makeLeg(-0.11, -0.14);
  const rightLeg = makeLeg(0.11, 0.14);

  // Set realistic initial pose
  updateArticulatedLeg(leftLeg, 0);
  updateArticulatedLeg(rightLeg, Math.PI);
  // Apply realistic limb thickness (X/Z radii)
  leftLeg.thigh.scale.x = leftLeg.thigh.scale.z = 0.068;
  rightLeg.thigh.scale.x = rightLeg.thigh.scale.z = 0.068;
  leftLeg.shin.scale.x = leftLeg.shin.scale.z = 0.048;
  rightLeg.shin.scale.x = rightLeg.shin.scale.z = 0.048;
  leftLeg.sock.scale.x = leftLeg.sock.scale.z = 0.052;
  rightLeg.sock.scale.x = rightLeg.sock.scale.z = 0.052;
  leftLeg.crank.scale.x = leftLeg.crank.scale.z = 0.014;
  rightLeg.crank.scale.x = rightLeg.crank.scale.z = 0.014;

  return { group, leftLeg, rightLeg, rearWheel, frontWheel, phase: 0 };
}

/**
 * Adds iconic low-poly Rome landmarks along the route:
 * - Colosseo (multi-tier travertine amphitheatre)
 * - Cupola di San Pietro (St. Peter's dome on skyline)
 * - Arco di Costantino (triple-arch triumphal monument)
 */
function addRomeLandmarks(
  scene: THREE.Scene,
  curve: THREE.CatmullRomCurve3,
  roadHalfWidth: number,
  isNight: boolean,
  track: <T extends { dispose: () => void }>(item: T) => T
) {
  const up = new THREE.Vector3(0, 1, 0);
  const pos = new THREE.Vector3();
  const tan = new THREE.Vector3();
  const right = new THREE.Vector3();

  const travertineMat = track(
    new THREE.MeshLambertMaterial({
      color: isNight ? 0x8b7e6a : 0xe4d5bc,
      flatShading: true,
    })
  );
  const darkArchMat = track(
    new THREE.MeshLambertMaterial({
      color: isNight ? 0x1c1917 : 0x443b32,
      flatShading: true,
    })
  );
  const domeMat = track(
    new THREE.MeshLambertMaterial({
      color: isNight ? 0x475569 : 0x94a3b8,
      flatShading: true,
    })
  );

  // 1. COLOSSEO (right beside the road at u = 0.08 so you see it early!)
  curve.getPointAt(0.08, pos);
  curve.getTangentAt(0.08, tan).normalize();
  right.crossVectors(tan, up).normalize();

  const colosseum = new THREE.Group();
  colosseum.position.set(
    pos.x + right.x * (roadHalfWidth + 34),
    pos.y,
    pos.z + right.z * (roadHalfWidth + 34)
  );
  // 3 stacked travertine rings + dark arch bands
  for (let tier = 0; tier < 3; tier++) {
    const outerGeo = track(new THREE.CylinderGeometry(23 - tier * 0.4, 23.4 - tier * 0.4, 5.2, 20, 1, true));
    const outer = new THREE.Mesh(outerGeo, travertineMat);
    outer.position.y = 2.6 + tier * 5.6;
    outer.scale.set(1.22, 1, 1);
    colosseum.add(outer);

    const bandGeo = track(new THREE.CylinderGeometry(22.4 - tier * 0.4, 22.4 - tier * 0.4, 2.6, 20));
    const band = new THREE.Mesh(bandGeo, darkArchMat);
    band.position.y = 2.4 + tier * 5.6;
    band.scale.set(1.22, 1, 1);
    colosseum.add(band);
  }
  // Iconic higher outer wall section (partial arc)
  const atticGeo = track(
    new THREE.CylinderGeometry(22.3, 22.3, 5.5, 16, 1, true, 0, Math.PI * 1.15)
  );
  const attic = new THREE.Mesh(atticGeo, travertineMat);
  attic.position.y = 19.2;
  attic.scale.set(1.22, 1, 1);
  colosseum.add(attic);
  scene.add(colosseum);

  // 2. ARCO DI COSTANTINO (triumphal arch right beside the road at u = 0.28)
  curve.getPointAt(0.28, pos);
  curve.getTangentAt(0.28, tan).normalize();
  right.crossVectors(tan, up).normalize();
  const yawArch = Math.atan2(tan.x, tan.z);

  const archGroup = new THREE.Group();
  archGroup.position.set(
    pos.x - right.x * (roadHalfWidth + 14),
    pos.y,
    pos.z - right.z * (roadHalfWidth + 14)
  );
  archGroup.rotation.y = yawArch + Math.PI / 2;

  const pillarGeo = track(new THREE.BoxGeometry(2.6, 11, 4.2));
  [-6.5, -2.2, 2.2, 6.5].forEach((px) => {
    const p = new THREE.Mesh(pillarGeo, travertineMat);
    p.position.set(px, 5.5, 0);
    archGroup.add(p);
  });
  const archTopGeo = track(new THREE.BoxGeometry(16.2, 4.2, 4.6));
  const archTop = new THREE.Mesh(archTopGeo, travertineMat);
  archTop.position.set(0, 12.8, 0);
  archGroup.add(archTop);
  scene.add(archGroup);

  // 3. CUPOLA DI SAN PIETRO (rising proudly on the skyline at u = 0.62)
  curve.getPointAt(0.62, pos);
  curve.getTangentAt(0.62, tan).normalize();
  right.crossVectors(tan, up).normalize();

  const basilica = new THREE.Group();
  basilica.position.set(
    pos.x + right.x * (roadHalfWidth + 46),
    pos.y,
    pos.z + right.z * (roadHalfWidth + 46)
  );
  const baseGeo = track(new THREE.BoxGeometry(36, 16, 26));
  const base = new THREE.Mesh(baseGeo, travertineMat);
  base.position.y = 8;
  basilica.add(base);

  const drumGeo = track(new THREE.CylinderGeometry(11, 11.5, 11, 14));
  const drum = new THREE.Mesh(drumGeo, travertineMat);
  drum.position.y = 21.5;
  basilica.add(drum);

  const domeGeo = track(new THREE.SphereGeometry(11.2, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2));
  const dome = new THREE.Mesh(domeGeo, domeMat);
  dome.position.y = 26.8;
  basilica.add(dome);

  const lanternGeo = track(new THREE.CylinderGeometry(1.4, 2.1, 7, 8));
  const lantern = new THREE.Mesh(lanternGeo, travertineMat);
  lantern.position.y = 40;
  basilica.add(lantern);
  scene.add(basilica);
}

/**
 * Adds iconic low-poly New York landmarks along the route:
 * - Empire State Building (stepped Art Deco tower + lit spire)
 * - Statue of Liberty (copper-green statue + pedestal + glowing torch)
 * - One World Trade Center (tapered glass tower + antenna)
 */
function addNewYorkLandmarks(
  scene: THREE.Scene,
  curve: THREE.CatmullRomCurve3,
  roadHalfWidth: number,
  isNight: boolean,
  track: <T extends { dispose: () => void }>(item: T) => T
) {
  const up = new THREE.Vector3(0, 1, 0);
  const pos = new THREE.Vector3();
  const tan = new THREE.Vector3();
  const right = new THREE.Vector3();

  // 1. EMPIRE STATE BUILDING (at u = 0.09)
  curve.getPointAt(0.09, pos);
  curve.getTangentAt(0.09, tan).normalize();
  right.crossVectors(tan, up).normalize();

  const empireMat = track(
    new THREE.MeshLambertMaterial({
      color: isNight ? 0x64748b : 0xcbd5e1,
      flatShading: true,
    })
  );
  const beaconMat = track(new THREE.MeshBasicMaterial({ color: 0xfef08a }));

  const empire = new THREE.Group();
  empire.position.set(
    pos.x + right.x * (roadHalfWidth + 32),
    pos.y,
    pos.z + right.z * (roadHalfWidth + 32)
  );
  const tiers: [number, number, number, number][] = [
    [22, 22, 18, 9],
    [16, 46, 14, 41],
    [11, 24, 10, 76],
    [6.5, 14, 6.5, 95],
  ];
  tiers.forEach(([w, h, d, y]) => {
    const m = new THREE.Mesh(track(new THREE.BoxGeometry(w, h, d)), empireMat);
    m.position.y = y;
    empire.add(m);
  });
  const spire = new THREE.Mesh(track(new THREE.CylinderGeometry(0.25, 1.3, 24, 6)), empireMat);
  spire.position.y = 114;
  empire.add(spire);
  const beacon = new THREE.Mesh(track(new THREE.SphereGeometry(1.1, 6, 6)), beaconMat);
  beacon.position.y = 126;
  empire.add(beacon);
  scene.add(empire);

  // 2. STATUE OF LIBERTY (at u = 0.36)
  curve.getPointAt(0.36, pos);
  curve.getTangentAt(0.36, tan).normalize();
  right.crossVectors(tan, up).normalize();

  const copperMat = track(
    new THREE.MeshLambertMaterial({
      color: isNight ? 0x2d7a6e : 0x5eead4,
      flatShading: true,
    })
  );
  const stoneMat = track(
    new THREE.MeshLambertMaterial({
      color: isNight ? 0x52525b : 0xd6d3d1,
      flatShading: true,
    })
  );
  const torchMat = track(new THREE.MeshBasicMaterial({ color: 0xfbbf24 }));

  const liberty = new THREE.Group();
  liberty.position.set(
    pos.x - right.x * (roadHalfWidth + 28),
    pos.y,
    pos.z - right.z * (roadHalfWidth + 28)
  );
  const pedestal = new THREE.Mesh(track(new THREE.BoxGeometry(11, 14, 11)), stoneMat);
  pedestal.position.y = 7;
  liberty.add(pedestal);

  const robe = new THREE.Mesh(track(new THREE.CylinderGeometry(2.4, 4.2, 18, 7)), copperMat);
  robe.position.y = 23;
  liberty.add(robe);

  const lHead = new THREE.Mesh(track(new THREE.BoxGeometry(2.4, 2.8, 2.4)), copperMat);
  lHead.position.y = 33.4;
  liberty.add(lHead);

  const crown = new THREE.Mesh(track(new THREE.ConeGeometry(2.5, 2.2, 7)), copperMat);
  crown.position.y = 35.6;
  liberty.add(crown);

  const torchArm = new THREE.Mesh(track(new THREE.BoxGeometry(1.1, 8.5, 1.1)), copperMat);
  torchArm.position.set(2.4, 36.2, 0);
  torchArm.rotation.z = -0.18;
  liberty.add(torchArm);

  const flame = new THREE.Mesh(track(new THREE.SphereGeometry(1.4, 6, 6)), torchMat);
  flame.position.set(3.2, 41.2, 0);
  liberty.add(flame);
  scene.add(liberty);

  // 3. ONE WORLD TRADE CENTER (at u = 0.68)
  curve.getPointAt(0.68, pos);
  curve.getTangentAt(0.68, tan).normalize();
  right.crossVectors(tan, up).normalize();

  const glassMat = track(
    new THREE.MeshLambertMaterial({
      color: isNight ? 0x1e3a8a : 0x60a5fa,
      flatShading: true,
    })
  );
  const wtc = new THREE.Group();
  wtc.position.set(
    pos.x + right.x * (roadHalfWidth + 36),
    pos.y,
    pos.z + right.z * (roadHalfWidth + 36)
  );
  const wtcTower = new THREE.Mesh(track(new THREE.CylinderGeometry(8, 13, 112, 8)), glassMat);
  wtcTower.position.y = 56;
  wtc.add(wtcTower);
  const wtcSpire = new THREE.Mesh(track(new THREE.CylinderGeometry(0.25, 0.9, 28, 6)), empireMat);
  wtcSpire.position.y = 126;
  wtc.add(wtcSpire);
  scene.add(wtc);
}

/**
 * Adds iconic low-poly Paris landmarks along the boulevard:
 * - Tour Eiffel (4 tapered legs, 2 platforms, tall spire + golden night glow)
 * - Arc de Triomphe (monumental arch)
 * - Pyramide du Louvre (glowing glass pyramid)
 */
function addParisLandmarks(
  scene: THREE.Scene,
  curve: THREE.CatmullRomCurve3,
  roadHalfWidth: number,
  isNight: boolean,
  track: <T extends { dispose: () => void }>(item: T) => T
) {
  const up = new THREE.Vector3(0, 1, 0);
  const pos = new THREE.Vector3();
  const tan = new THREE.Vector3();
  const right = new THREE.Vector3();

  // 1. TOUR EIFFEL (at u = 0.08 so you see it right away!)
  curve.getPointAt(0.08, pos);
  curve.getTangentAt(0.08, tan).normalize();
  right.crossVectors(tan, up).normalize();

  const ironMat = track(
    new THREE.MeshLambertMaterial({
      color: isNight ? 0x9a7b4f : 0x6b5b4d,
      emissive: isNight ? new THREE.Color(0xd99b26) : new THREE.Color(0x000000),
      emissiveIntensity: isNight ? 0.55 : 0,
      flatShading: true,
    })
  );
  const beaconMat = track(new THREE.MeshBasicMaterial({ color: 0xfef08a }));
  const unitCyl = track(new THREE.CylinderGeometry(1, 1, 1, 6));

  const eiffel = new THREE.Group();
  eiffel.position.set(
    pos.x + right.x * (roadHalfWidth + 42),
    pos.y,
    pos.z + right.z * (roadHalfWidth + 42)
  );

  const addBeam = (p1: [number, number, number], p2: [number, number, number], r: number) => {
    const m = new THREE.Mesh(unitCyl, ironMat);
    orientSegmentBetween(m, new THREE.Vector3(...p1), new THREE.Vector3(...p2), r);
    eiffel.add(m);
  };

  // 4 wide legs tapering to 1st deck (y=24) and 2nd deck (y=50)
  const legCorners: [number, number][] = [
    [-16, -16],
    [16, -16],
    [16, 16],
    [-16, 16],
  ];
  legCorners.forEach(([cx, cz]) => {
    addBeam([cx, 0, cz], [cx * 0.56, 24, cz * 0.56], 2.2);
    addBeam([cx * 0.56, 24, cz * 0.56], [cx * 0.3, 50, cz * 0.3], 1.6);
  });

  // 1st & 2nd observation decks
  const deck1 = new THREE.Mesh(track(new THREE.BoxGeometry(20, 3.2, 20)), ironMat);
  deck1.position.y = 24;
  eiffel.add(deck1);

  const deck2 = new THREE.Mesh(track(new THREE.BoxGeometry(11.5, 2.8, 11.5)), ironMat);
  deck2.position.y = 50;
  eiffel.add(deck2);

  // Upper tapered tower + antenna + glowing beacon
  const upperTower = new THREE.Mesh(track(new THREE.CylinderGeometry(1.4, 4.6, 56, 4)), ironMat);
  upperTower.position.y = 78;
  upperTower.rotation.y = Math.PI / 4;
  eiffel.add(upperTower);

  const antenna = new THREE.Mesh(track(new THREE.CylinderGeometry(0.25, 0.8, 18, 6)), ironMat);
  antenna.position.y = 115;
  eiffel.add(antenna);

  const beacon = new THREE.Mesh(track(new THREE.SphereGeometry(1.6, 6, 6)), beaconMat);
  beacon.position.y = 124;
  eiffel.add(beacon);
  scene.add(eiffel);

  // 2. ARC DE TRIOMPHE (at u = 0.34)
  curve.getPointAt(0.34, pos);
  curve.getTangentAt(0.34, tan).normalize();
  right.crossVectors(tan, up).normalize();
  const yawArc = Math.atan2(tan.x, tan.z);

  const stoneMat = track(
    new THREE.MeshLambertMaterial({
      color: isNight ? 0x9e9585 : 0xeae2d3,
      emissive: isNight ? new THREE.Color(0x524228) : new THREE.Color(0x000000),
      emissiveIntensity: isNight ? 0.35 : 0,
      flatShading: true,
    })
  );

  const arc = new THREE.Group();
  arc.position.set(
    pos.x - right.x * (roadHalfWidth + 24),
    pos.y,
    pos.z - right.z * (roadHalfWidth + 24)
  );
  arc.rotation.y = yawArc + Math.PI / 2;

  const legGeo = track(new THREE.BoxGeometry(8.5, 20, 12));
  const leftPillar = new THREE.Mesh(legGeo, stoneMat);
  leftPillar.position.set(-9, 10, 0);
  const rightPillar = new THREE.Mesh(legGeo, stoneMat);
  rightPillar.position.set(9, 10, 0);
  const attic = new THREE.Mesh(track(new THREE.BoxGeometry(28, 10, 13)), stoneMat);
  attic.position.set(0, 24, 0);
  arc.add(leftPillar, rightPillar, attic);
  scene.add(arc);

  // 3. PYRAMIDE DU LOUVRE (at u = 0.66)
  curve.getPointAt(0.66, pos);
  curve.getTangentAt(0.66, tan).normalize();
  right.crossVectors(tan, up).normalize();

  const glassPyrMat = track(
    new THREE.MeshLambertMaterial({
      color: isNight ? 0x38bdf8 : 0x7dd3fc,
      emissive: isNight ? new THREE.Color(0xfbbf24) : new THREE.Color(0x000000),
      emissiveIntensity: isNight ? 0.6 : 0,
      transparent: true,
      opacity: 0.85,
      flatShading: true,
    })
  );
  const pyramid = new THREE.Mesh(track(new THREE.ConeGeometry(22, 18, 4)), glassPyrMat);
  pyramid.position.set(
    pos.x + right.x * (roadHalfWidth + 32),
    pos.y + 9,
    pos.z + right.z * (roadHalfWidth + 32)
  );
  pyramid.rotation.y = Math.PI / 4;
  scene.add(pyramid);
}

export const RoadScene3D: React.FC<RoadScene3DProps> = ({
  speedKmh,
  theme,
  quality,
  world,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const speedKmhRef = useRef(speedKmh);
  const qualityRef = useRef<RoadQuality>(quality);
  speedKmhRef.current = speedKmh;
  qualityRef.current = quality;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const palette = THEME_PALETTES[theme];
    const isEco = qualityRef.current === 'eco';
    const disposables: Array<{ dispose: () => void }> = [];
    const track = <T extends { dispose: () => void }>(item: T): T => {
      disposables.push(item);
      return item;
    };

    // 1. Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: !isEco,
      powerPreference: isEco ? 'low-power' : 'default',
      stencil: false,
      depth: true,
    });
    renderer.setPixelRatio(isEco ? 1 : Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(container.clientWidth || 640, container.clientHeight || 360);
    renderer.shadowMap.enabled = false;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    container.appendChild(renderer.domElement);

    // 2. Scene & Fog
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(palette.fogColor, palette.fogDensity);
    scene.background = new THREE.Color(palette.fogColor);

    // 3. Camera
    const camera = new THREE.PerspectiveCamera(
      62,
      (container.clientWidth || 640) / Math.max(1, container.clientHeight || 360),
      0.5,
      700
    );

    // 4. Sky Dome
    const skyGeo = track(new THREE.SphereGeometry(540, 12, 8));
    const skyMat = track(
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          uTopColor: { value: new THREE.Color(palette.skyTop) },
          uHorizonColor: { value: new THREE.Color(palette.skyHorizon) },
        },
        vertexShader: `
          varying vec3 vLocalPos;
          void main() {
            vLocalPos = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 uTopColor;
          uniform vec3 uHorizonColor;
          varying vec3 vLocalPos;
          void main() {
            float h = clamp(normalize(vLocalPos).y, 0.0, 1.0);
            vec3 col = mix(uHorizonColor, uTopColor, pow(h, 0.55));
            gl_FragColor = vec4(col, 1.0);
          }
        `,
      })
    );
    const skyDome = new THREE.Mesh(skyGeo, skyMat);
    scene.add(skyDome);

    const sunDisc = new THREE.Mesh(
      track(new THREE.CircleGeometry(18, 12)),
      track(
        new THREE.MeshBasicMaterial({
          color: palette.sunDiscColor,
          fog: false,
          depthWrite: false,
        })
      )
    );
    sunDisc.position.set(...palette.sunPos);
    skyDome.add(sunDisc);

    // 5. Lights
    scene.add(new THREE.HemisphereLight(palette.hemiSky, palette.hemiGround, palette.hemiIntensity));
    const sunLight = new THREE.DirectionalLight(palette.sunColor, palette.sunIntensity);
    sunLight.position.set(...palette.sunPos);
    scene.add(sunLight);

    const headlight = new THREE.PointLight(0xfff4d6, palette.isNight ? 2.6 : 0, 52, 1.4);
    scene.add(headlight);

    // 6. Road & Ground
    const curve = createLoopCurve(world);
    const totalLoopLength = curve.getLength();
    const roadHalfWidth = world === 'newyork' ? 5.2 : world === 'paris' ? 4.8 : world === 'roma' ? 4.2 : 3.4;
    const { roadGeo, terrainGeo } = buildRoadAndTerrain(curve, 320, roadHalfWidth, 92, world);
    track(roadGeo);
    track(terrainGeo);

    const roadTex = track(createRoadTexture(world, renderer.capabilities.getMaxAnisotropy()));
    const roadMat = track(new THREE.MeshLambertMaterial({ map: roadTex }));
    scene.add(new THREE.Mesh(roadGeo, roadMat));

    const groundColor =
      world === 'newyork'
        ? palette.isNight
          ? 0x1e242d
          : 0x64748b
        : world === 'paris'
        ? palette.isNight
          ? 0x24262e
          : 0x949088
        : world === 'roma'
        ? palette.isNight
          ? 0x26231d
          : 0x8b7e66
        : palette.isNight
        ? 0x1a3326
        : theme === 'golden'
        ? 0x7c8c2e
        : theme === 'mist'
        ? 0x4b7748
        : 0x5c9e31;

    const terrainMat = track(
      new THREE.MeshLambertMaterial({
        color: groundColor,
        vertexColors: true,
        flatShading: true,
      })
    );
    scene.add(new THREE.Mesh(terrainGeo, terrainMat));

    // Helper objects for instanced placement
    const rand = seededRandom(
      world === 'newyork' ? 101 : world === 'roma' ? 202 : world === 'paris' ? 303 : 42
    );
    const dummy = new THREE.Object3D();
    const up = new THREE.Vector3(0, 1, 0);
    const pPos = new THREE.Vector3();
    const pTan = new THREE.Vector3();
    const pRight = new THREE.Vector3();

    // 7. World-Specific Props + Famous Landmarks
    if (world === 'valley') {
      const treeCount = 140;
      const trunkGeo = track(new THREE.BoxGeometry(0.65, 3.2, 0.65));
      const trunkMat = track(
        new THREE.MeshLambertMaterial({
          color: palette.isNight ? 0x261a12 : 0x6b4423,
          flatShading: true,
        })
      );
      const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);

      const leafCountA = Math.floor(treeCount / 2);
      const leafCountB = treeCount - leafCountA;
      const leafGeoA = track(new THREE.BoxGeometry(3.2, 3.4, 3.2));
      const leafGeoB = track(new THREE.ConeGeometry(2.3, 5.4, 5));
      const leafMatA = track(
        new THREE.MeshLambertMaterial({
          color: palette.isNight ? 0x132e22 : 0x2d6a30,
          flatShading: true,
        })
      );
      const leafMatB = track(
        new THREE.MeshLambertMaterial({
          color: palette.isNight ? 0x1b3d2e : 0x3f8f3a,
          flatShading: true,
        })
      );
      const leavesA = new THREE.InstancedMesh(leafGeoA, leafMatA, leafCountA);
      const leavesB = new THREE.InstancedMesh(leafGeoB, leafMatB, leafCountB);

      let idxA = 0;
      let idxB = 0;
      for (let i = 0; i < treeCount; i++) {
        const t = (i / treeCount + (rand() - 0.5) * 0.005 + 1) % 1;
        curve.getPointAt(t, pPos);
        curve.getTangentAt(t, pTan).normalize();
        pRight.crossVectors(pTan, up).normalize();

        const side = rand() > 0.5 ? 1 : -1;
        const dist = roadHalfWidth + 4.5 + rand() * 34;
        const scale = 0.75 + rand() * 0.85;
        const yLift = ((dist - roadHalfWidth) / 92) ** 2 * 14;

        const x = pPos.x + pRight.x * side * dist;
        const y = pPos.y + yLift;
        const z = pPos.z + pRight.z * side * dist;

        dummy.position.set(x, y + 1.5 * scale, z);
        dummy.rotation.set(0, rand() * Math.PI * 2, 0);
        dummy.scale.set(scale, scale, scale);
        dummy.updateMatrix();
        trunks.setMatrixAt(i, dummy.matrix);

        if (i % 2 === 0 && idxA < leafCountA) {
          dummy.position.set(x, y + 4.0 * scale, z);
          dummy.updateMatrix();
          leavesA.setMatrixAt(idxA++, dummy.matrix);
        } else if (idxB < leafCountB) {
          dummy.position.set(x, y + 4.8 * scale, z);
          dummy.updateMatrix();
          leavesB.setMatrixAt(idxB++, dummy.matrix);
        }
      }
      trunks.instanceMatrix.needsUpdate = true;
      leavesA.instanceMatrix.needsUpdate = true;
      leavesB.instanceMatrix.needsUpdate = true;
      scene.add(trunks, leavesA, leavesB);

      const postCount = 96;
      const posts = new THREE.InstancedMesh(
        track(new THREE.BoxGeometry(0.18, 0.9, 0.18)),
        track(new THREE.MeshBasicMaterial({ color: 0xe2e8f0 })),
        postCount
      );
      for (let i = 0; i < postCount; i++) {
        const t = i / postCount;
        curve.getPointAt(t, pPos);
        curve.getTangentAt(t, pTan).normalize();
        pRight.crossVectors(pTan, up).normalize();
        const side = i % 2 === 0 ? 1 : -1;
        dummy.position.set(
          pPos.x + pRight.x * side * (roadHalfWidth + 0.8),
          pPos.y + 0.45,
          pPos.z + pRight.z * side * (roadHalfWidth + 0.8)
        );
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        posts.setMatrixAt(i, dummy.matrix);
      }
      posts.instanceMatrix.needsUpdate = true;
      scene.add(posts);

      const mtnCount = 26;
      const mountains = new THREE.InstancedMesh(
        track(new THREE.ConeGeometry(70, 95, 5)),
        track(
          new THREE.MeshLambertMaterial({
            color: palette.isNight ? 0x1e293b : 0x64748b,
            flatShading: true,
          })
        ),
        mtnCount
      );
      for (let i = 0; i < mtnCount; i++) {
        const a = (i / mtnCount) * Math.PI * 2;
        const dist = 540 + (rand() - 0.5) * 90;
        const sx = 0.8 + rand() * 1.1;
        const sy = 0.7 + rand() * 1.1;
        dummy.position.set(Math.cos(a) * dist, 28 * sy - 12, Math.sin(a) * dist);
        dummy.rotation.set(0, rand() * Math.PI, 0);
        dummy.scale.set(sx, sy, sx);
        dummy.updateMatrix();
        mountains.setMatrixAt(i, dummy.matrix);
      }
      mountains.instanceMatrix.needsUpdate = true;
      scene.add(mountains);
    } else if (world === 'newyork') {
      const nyTex = createBuildingTextures('newyork', palette.isNight);
      track(nyTex.map);
      nyTex.map.repeat.set(1, 3);
      if (nyTex.emissiveMap) {
        track(nyTex.emissiveMap);
        nyTex.emissiveMap.repeat.set(1, 3);
      }
      const bldgCount = 136;
      const buildings = new THREE.InstancedMesh(
        track(new THREE.BoxGeometry(1, 1, 1)),
        track(
          new THREE.MeshLambertMaterial({
            map: nyTex.map,
            emissive: palette.isNight ? new THREE.Color(0xffe49e) : new THREE.Color(0x000000),
            emissiveMap: nyTex.emissiveMap,
            emissiveIntensity: palette.isNight ? 1.25 : 0,
            color: palette.isNight ? 0x94a3b8 : 0xe2e8f0,
            flatShading: true,
          })
        ),
        bldgCount
      );
      for (let i = 0; i < bldgCount; i++) {
        const t = (i / bldgCount + (rand() - 0.5) * 0.003 + 1) % 1;
        curve.getPointAt(t, pPos);
        curve.getTangentAt(t, pTan).normalize();
        pRight.crossVectors(pTan, up).normalize();

        const side = i % 2 === 0 ? 1 : -1;
        const w = 9 + rand() * 11;
        const d = 10 + rand() * 12;
        const h = 18 + Math.pow(rand(), 1.4) * 72;
        const dist = roadHalfWidth + 7 + w * 0.5 + rand() * 18;
        const yaw = Math.atan2(pTan.x, pTan.z);

        dummy.position.set(
          pPos.x + pRight.x * side * dist,
          pPos.y + h * 0.5,
          pPos.z + pRight.z * side * dist
        );
        dummy.rotation.set(0, yaw, 0);
        dummy.scale.set(w, h, d);
        dummy.updateMatrix();
        buildings.setMatrixAt(i, dummy.matrix);
      }
      buildings.instanceMatrix.needsUpdate = true;
      scene.add(buildings);

      const lampCount = 80;
      const poles = new THREE.InstancedMesh(
        track(new THREE.BoxGeometry(0.22, 6.2, 0.22)),
        track(new THREE.MeshLambertMaterial({ color: 0x334155 })),
        lampCount
      );
      const bulbs = new THREE.InstancedMesh(
        track(new THREE.BoxGeometry(0.9, 0.28, 0.4)),
        track(new THREE.MeshBasicMaterial({ color: palette.isNight ? 0xfef08a : 0xe2e8f0 })),
        lampCount
      );
      for (let i = 0; i < lampCount; i++) {
        const t = i / lampCount;
        curve.getPointAt(t, pPos);
        curve.getTangentAt(t, pTan).normalize();
        pRight.crossVectors(pTan, up).normalize();
        const side = i % 2 === 0 ? 1 : -1;
        const yaw = Math.atan2(pTan.x, pTan.z);
        const lx = pPos.x + pRight.x * side * (roadHalfWidth + 1.2);
        const lz = pPos.z + pRight.z * side * (roadHalfWidth + 1.2);

        dummy.position.set(lx, pPos.y + 3.1, lz);
        dummy.rotation.set(0, yaw, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        poles.setMatrixAt(i, dummy.matrix);

        dummy.position.set(lx - pRight.x * side * 0.4, pPos.y + 6.1, lz - pRight.z * side * 0.4);
        dummy.updateMatrix();
        bulbs.setMatrixAt(i, dummy.matrix);
      }
      poles.instanceMatrix.needsUpdate = true;
      bulbs.instanceMatrix.needsUpdate = true;
      scene.add(poles, bulbs);

      addNewYorkLandmarks(scene, curve, roadHalfWidth, palette.isNight, track);
    } else if (world === 'roma') {
      const romaTex = createBuildingTextures('roma', palette.isNight);
      track(romaTex.map);
      if (romaTex.emissiveMap) track(romaTex.emissiveMap);
      const palCount = 76;
      const palazzi = new THREE.InstancedMesh(
        track(new THREE.BoxGeometry(1, 1, 1)),
        track(
          new THREE.MeshLambertMaterial({
            map: romaTex.map,
            emissive: palette.isNight ? new THREE.Color(0xffd670) : new THREE.Color(0x000000),
            emissiveMap: romaTex.emissiveMap,
            emissiveIntensity: palette.isNight ? 1.15 : 0,
            color: palette.isNight ? 0xb48a6b : 0xf5e6d3,
            flatShading: true,
          })
        ),
        palCount
      );
      const roofs = new THREE.InstancedMesh(
        track(new THREE.ConeGeometry(0.75, 0.35, 4)),
        track(
          new THREE.MeshLambertMaterial({
            color: palette.isNight ? 0x4a2018 : 0xa3432c,
            flatShading: true,
          })
        ),
        palCount
      );

      for (let i = 0; i < palCount; i++) {
        const t = (i / palCount + (rand() - 0.5) * 0.004 + 1) % 1;
        curve.getPointAt(t, pPos);
        curve.getTangentAt(t, pTan).normalize();
        pRight.crossVectors(pTan, up).normalize();

        const side = i % 2 === 0 ? 1 : -1;
        const w = 10 + rand() * 8;
        const d = 10 + rand() * 8;
        const h = 11 + rand() * 11;
        const dist = roadHalfWidth + 10 + w * 0.5 + rand() * 14;
        const yaw = Math.atan2(pTan.x, pTan.z);

        const x = pPos.x + pRight.x * side * dist;
        const z = pPos.z + pRight.z * side * dist;

        dummy.position.set(x, pPos.y + h * 0.5, z);
        dummy.rotation.set(0, yaw, 0);
        dummy.scale.set(w, h, d);
        dummy.updateMatrix();
        palazzi.setMatrixAt(i, dummy.matrix);

        dummy.position.set(x, pPos.y + h + h * 0.14, z);
        dummy.rotation.set(0, yaw + Math.PI / 4, 0);
        dummy.scale.set(w * 1.05, h * 0.85, d * 1.05);
        dummy.updateMatrix();
        roofs.setMatrixAt(i, dummy.matrix);
      }
      palazzi.instanceMatrix.needsUpdate = true;
      roofs.instanceMatrix.needsUpdate = true;
      scene.add(palazzi, roofs);

      // Roman Umbrella Pines
      const pineCount = 86;
      const pineTrunks = new THREE.InstancedMesh(
        track(new THREE.CylinderGeometry(0.28, 0.42, 8.5, 5)),
        track(
          new THREE.MeshLambertMaterial({
            color: palette.isNight ? 0x3b2a1e : 0x7c5438,
            flatShading: true,
          })
        ),
        pineCount
      );
      const pineCanopies = new THREE.InstancedMesh(
        track(new THREE.CylinderGeometry(3.8, 2.2, 2.2, 7)),
        track(
          new THREE.MeshLambertMaterial({
            color: palette.isNight ? 0x173b29 : 0x2f6b3c,
            flatShading: true,
          })
        ),
        pineCount
      );
      for (let i = 0; i < pineCount; i++) {
        const t = (i / pineCount + rand() * 0.005) % 1;
        curve.getPointAt(t, pPos);
        curve.getTangentAt(t, pTan).normalize();
        pRight.crossVectors(pTan, up).normalize();
        const side = i % 2 === 0 ? 1 : -1;
        const dist = roadHalfWidth + 3.2 + rand() * 6;
        const s = 0.8 + rand() * 0.55;
        const x = pPos.x + pRight.x * side * dist;
        const z = pPos.z + pRight.z * side * dist;

        dummy.position.set(x, pPos.y + 4.2 * s, z);
        dummy.rotation.set(0, rand() * Math.PI * 2, 0);
        dummy.scale.set(s, s, s);
        dummy.updateMatrix();
        pineTrunks.setMatrixAt(i, dummy.matrix);

        dummy.position.set(x, pPos.y + 8.8 * s, z);
        dummy.updateMatrix();
        pineCanopies.setMatrixAt(i, dummy.matrix);
      }
      pineTrunks.instanceMatrix.needsUpdate = true;
      pineCanopies.instanceMatrix.needsUpdate = true;
      scene.add(pineTrunks, pineCanopies);

      addRomeLandmarks(scene, curve, roadHalfWidth, palette.isNight, track);
    } else if (world === 'paris') {
      // Haussmann limestone buildings with Mansard slate-blue roofs & glowing night windows
      const parisTex = createBuildingTextures('paris', palette.isNight);
      track(parisTex.map);
      if (parisTex.emissiveMap) track(parisTex.emissiveMap);

      const hCount = 92;
      const haussmann = new THREE.InstancedMesh(
        track(new THREE.BoxGeometry(1, 1, 1)),
        track(
          new THREE.MeshLambertMaterial({
            map: parisTex.map,
            emissive: palette.isNight ? new THREE.Color(0xffe08a) : new THREE.Color(0x000000),
            emissiveMap: parisTex.emissiveMap,
            emissiveIntensity: palette.isNight ? 1.2 : 0,
            color: palette.isNight ? 0x9ca3af : 0xf5efe6,
            flatShading: true,
          })
        ),
        hCount
      );
      const mansards = new THREE.InstancedMesh(
        track(new THREE.CylinderGeometry(0.62, 0.78, 0.35, 4)),
        track(
          new THREE.MeshLambertMaterial({
            color: palette.isNight ? 0x1e293b : 0x475569,
            flatShading: true,
          })
        ),
        hCount
      );

      for (let i = 0; i < hCount; i++) {
        const t = (i / hCount + (rand() - 0.5) * 0.003 + 1) % 1;
        curve.getPointAt(t, pPos);
        curve.getTangentAt(t, pTan).normalize();
        pRight.crossVectors(pTan, up).normalize();

        const side = i % 2 === 0 ? 1 : -1;
        const w = 11 + rand() * 7;
        const d = 10 + rand() * 6;
        const h = 15 + rand() * 7;
        const dist = roadHalfWidth + 11 + w * 0.5 + rand() * 10;
        const yaw = Math.atan2(pTan.x, pTan.z);

        const x = pPos.x + pRight.x * side * dist;
        const z = pPos.z + pRight.z * side * dist;

        dummy.position.set(x, pPos.y + h * 0.5, z);
        dummy.rotation.set(0, yaw, 0);
        dummy.scale.set(w, h, d);
        dummy.updateMatrix();
        haussmann.setMatrixAt(i, dummy.matrix);

        dummy.position.set(x, pPos.y + h + 2.1, z);
        dummy.rotation.set(0, yaw + Math.PI / 4, 0);
        dummy.scale.set(w * 0.96, 12, d * 0.96);
        dummy.updateMatrix();
        mansards.setMatrixAt(i, dummy.matrix);
      }
      haussmann.instanceMatrix.needsUpdate = true;
      mansards.instanceMatrix.needsUpdate = true;
      scene.add(haussmann, mansards);

      // Champs-Élysées boulevard trees + vintage Parisian lampposts
      const treeCount = 80;
      const pTrunks = new THREE.InstancedMesh(
        track(new THREE.CylinderGeometry(0.22, 0.28, 3.6, 5)),
        track(new THREE.MeshLambertMaterial({ color: palette.isNight ? 0x292019 : 0x5c4632 })),
        treeCount
      );
      const pCanopies = new THREE.InstancedMesh(
        track(new THREE.DodecahedronGeometry(2.2, 0)),
        track(
          new THREE.MeshLambertMaterial({
            color: palette.isNight ? 0x163827 : 0x3b7a44,
            flatShading: true,
          })
        ),
        treeCount
      );
      const lampPoles = new THREE.InstancedMesh(
        track(new THREE.CylinderGeometry(0.1, 0.14, 5.2, 5)),
        track(new THREE.MeshLambertMaterial({ color: 0x1f2937 })),
        treeCount
      );
      const lampGlobes = new THREE.InstancedMesh(
        track(new THREE.SphereGeometry(0.32, 6, 6)),
        track(new THREE.MeshBasicMaterial({ color: palette.isNight ? 0xffe484 : 0xf1f5f9 })),
        treeCount
      );

      for (let i = 0; i < treeCount; i++) {
        const t = i / treeCount;
        curve.getPointAt(t, pPos);
        curve.getTangentAt(t, pTan).normalize();
        pRight.crossVectors(pTan, up).normalize();
        const side = i % 2 === 0 ? 1 : -1;

        const tx = pPos.x + pRight.x * side * (roadHalfWidth + 4.4);
        const tz = pPos.z + pRight.z * side * (roadHalfWidth + 4.4);
        dummy.position.set(tx, pPos.y + 1.8, tz);
        dummy.rotation.set(0, rand() * Math.PI, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        pTrunks.setMatrixAt(i, dummy.matrix);

        dummy.position.set(tx, pPos.y + 4.4, tz);
        dummy.updateMatrix();
        pCanopies.setMatrixAt(i, dummy.matrix);

        const lx = pPos.x + pRight.x * side * (roadHalfWidth + 1.4);
        const lz = pPos.z + pRight.z * side * (roadHalfWidth + 1.4);
        dummy.position.set(lx, pPos.y + 2.6, lz);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        lampPoles.setMatrixAt(i, dummy.matrix);

        dummy.position.set(lx, pPos.y + 5.35, lz);
        dummy.updateMatrix();
        lampGlobes.setMatrixAt(i, dummy.matrix);
      }
      pTrunks.instanceMatrix.needsUpdate = true;
      pCanopies.instanceMatrix.needsUpdate = true;
      lampPoles.instanceMatrix.needsUpdate = true;
      lampGlobes.instanceMatrix.needsUpdate = true;
      scene.add(pTrunks, pCanopies, lampPoles, lampGlobes);

      addParisLandmarks(scene, curve, roadHalfWidth, palette.isNight, track);
    }

    // 8. Blocky Clouds
    const cloudCount = 18;
    const clouds = new THREE.InstancedMesh(
      track(new THREE.BoxGeometry(28, 5.5, 14)),
      track(
        new THREE.MeshBasicMaterial({
          color: palette.cloudColor,
          transparent: true,
          opacity: 0.82,
          fog: false,
        })
      ),
      cloudCount
    );
    for (let i = 0; i < cloudCount; i++) {
      const a = (i / cloudCount) * Math.PI * 2 + rand() * 0.2;
      const dist = 170 + rand() * 230;
      dummy.position.set(Math.cos(a) * dist, 85 + rand() * 40, Math.sin(a) * dist);
      dummy.rotation.set(0, rand() * Math.PI, 0);
      const s = 0.7 + rand() * 1.1;
      dummy.scale.set(s, 0.8 + rand() * 0.4, s);
      dummy.updateMatrix();
      clouds.setMatrixAt(i, dummy.matrix);
    }
    clouds.instanceMatrix.needsUpdate = true;
    skyDome.add(clouds);

    // 9. Realistic Road Cyclist Avatar + NPC Riders (overtaking & being overtaken!)
    const sharedRider = {
      tireGeo: track(new THREE.TorusGeometry(0.34, 0.022, 8, 20)),
      rimGeo: track(new THREE.TorusGeometry(0.305, 0.022, 6, 20)),
      hubGeo: track(new THREE.CylinderGeometry(0.025, 0.025, 0.11, 8)),
      spokeGeo: track(new THREE.BoxGeometry(0.008, 0.58, 0.012)),
      unitCylGeo: track(new THREE.CylinderGeometry(1, 1, 1, 8)),
      saddleGeo: track(new THREE.BoxGeometry(0.13, 0.04, 0.27)),
      torsoGeo: track(new THREE.CylinderGeometry(0.17, 0.13, 0.54, 10)),
      shoulderGeo: track(new THREE.SphereGeometry(0.075, 8, 8)),
      pelvisGeo: track(new THREE.SphereGeometry(0.13, 8, 8)),
      headGeo: track(new THREE.SphereGeometry(0.105, 10, 8)),
      helmetGeo: track(new THREE.SphereGeometry(0.115, 10, 8)),
      glassesGeo: track(new THREE.BoxGeometry(0.18, 0.045, 0.05)),
      shoeGeo: track(new THREE.BoxGeometry(0.09, 0.065, 0.24)),
      tireMat: track(new THREE.MeshLambertMaterial({ color: 0x18181b })),
      rimMat: track(new THREE.MeshLambertMaterial({ color: 0x27272a })),
      metalMat: track(new THREE.MeshLambertMaterial({ color: 0x94a3b8 })),
      shortsMat: track(new THREE.MeshLambertMaterial({ color: 0x111827 })),
      skinMat: track(new THREE.MeshLambertMaterial({ color: 0xebb994 })),
      sockMat: track(new THREE.MeshLambertMaterial({ color: 0xf8fafc })),
      glassesMat: track(new THREE.MeshBasicMaterial({ color: 0x0f172a })),
      tailLightGeo: track(new THREE.BoxGeometry(0.055, 0.065, 0.04)),
      tailLightMat: track(new THREE.MeshBasicMaterial({ color: 0xef4444 })),
      stripeMat: track(new THREE.MeshBasicMaterial({ color: 0xffffff })),
    };

    const playerRig = createCyclistRig(0x00e5a3, 0xf8fafc, 0x0ea5e9, sharedRider, track);
    scene.add(playerRig.group);

    // 6 NPC cyclists around the loop with varied speeds (slower & faster than typical rider)
    const npcConfigs = [
      { distOffset: 38, speedKmh: 22, jersey: 0xef4444, helmet: 0xfef08a, frame: 0x94a3b8, baseLane: 0.35 },
      { distOffset: 115, speedKmh: 27, jersey: 0x3b82f6, helmet: 0xffffff, frame: 0xf97316, baseLane: 0.35 },
      { distOffset: -45, speedKmh: 38, jersey: 0xf59e0b, helmet: 0x0f172a, frame: 0xe2e8f0, baseLane: -0.25 },
      { distOffset: 240, speedKmh: 19, jersey: 0xa855f7, helmet: 0xf8fafc, frame: 0x38bdf8, baseLane: 0.38 },
      { distOffset: -130, speedKmh: 42, jersey: 0xec4899, helmet: 0xffffff, frame: 0xfacc15, baseLane: -0.28 },
      { distOffset: 420, speedKmh: 31, jersey: 0x22c55e, helmet: 0x1e293b, frame: 0xf8fafc, baseLane: 0.32 },
    ];

    const npcs = npcConfigs.map((cfg) => {
      const rig = createCyclistRig(cfg.jersey, cfg.helmet, cfg.frame, sharedRider, track);
      scene.add(rig.group);
      return {
        rig,
        distance: (cfg.distOffset + totalLoopLength) % totalLoopLength,
        speedMps: cfg.speedKmh / 3.6,
        baseLane: cfg.baseLane,
        currentLane: cfg.baseLane,
      };
    });

    // ResizeObserver
    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const w = Math.max(1, Math.floor(entry.contentRect.width));
      const h = Math.max(1, Math.floor(entry.contentRect.height));
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    });
    resizeObserver.observe(container);

    // Animation Loop (steady chase camera, strict speed sync, animated cyclists)
    let rafId = 0;
    let distanceTraveled = 0;
    let smoothSpeedMps = 0;
    let lastFrameTime = performance.now();
    let lastRenderTime = 0;

    const riderPos = new THREE.Vector3();
    const riderTan = new THREE.Vector3();
    const riderRight = new THREE.Vector3();
    const camPos = new THREE.Vector3();
    const camTan = new THREE.Vector3();
    const camRight = new THREE.Vector3();
    const lookTarget = new THREE.Vector3();
    const npcPos = new THREE.Vector3();
    const npcTan = new THREE.Vector3();
    const npcRight = new THREE.Vector3();

    const placeRigOnRoad = (
      rig: CyclistRig,
      dist: number,
      laneFraction: number,
      speedMps: number,
      dt: number,
      outPos: THREE.Vector3,
      outTan: THREE.Vector3,
      outRight: THREE.Vector3
    ) => {
      const u = ((dist % totalLoopLength) + totalLoopLength) % totalLoopLength / totalLoopLength;
      curve.getPointAt(u, outPos);
      curve.getTangentAt(u, outTan).normalize();
      outRight.crossVectors(outTan, up).normalize();

      const lateral = roadHalfWidth * laneFraction;
      rig.group.position.set(
        outPos.x + outRight.x * lateral,
        outPos.y + 0.08,
        outPos.z + outRight.z * lateral
      );
      rig.group.lookAt(
        rig.group.position.x + outTan.x * 5,
        rig.group.position.y + outTan.y * 5,
        rig.group.position.z + outTan.z * 5
      );

      // Animate articulated 2-segment IK legs & spoked wheels proportional to speed
      if (speedMps > 0.05) {
        rig.phase += dt * (4.2 + speedMps * 0.72);
        const wheelSpin = (speedMps * dt) / 0.34;
        rig.rearWheel.rotation.x += wheelSpin;
        rig.frontWheel.rotation.x += wheelSpin;
      }

      updateArticulatedLeg(rig.leftLeg, rig.phase);
      updateArticulatedLeg(rig.rightLeg, rig.phase + Math.PI);

      // Re-apply anatomical radii after orientSegmentBetween updates length
      rig.leftLeg.thigh.scale.x = rig.leftLeg.thigh.scale.z = 0.068;
      rig.rightLeg.thigh.scale.x = rig.rightLeg.thigh.scale.z = 0.068;
      rig.leftLeg.shin.scale.x = rig.leftLeg.shin.scale.z = 0.048;
      rig.rightLeg.shin.scale.x = rig.rightLeg.shin.scale.z = 0.048;
      rig.leftLeg.sock.scale.x = rig.leftLeg.sock.scale.z = 0.052;
      rig.rightLeg.sock.scale.x = rig.rightLeg.sock.scale.z = 0.052;
      rig.leftLeg.crank.scale.x = rig.leftLeg.crank.scale.z = 0.014;
      rig.rightLeg.crank.scale.x = rig.rightLeg.crank.scale.z = 0.014;
    };

    const animate = (now: number) => {
      rafId = requestAnimationFrame(animate);
      if (document.hidden) {
        lastFrameTime = now;
        return;
      }

      const minInterval = qualityRef.current === 'eco' ? 32 : 0;
      if (minInterval > 0 && now - lastRenderTime < minInterval) {
        return;
      }
      lastRenderTime = now;

      const dt = Math.min(0.1, Math.max(0.001, (now - lastFrameTime) / 1000));
      lastFrameTime = now;

      // Exact speed sync: 0 km/h => completely stopped
      const liveSpeedKmh = Math.max(0, speedKmhRef.current || 0);
      const targetSpeedMps = liveSpeedKmh / 3.6;

      if (targetSpeedMps === 0 && smoothSpeedMps < 0.05) {
        smoothSpeedMps = 0;
      } else {
        smoothSpeedMps += (targetSpeedMps - smoothSpeedMps) * Math.min(1, dt * 4.5);
      }

      distanceTraveled = (distanceTraveled + smoothSpeedMps * dt) % totalLoopLength;

      // 1. Place player avatar on right lane
      const playerLane = 0.34;
      placeRigOnRoad(
        playerRig,
        distanceTraveled,
        playerLane,
        smoothSpeedMps,
        dt,
        riderPos,
        riderTan,
        riderRight
      );

      // 2. Update NPC cyclists (smoothly shift left when overtaking/being overtaken so no clipping)
      for (let i = 0; i < npcs.length; i++) {
        const npc = npcs[i];
        npc.distance = (npc.distance + npc.speedMps * dt) % totalLoopLength;

        let delta = npc.distance - distanceTraveled;
        if (delta > totalLoopLength * 0.5) delta -= totalLoopLength;
        if (delta < -totalLoopLength * 0.5) delta += totalLoopLength;

        const targetLane = Math.abs(delta) < 24 ? -0.26 : npc.baseLane;
        npc.currentLane += (targetLane - npc.currentLane) * Math.min(1, dt * 3.0);

        placeRigOnRoad(
          npc.rig,
          npc.distance,
          npc.currentLane,
          npc.speedMps,
          dt,
          npcPos,
          npcTan,
          npcRight
        );
      }

      // 3. Steady 3rd-person chase camera behind player avatar (NO pedaling bob/sway)
      const camDist = (distanceTraveled - 3.6 + totalLoopLength) % totalLoopLength;
      const camU = camDist / totalLoopLength;
      const lookU = ((distanceTraveled + 18) % totalLoopLength) / totalLoopLength;

      curve.getPointAt(camU, camPos);
      curve.getTangentAt(camU, camTan).normalize();
      camRight.crossVectors(camTan, up).normalize();
      curve.getPointAt(lookU, lookTarget);

      const camLateral = roadHalfWidth * playerLane;
      camera.position.set(
        camPos.x + camRight.x * camLateral,
        camPos.y + 2.05,
        camPos.z + camRight.z * camLateral
      );

      camera.lookAt(
        lookTarget.x + riderRight.x * camLateral,
        lookTarget.y + 1.45,
        lookTarget.z + riderRight.z * camLateral
      );

      skyDome.position.copy(camera.position);
      sunDisc.lookAt(camera.position);
      clouds.rotation.y += dt * 0.0025;

      headlight.position.set(
        playerRig.group.position.x + riderTan.x * 6,
        playerRig.group.position.y + 1.2,
        playerRig.group.position.z + riderTan.z * 6
      );

      renderer.render(scene, camera);
    };

    rafId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [world, theme, quality]);

  return <div ref={containerRef} className="w-full h-full overflow-hidden" />;
};
