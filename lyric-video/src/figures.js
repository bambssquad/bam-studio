// Two side-view paper silhouettes. variant 'a' = short hair/trousers, 'b' = long hair/skirt + red scarf (accent).
import * as THREE from 'three'
import { cut, rectShape, circleShape } from './paper.js'

const INK = '#2a2436', ACCENT = '#e2475a'

function limb(w, h, color) { // pivot at top
  const g = new THREE.Group(), m = cut(rectShape(-w / 2, -h, w, h), color, 0.02); g.add(m); return g
}

export function figure(variant = 'a', color = INK) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body)
  const legL = limb(0.065, 0.5, color), legR = limb(0.065, 0.5, color)
  legL.position.set(-0.03, 0.52, -0.012); legR.position.set(0.03, 0.52, 0.012)
  const armB = limb(0.055, 0.36, color), armF = limb(0.055, 0.36, color)
  armB.position.set(0, 0.84, -0.02); armF.position.set(0, 0.84, 0.03)
  const torso = new THREE.Shape()
  torso.moveTo(-0.1, 0.5); torso.lineTo(0.1, 0.5); torso.lineTo(0.125, 0.86); torso.quadraticCurveTo(0, 0.92, -0.125, 0.86); torso.closePath()
  body.add(cut(torso, color, 0.03), cut(circleShape(0.02, 1.0, 0.105), color, 0.03))
  const neck = cut(rectShape(-0.03, 0.85, 0.06, 0.08), color, 0.03); body.add(neck)
  if (variant === 'b') {
    const hair = new THREE.Shape(); hair.moveTo(-0.1, 1.06); hair.quadraticCurveTo(0.02, 1.16, 0.12, 1.04)
    hair.lineTo(0.05, 0.98); hair.quadraticCurveTo(-0.08, 0.86, -0.14, 0.74); hair.quadraticCurveTo(-0.16, 0.92, -0.1, 1.06)
    body.add(cut(hair, color, 0.035))
    const skirt = new THREE.Shape(); skirt.moveTo(-0.1, 0.62); skirt.lineTo(0.1, 0.62); skirt.lineTo(0.17, 0.3); skirt.lineTo(-0.17, 0.3); skirt.closePath()
    body.add(cut(skirt, color, 0.035))
    const scarf = new THREE.Shape(); scarf.moveTo(-0.08, 0.84); scarf.lineTo(0.09, 0.84); scarf.lineTo(0.08, 0.9); scarf.lineTo(-0.08, 0.9)
    scarf.lineTo(-0.2, 0.7); scarf.lineTo(-0.14, 0.68); scarf.closePath()
    const sc = cut(scarf, ACCENT, 0.02); sc.position.z = 0.032; body.add(sc)
  } else {
    const hair = new THREE.Shape(); hair.moveTo(-0.09, 1.02); hair.quadraticCurveTo(0.0, 1.17, 0.13, 1.05); hair.lineTo(0.06, 1.04); hair.lineTo(-0.1, 0.95); hair.closePath()
    body.add(cut(hair, color, 0.035))
  }
  body.add(legL, legR, armB, armF)
  root.userData = { legL, legR, armB, armF, body }
  return root
}

// walk cycle (phase in cycles); amt 0..1 blends from standing to walking
export function pose(fig, phase, amt = 1, reach = 0) {
  const { legL, legR, armB, armF, body } = fig.userData, s = Math.sin(phase * Math.PI * 2)
  legL.rotation.z = 0.42 * s * amt; legR.rotation.z = -0.42 * s * amt
  armB.rotation.z = -0.35 * s * amt; armF.rotation.z = 0.35 * s * amt + reach
  body.position.y = Math.abs(Math.cos(phase * Math.PI * 2)) * 0.025 * amt
}
