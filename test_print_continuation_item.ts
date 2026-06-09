import { Innertube, UniversalCache } from 'youtubei.js';

async function run() {
  const yt = await Innertube.create({ cache: new UniversalCache(false) });
  
  const plId = 'PL5KZ1PMr59kaS4A7KvhYRgnc15CC4ERdS';
  const pl = await yt.getPlaylist(plId);
  
  const scanForToken = (obj: any): string | null => {
    if (!obj || typeof obj !== 'object') return null;
    if (obj.token && (obj.token.startsWith('4qmF') || obj.token.includes('VLPL'))) {
      return obj.token;
    }
    if (obj.continuationToken) {
      return obj.continuationToken;
    }
    for (const key of Object.keys(obj)) {
      const res = scanForToken(obj[key]);
      if (res) return res;
    }
    return null;
  };
  
  const token = scanForToken(pl.page_contents);
  if (token) {
    const res = await yt.actions.execute('/browse', { continuation: token });
    if (res.data.onResponseReceivedActions) {
      const firstItem = res.data.onResponseReceivedActions[0].appendContinuationItemsAction?.continuationItems?.[0];
      if (firstItem) {
        console.log('firstItem keys:', Object.keys(firstItem));
        console.log('firstItem JSON:', JSON.stringify(firstItem, null, 2).substring(0, 1500));
      }
    }
  }
}

run().catch(console.error);
