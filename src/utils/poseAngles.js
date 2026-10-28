import * as THREE from 'three'

export const MEDIAPIPE_POSE_INDICES = {
  nose: 0,
  left_eye_inner: 1,
  left_eye: 2,
  left_eye_outer: 3,
  right_eye_inner: 4,
  right_eye: 5,
  right_eye_outer: 6,
  left_ear: 7,
  right_ear: 8,
  mouth_left: 9,
  mouth_right: 10,
  left_shoulder: 11,
  right_shoulder: 12,
  left_elbow: 13,
  right_elbow: 14,
  left_wrist: 15,
  right_wrist: 16,
  left_pinky: 17,
  right_pinky: 18,
  left_index: 19,
  right_index: 20,
  left_thumb: 21,
  right_thumb: 22,
  left_hip: 23,
  right_hip: 24,
  left_knee: 25,
  right_knee: 26,
  left_ankle: 27,
  right_ankle: 28,
  heel_left: 29,
  heel_right: 30,
  foot_index_left: 31,
  foot_index_right: 32,
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

export function getLandmark(landmarks, nameOrIndex) {
  if (!Array.isArray(landmarks) || landmarks.length === 0) return null
  const index = typeof nameOrIndex === 'number' ? nameOrIndex : MEDIAPIPE_POSE_INDICES[nameOrIndex]
  if (index == null || index < 0 || index >= landmarks.length) return null
  return landmarks[index]
}

export function getVector(fromLandmark, toLandmark) {
  if (!fromLandmark || !toLandmark) return new THREE.Vector3()
  return new THREE.Vector3(
    (toLandmark.x ?? 0) - (fromLandmark.x ?? 0),
    (toLandmark.y ?? 0) - (fromLandmark.y ?? 0),
    (toLandmark.z ?? 0) - (fromLandmark.z ?? 0),
  )
}

export function toFiniteEuler(eulerLike) {
  if (!eulerLike) {
    return { yaw: 0, pitch: 0, roll: 0 }
  }

  return {
    yaw: Number.isFinite(eulerLike.yaw) ? eulerLike.yaw : 0,
    pitch: Number.isFinite(eulerLike.pitch) ? eulerLike.pitch : 0,
    roll: Number.isFinite(eulerLike.roll) ? eulerLike.roll : 0,
  }
}

export function localJointEuler(current, parent, child) {
  const currentPoint = current ?? parent ?? child
  const parentPoint = parent ?? currentPoint
  const childPoint = child ?? currentPoint

  if (!currentPoint || !parentPoint || !childPoint) {
    return { yaw: 0, pitch: 0, roll: 0 }
  }

  const parentVector = getVector(currentPoint, parentPoint).normalize()
  const childVector = getVector(currentPoint, childPoint).normalize()

  if (!Number.isFinite(parentVector.lengthSq()) || !Number.isFinite(childVector.lengthSq())) {
    return { yaw: 0, pitch: 0, roll: 0 }
  }

  const normal = new THREE.Vector3().crossVectors(parentVector, childVector)
  if (normal.lengthSq() < 1e-8) {
    const fallback = new THREE.Vector3(0, 1, 0)
    return {
      yaw: 0,
      pitch: Math.atan2(fallback.y, fallback.x) * 180 / Math.PI,
      roll: 0,
    }
  }

  const xAxis = new THREE.Vector3().crossVectors(normal, parentVector).normalize()
  const yAxis = parentVector.clone().normalize()
  const zAxis = new THREE.Vector3().crossVectors(yAxis, xAxis).normalize()
  const rotationMatrix = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis)
  const quaternion = new THREE.Quaternion().setFromRotationMatrix(rotationMatrix)
  const euler = new THREE.Euler().setFromQuaternion(quaternion, 'XYZ')

  return {
    yaw: THREE.MathUtils.radToDeg(euler.y),
    pitch: THREE.MathUtils.radToDeg(euler.x),
    roll: THREE.MathUtils.radToDeg(euler.z),
  }
}

export function getPoseAnglesFromLandmarks(landmarks = []) {
  if (!landmarks.length) {
    return {
      spine: { yaw: 0, pitch: 0, roll: 0 },
      hips: { yaw: 0, pitch: 0, roll: 0 },
      leftShoulder: { yaw: 0, pitch: 0, roll: 0 },
      rightShoulder: { yaw: 0, pitch: 0, roll: 0 },
      leftElbow: { yaw: 0, pitch: 0, roll: 0 },
      rightElbow: { yaw: 0, pitch: 0, roll: 0 },
    }
  }

  const leftShoulder = getLandmark(landmarks, 'left_shoulder')
  const rightShoulder = getLandmark(landmarks, 'right_shoulder')
  const leftElbow = getLandmark(landmarks, 'left_elbow')
  const rightElbow = getLandmark(landmarks, 'right_elbow')
  const leftWrist = getLandmark(landmarks, 'left_wrist')
  const rightWrist = getLandmark(landmarks, 'right_wrist')
  const leftHip = getLandmark(landmarks, 'left_hip')
  const rightHip = getLandmark(landmarks, 'right_hip')
  const leftKnee = getLandmark(landmarks, 'left_knee')
  const rightKnee = getLandmark(landmarks, 'right_knee')
  const nose = getLandmark(landmarks, 'nose')

  const midShoulder = new THREE.Vector3(
    ((leftShoulder?.x ?? 0) + (rightShoulder?.x ?? 0)) / 2,
    ((leftShoulder?.y ?? 0) + (rightShoulder?.y ?? 0)) / 2,
    ((leftShoulder?.z ?? 0) + (rightShoulder?.z ?? 0)) / 2,
  )

  const midHip = new THREE.Vector3(
    ((leftHip?.x ?? 0) + (rightHip?.x ?? 0)) / 2,
    ((leftHip?.y ?? 0) + (rightHip?.y ?? 0)) / 2,
    ((leftHip?.z ?? 0) + (rightHip?.z ?? 0)) / 2,
  )

  return {
    spine: localJointEuler(midShoulder, midHip, nose ?? midShoulder),
    hips: localJointEuler(midHip, leftHip ?? midHip, rightHip ?? midHip),
    leftShoulder: localJointEuler(leftShoulder, leftHip ?? leftShoulder, leftElbow ?? leftShoulder),
    rightShoulder: localJointEuler(rightShoulder, rightHip ?? rightShoulder, rightElbow ?? rightShoulder),
    leftElbow: localJointEuler(leftElbow, leftShoulder ?? leftElbow, leftWrist ?? leftElbow),
    rightElbow: localJointEuler(rightElbow, rightShoulder ?? rightElbow, rightWrist ?? rightElbow),
    leftHip: localJointEuler(leftHip, midHip, leftKnee ?? leftHip),
    rightHip: localJointEuler(rightHip, midHip, rightKnee ?? rightHip),
  }
}

export function smoothPoseAngles(previous = {}, target = {}, smoothing = 0.18) {
  const next = {}
  const keys = Object.keys(target)

  keys.forEach((key) => {
    const previousValue = previous[key] || { yaw: 0, pitch: 0, roll: 0 }
    const nextValue = toFiniteEuler(target[key])
    next[key] = {
      yaw: THREE.MathUtils.lerp(previousValue.yaw ?? 0, nextValue.yaw ?? 0, smoothing),
      pitch: THREE.MathUtils.lerp(previousValue.pitch ?? 0, nextValue.pitch ?? 0, smoothing),
      roll: THREE.MathUtils.lerp(previousValue.roll ?? 0, nextValue.roll ?? 0, smoothing),
    }
  })

  return next
}

export function mapLandmarksToPose(landmarks, previousAngles = {}, smoothing = 0.22) {
  const target = getPoseAnglesFromLandmarks(landmarks)
  return smoothPoseAngles(previousAngles, target, smoothing)
}
