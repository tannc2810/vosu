import { Innertube, UniversalCache } from 'youtubei.js';
async function run() {
  const yt = await Innertube.create({ cache: new UniversalCache(false) });
  const pl = await yt.getPlaylist('PL5KZ1PMr59kYRj80i8bI4lC1WXqtqTeUI');
  console.log(JSON.stringify(pl.items[0], null, 2));
}
run();
