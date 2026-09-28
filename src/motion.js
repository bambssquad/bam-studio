// Analytic damped spring: identical settling at 60 Hz and 120 Hz.
export const spring = value => ({ value, velocity: 0 })
export function advanceSpring(state, target, dt, stiffness = 190, damping = 18) {
  const decay = damping / 2, frequency = Math.sqrt(stiffness - decay * decay)
  const offset = state.value - target, fade = Math.exp(-decay * dt)
  const sine = Math.sin(frequency * dt), cosine = Math.cos(frequency * dt)
  const velocity = state.velocity
  state.value = target + fade * (offset * cosine + (velocity + decay * offset) / frequency * sine)
  state.velocity = fade * (velocity * cosine - (decay * velocity + stiffness * offset) / frequency * sine)
  if (Math.abs(state.value - target) < .0001 && Math.abs(state.velocity) < .0001) { state.value = target; state.velocity = 0 }
  return state.value
}
export const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
