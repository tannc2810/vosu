async function run() {
  const res = await fetch('http://localhost:3000/api/data');
  const data = await res.json();
  const pl1 = data.playlists.find(p => p.title.includes('Phật Dạy Gì Về'));
  const pl2 = data.playlists.find(p => p.title.includes('Kinh Pháp Cú - Dha'));
  console.log(`PL1 videos:`, pl1?.videos?.length);
  console.log(`PL2 videos:`, pl2?.videos?.length);
}
run();
