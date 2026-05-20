export interface Video {
  id: string;
  title: string;
  link: string;
  published: string;
  author: string;
  thumbnail: string;
  description?: string;
  isShort?: boolean;
}

export interface Playlist {
  id: string;
  title: string;
  videos: Video[];
}

export interface YouTubeResponse {
  playlists: Playlist[];
  allVideos: Video[];
  channelTitle?: string;
  error?: string;
}
