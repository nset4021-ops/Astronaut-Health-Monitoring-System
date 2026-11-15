import * as THREE from 'three'

const EPSILON = 0.0001

export const MUSCLE_GROUPS = [
  { id: 'deltoids', label: 'DELTOIDS', color: '#67e8e0' },
  { id: 'biceps', label: 'BICEPS', color: '#67e8e0' },
  { id: 'triceps', label: 'TRICEPS', color: '#67e8e0' },
  { id: 'trapezius', label: 'TRAPEZIUS / UPPER BACK', color: '#ffbd5c' },
  { id: 'quadriceps', label: 'QUADRICEPS', color: '#ffbd5c' },
  { id: 'hamstrings', label: 'HAMSTRINGS', color: '#ffbd5c' },
  { id: 'glutes', label: 'GLUTES', color: '#ffbd5c' },
  { id: 'calves', label: 'CALVES', color: '#ffbd5c' },
  { id: 'core', label: 'CORE', color: '#67e8e0' },
]

function pointVector(point, width, height) {
  if (!point || !width || !height) return null
  return new THREE.Vector3(
    (point.x / width - 0.5) * 2.7,
    -(point.y / height - 0.5) * 4.4,
    -(point.z || 0),
  )
}

function angleBetween(a, b) {
  if (!a || !b || a.lengthSq() < EPSILON || b.lengthSq() < EPSILON) return null
  return THREE.MathUtils.radToDeg(a.angleTo(b))
}

function normalized(value, fallback = 0) {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback
}

function average(values) {
  const valid = values.filter(Number.isFinite)
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : 0
}

function orientationFor(landmarks, names) {
  const left = landmarks[names[0]]
  const right = landmarks[names[1]]
  const center = landmarks[names[2]]
  if (!left || !right || !center) return { yaw: null, pitch: null, roll: null }
  const across = right.clone().sub(left)
  const vertical = center.clone().sub(left.clone().add(right).multiplyScalar(0.5))
  return {
    yaw: Math.round(THREE.MathUtils.radToDeg(Math.atan2(across.z, across.x))),
    pitch: Math.round(THREE.MathUtils.radToDeg(Math.atan2(vertical.z, vertical.y))),
    roll: Math.round(THREE.MathUtils.radToDeg(Math.atan2(across.y, across.x))),
  }
}

function angularVelocity(current, previous, deltaSeconds) {
  if (!current || !previous || !deltaSeconds) return { yaw: 0, pitch: 0, roll: 0, magnitude: 0 }
  const velocity = {
    yaw: (current.yaw - previous.yaw) / deltaSeconds,
    pitch: (current.pitch - previous.pitch) / deltaSeconds,
    roll: (current.roll - previous.roll) / deltaSeconds,
  }
  return { ...velocity, magnitude: Math.round(Math.hypot(velocity.yaw, velocity.pitch, velocity.roll)) }
}

function activationFrom(load, velocity, angle, scale = 1) {
  return Math.round(normalized((load * 0.55 + velocity * 0.3 + angle * 0.15) * scale) * 100)
}

export function calculateOmnidirectionalTelemetry(keypoints, width, height, previousFrame = null, timestamp = performance.now()) {
  const names = ['left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow', 'left_hip', 'right_hip', 'left_knee', 'right_knee', 'left_ankle', 'right_ankle', 'left_wrist', 'right_wrist']
  const landmarks = Object.fromEntries(names.map((name) => {
    const point = keypoints.find((item) => (item.name || item.part) === name)
    return [name, point && (point.score ?? 0) >= 0.42 ? pointVector(point, width, height) : null]
  }))
  const orientations = {
    shoulder: orientationFor(landmarks, ['left_shoulder', 'right_shoulder', 'left_hip']),
    pelvis: orientationFor(landmarks, ['left_hip', 'right_hip', 'left_knee']),
  }
  const deltaSeconds = previousFrame ? Math.max(0.016, (timestamp - previousFrame.timestamp) / 1000) : 0
  const angularVelocity3d = {
    shoulder: angularVelocity(orientations.shoulder, previousFrame?.orientations?.shoulder, deltaSeconds),
    pelvis: angularVelocity(orientations.pelvis, previousFrame?.orientations?.pelvis, deltaSeconds),
  }
  const jointAngles = {
    leftElbow: angleBetween(landmarks.left_shoulder?.clone().sub(landmarks.left_elbow), landmarks.left_wrist?.clone().sub(landmarks.left_elbow)),
    rightElbow: angleBetween(landmarks.right_shoulder?.clone().sub(landmarks.right_elbow), landmarks.right_wrist?.clone().sub(landmarks.right_elbow)),
    leftKnee: angleBetween(landmarks.left_hip?.clone().sub(landmarks.left_knee), landmarks.left_ankle?.clone().sub(landmarks.left_knee)),
    rightKnee: angleBetween(landmarks.right_hip?.clone().sub(landmarks.right_knee), landmarks.right_ankle?.clone().sub(landmarks.right_knee)),
    leftShoulder: angleBetween(landmarks.left_hip?.clone().sub(landmarks.left_shoulder), landmarks.left_elbow?.clone().sub(landmarks.left_shoulder)),
    rightShoulder: angleBetween(landmarks.right_hip?.clone().sub(landmarks.right_shoulder), landmarks.right_elbow?.clone().sub(landmarks.right_shoulder)),
    leftHip: angleBetween(landmarks.left_shoulder?.clone().sub(landmarks.left_hip), landmarks.left_knee?.clone().sub(landmarks.left_hip)),
    rightHip: angleBetween(landmarks.right_shoulder?.clone().sub(landmarks.right_hip), landmarks.right_knee?.clone().sub(landmarks.right_hip)),
  }
  const load = {
    upper: normalized(average([jointAngles.leftShoulder, jointAngles.rightShoulder]) / 180),
    elbow: normalized(1 - average([jointAngles.leftElbow, jointAngles.rightElbow]) / 180),
    knee: normalized(1 - average([jointAngles.leftKnee, jointAngles.rightKnee]) / 180),
    hip: normalized(1 - average([jointAngles.leftHip, jointAngles.rightHip]) / 180),
    stability: normalized(Math.abs((orientations.shoulder.roll || 0)) / 45 + Math.abs((orientations.pelvis.roll || 0)) / 90),
  }
  const velocity = normalized((angularVelocity3d.shoulder.magnitude + angularVelocity3d.pelvis.magnitude) / 720)
  const activation = {
    deltoids: activationFrom(load.upper, velocity, load.upper),
    biceps: activationFrom(load.elbow, velocity, load.elbow),
    triceps: activationFrom(1 - load.elbow, velocity, load.elbow),
    trapezius: activationFrom(load.upper, velocity, load.stability),
    quadriceps: activationFrom(load.knee, velocity, load.knee),
    hamstrings: activationFrom(1 - load.knee, velocity, load.knee),
    glutes: activationFrom(load.hip, velocity, load.stability),
    calves: activationFrom(load.knee, velocity, load.stability),
    core: activationFrom(load.stability, velocity, load.hip),
  }
  return {
    timestamp,
    landmarks,
    jointAngles: Object.fromEntries(Object.entries(jointAngles).map(([key, value]) => [key, value === null ? null : Math.round(value)])),
    orientations,
    angularVelocity: angularVelocity3d,
    load,
    activation,
    rom: {
      frontal: Math.round(average([orientations.shoulder.roll, orientations.pelvis.roll])),
      lateral: Math.round(average([orientations.shoulder.pitch, orientations.pelvis.pitch])),
      rotational: Math.round(average([orientations.shoulder.yaw, orientations.pelvis.yaw])),
    },
  }
}

export function heatmapColor(engagement = 0) {
  const value = normalized(engagement / 100)
  const cool = new THREE.Color('#1454a0')
  const cyan = new THREE.Color('#22d3ee')
  const amber = new THREE.Color('#ffbd5c')
  return value < 0.58
    ? cool.lerp(cyan, value / 0.58)
    : cyan.lerp(amber, (value - 0.58) / 0.42)
}

export function updateMuscleHeatmapMaterial(material, engagement = 0) {
  if (!material) return
  const color = heatmapColor(engagement)
  material.color.copy(color)
  material.emissive.copy(color)
  material.emissiveIntensity = 0.25 + normalized(engagement / 100) * 1.25
  material.userData.muscleEngagement = engagement
}

