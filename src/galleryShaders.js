// A short, directional wake follows the pointer. No concentric ripple oscillator.
export const TRAIL_LENGTH = 20

export const galleryVertexShader = `
  varying vec2 vUv;
  uniform float bend;
  void main() {
    vUv = uv;
    vec3 p = position;
    p.z += sin(uv.x * 3.14159265) * bend;
    p.y += sin(uv.x * 3.14159265) * bend * .00022;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.);
  }
`

export const galleryFragmentShader = `
  uniform sampler2D map;
  uniform float imageAspect;
  uniform float cardAspect;
  uniform vec4 trail[${TRAIL_LENGTH}];
  uniform vec2 life[${TRAIL_LENGTH}];
  varying vec2 vUv;

  void main() {
    vec2 aspect = vec2(cardAspect, 1.);
    vec2 point = vUv * aspect;
    vec2 flow = vec2(0.);
    float sheen = 0.;
    for (int i = 0; i < ${TRAIL_LENGTH}; i++) {
      float age = life[i].x;
      float strength = life[i].y;
      float fade = pow(max(0., 1. - age / 1.35), 2.);
      vec2 a = trail[i].xy * aspect;
      vec2 b = trail[i].zw * aspect;
      vec2 segment = b - a;
      float lengthSq = dot(segment, segment);
      vec2 direction = segment / max(sqrt(lengthSq), .0001);
      vec2 normal = vec2(-direction.y, direction.x);
      // The wake drifts along the gesture while diffusing and fading.
      vec2 drift = direction * age * .018;
      float t = clamp(dot(point - drift - a, segment) / max(lengthSq, .00001), 0., 1.);
      vec2 delta = point - drift - mix(a, b, t);
      float width = .014 + age * .019;
      float envelope = exp(-dot(delta, delta) / (width * width));
      float across = dot(delta, normal) / width;
      // Fine parallel streaks bend straight image lines into a fluid brush stroke.
      float streak = sin(across * 4. - age * 2.) * exp(-abs(across));
      float weight = envelope * fade * strength;
      flow += (direction * .026 + normal * streak * .012) * weight;
      sheen += streak * weight * .008;
    }
    flow /= 1. + length(flow) * 14.;
    vec2 uv = vUv - flow / aspect;
    if (imageAspect > cardAspect) uv.x = (uv.x - .5) * cardAspect / imageAspect + .5;
    else uv.y = (uv.y - .5) * imageAspect / cardAspect + .5;
    gl_FragColor = texture2D(map, clamp(uv, .001, .999));
    gl_FragColor.rgb += clamp(sheen, -.025, .025);
    // Rounded silhouette in aspect-correct coordinates, independent of the wake.
    float radius = .055;
    vec2 corner = abs((vUv - .5) * aspect) - (aspect * .5 - radius);
    float edge = length(max(corner, 0.)) + min(max(corner.x, corner.y), 0.) - radius;
    float coverage = 1. - smoothstep(-.002, .002, edge);
    gl_FragColor.rgb = mix(vec3(1.), gl_FragColor.rgb, coverage);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`
