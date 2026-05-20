import { Innertube, UniversalCache } from 'youtubei.js';
async function run() {
  const yt = await Innertube.create({ cache: new UniversalCache(false) });
  const pl = await yt.getPlaylist('PL5KZ1PMr59kZgJmo8uioZp5FLwJ7i1Dg5');
  console.log(pl.items.length);
  if (pl.items.length > 0) {
     console.log(JSON.stringify(pl.items[0], null, 2));
  }
}
run();
