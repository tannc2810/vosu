async function run() {
  const res = await fetch('http://localhost:3000/api/data');
  const data = await res.json();
  const pl = data.playlists.find(p => p.title.includes('37 Phẩm'));
  if (pl) {
     console.log(`Playlist videos count: ${pl.videos.length}`);
     console.log(JSON.stringify(pl.videos, null, 2));
  }
}
run();
