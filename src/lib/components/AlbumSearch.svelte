<script lang="ts">
  import { user } from '../stores/auth';

  let search = '';
  let loading = false;
  let error = '';
  let album: any = null;
  let saving = false;
  let saveStatus = '';
  $: currentUser = $user;

  async function searchAlbums() {
    error = '';
    album = null;
    saveStatus = '';
    if (!search) return;
    loading = true;
    try {
      const res = await fetch(`/api/music/albums/search?album=${encodeURIComponent(search)}`);
      if (!res.ok) {
        const data = await res.json();
        error = data.error || 'Search failed';
        return;
      }
      const data = await res.json();
      album = data.albums && data.albums.length > 0 ? data.albums[0] : null;
      if (!album) error = 'No album found.';
    } catch (e) {
      error = 'Search failed';
    } finally {
      loading = false;
    }
  }

  async function saveAlbum() {
    if (!currentUser || !album) return;
    saving = true;
    saveStatus = '';
    error = '';
    try {
      const res = await fetch('/api/music/albums/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          mbid: album.mbid,
          title: album.title,
          artist: album.artist,
          cover: album.cover,
          firstReleaseDate: album.firstReleaseDate
        })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save album');
      }
      saveStatus = 'Saved!';
    } catch (e) {
      error = (e as Error).message || 'Failed to save album';
    } finally {
      saving = false;
    }
  }
</script>

<div class="album-search">
  <input type="text" bind:value={search} placeholder="Enter Album Title & Artist" on:keydown={(e) => e.key === 'Enter' && searchAlbums()} />
  <button on:click={searchAlbums} disabled={!search || loading}>Search</button>
  {#if loading}
    <div>Loading...</div>
  {/if}
  {#if error}
    <div class="error">{error}</div>
  {/if}
  {#if album}
    <div class="result">
      {#if album.cover}
        <img src={album.cover} alt={album.title} width="100" />
      {/if}
      <div>
        <div><strong>{album.title}</strong></div>
        <div>{album.artist}</div>
        <div>{album.firstReleaseDate}</div>
        <button on:click={saveAlbum} disabled={saving}>{saving ? 'Saving...' : 'Save to Library'}</button>
        {#if saveStatus}
          <span class="save-status">{saveStatus}</span>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
.album-search { margin: 1em 0; }
.result {
  margin-top: 1em;
  display: flex;
  align-items: center;
  gap: 1em;
  background: #fff;
  border: 2px solid #1976d2;
  border-radius: 14px;
  box-shadow: 0 8px 32px rgba(60,60,120,0.18);
  padding: 18px 24px;
  opacity: 1;
  z-index: 1003;
}
.error { color: red; margin-top: 0.5em; }
.save-status { color: green; margin-left: 1em; }
</style> 