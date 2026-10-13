// Studio Bam — Van Gogh, 15 s portrait, 96 BPM (8 beats per shot)
window.FILM_SIZE = [1080, 1920];
window.PUNCH = 0;
window.SCENE_LIBS = ['scenes/studio_lib.js', 'scenes/vg_common.js'];
window.ERAS = [
  { id: 'vg_sketch', dur: 5 },
  { id: 'vg_grow', dur: 5, transition: { type: 'cut', dur: 0.01 } },
  { id: 'vg_home', dur: 5, transition: { type: 'cut', dur: 0.01 } },
];
