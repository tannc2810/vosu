async function run() {
  const res = await fetch('http://localhost:3000/api/data');
  const data = await res.json();
  const pl = data.playlists.find(p => p.title.includes('Phật Dạy Gì Về'));
  if (pl) {
     console.log(`Playlist: ${pl.title}, ID: ${pl.id}`);
     console.log(`Videos count: ${pl.videos.length}`);
     console.log(`First video ID: ${pl.videos[0].id}`);
  }
}
run();
