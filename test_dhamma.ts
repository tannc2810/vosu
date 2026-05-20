import { Innertube, UniversalCache } from 'youtubei.js';

async function run() {
  const yt = await Innertube.create({ cache: new UniversalCache(false) });
  const channel = await yt.getChannel('UClxiXO5JjB3k5y3-4OtAzug');
  const playlistsData = await channel.getPlaylists();
  
  const pList = playlistsData.playlists.filter((p: any) => p.type === 'GridPlaylist' || p.type === 'LockupView' || p.type === 'Playlist' || p.content_type === 'PLAYLIST');
  console.log('Total playlists matching type/content_type:', pList.length);
  pList.forEach((p:any) => console.log(' -', p.title?.text || p.metadata?.title?.text, p.content_id));
}
run();
