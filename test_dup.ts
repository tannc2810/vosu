async function run() {
  const res = await fetch('http://localhost:3000/api/data');
  const data = await res.json();
  data.playlists.forEach(p => console.log(p.id, p.title));
}
run();
