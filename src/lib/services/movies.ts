const API_BASE = '/api/movies';

export interface Movie {
  id?: string;
  imdbId: string;
  title: string;
  poster?: string;
  type?: string;
  year?: string;
  savedAt?: string;
}

export async function lookupMovieByImdbId(imdbId: string): Promise<Movie> {
  const res = await fetch(`${API_BASE}/${imdbId}`);
  if (!res.ok) throw new Error('Movie/show not found');
  return res.json();
}

export async function lookupMovieByTitle(title: string): Promise<Movie> {
  const res = await fetch(`${API_BASE}/title/${encodeURIComponent(title)}`);
  if (!res.ok) throw new Error('Movie/show not found');
  return res.json();
}

export async function saveMovie({ userId, imdbId, title, poster, type, year }: { userId: string, imdbId: string, title: string, poster?: string, type?: string, year?: string }): Promise<any> {
  const res = await fetch(`${API_BASE}/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, imdbId, title, poster, type, year })
  });
  if (!res.ok) throw new Error((await res.json()).error || 'Failed to save movie/show');
  return res.json();
}

export async function getUserMovies(userId: string): Promise<{ movies: Movie[] }> {
  const res = await fetch(`${API_BASE}/user/${userId}`);
  if (!res.ok) throw new Error('Failed to fetch movies/shows');
  return res.json();
}

export async function deleteMovie(airtableId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/${airtableId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error((await res.json()).error || 'Failed to delete movie/show');
  return res.json();
} 