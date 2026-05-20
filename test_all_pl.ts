import { Innertube, UniversalCache } from 'youtubei.js';

async function run() {
  const yt = await Innertube.create({ cache: new UniversalCache(false) });
  const channel = await yt.getChannel('UClxiXO5JjB3k5y3-4OtAzug');
  const playlistsData = await channel.getPlaylists();
  
  const pList = playlistsData.playlists.filter((p: any) => p.content_type === 'PLAYLIST');
  
  for (const p of pList) {
     const plId = p.content_id;
     try {
       const pl = await yt.getPlaylist(plId);
       console.log(`Playlist ${p.metadata?.title?.text} has ${pl.items.length} items`);
     } catch(e) {
       console.error(`Failed ${p.metadata?.title?.text}:`, e.message);
     }
  }
}
run();
