import { getMeta, setMeta } from './db.js';
export const getPref = async (k, d = null) => (await getMeta('pref:' + k)) ?? d;
export const setPref = (k, v) => setMeta('pref:' + k, v);
