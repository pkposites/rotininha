// Gravações reais de natureza (CC0, Freesound), servidas junto do app. Os sons sintetizados continuam em sounds.js.
import { SOUNDS } from './sounds.js';

export const NATURE = [
  { id: 'riacho', name: 'Riacho', icon: '💧', desc: 'Água corrente, em um ritmo contínuo.', file: '/audio/riacho.mp3', credit: 'gluckose', url: 'https://freesound.org/people/gluckose/sounds/333987/' },
  { id: 'vento', name: 'Vento', icon: '🍃', desc: 'Vento suave para um ambiente mais tranquilo.', file: '/audio/vento.mp3', credit: 'felix.blume', url: 'https://freesound.org/people/felix.blume/sounds/217506/' },
  { id: 'passaros', name: 'Pássaros', icon: '🐦', desc: 'Sons de natureza para experimentar com calma.', file: '/audio/passaros.mp3', credit: 'kvgarlic', url: 'https://freesound.org/people/kvgarlic/sounds/156826/' }
];
export const ALL_SOUNDS = [...NATURE, ...SOUNDS];
