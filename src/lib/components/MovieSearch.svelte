<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { lookupMovieByTitle, saveMovie } from '../services/movies';
  import type { Movie } from '../services/movies';
  export let userId: string;
  let search = '';
  let result: Movie | null = null;
  let error: string = '';
  let saving = false;
  let saved = false;
  const dispatch = createEventDispatcher();

  async function searchMovie() {
    error = '';
    result = null;
    saved = false;
    if (!search) return;
    try {
      const data = await lookupMovieByTitle(search);
      result = data;
    } catch (e: unknown) {
      error = (e as Error).message;
    }
  }

  async function save() {
    if (!userId || !result) return;
    saving = true;
    error = '';
    try {
      await saveMovie({
        userId,
        imdbId: result.imdbId,
        title: result.title,
        poster: result.poster,
        type: result.type,
        year: result.year
      });
      saved = true;
      dispatch('movie-saved');
    } catch (e: unknown) {
      error = (e as Error).message;
    } finally {
      saving = false;
    }
  }
</script>

<div class="movie-search">
  <input type="text" bind:value={search} placeholder="Search movie or show title..." on:keydown={(e) => e.key === 'Enter' && searchMovie()} />
  <button on:click={searchMovie} disabled={!search}>Search</button>
  {#if error}
    <div class="error">{error}</div>
  {/if}
  {#if result}
    <div class="result">
      <img src={result.poster} alt={result.title} width="100" />
      <div><strong>{result.title}</strong> {result.year ? `(${result.year})` : ''}</div>
      <button on:click={save} disabled={saving || saved}>{saved ? 'Saved!' : saving ? 'Saving...' : 'Save to Library'}</button>
    </div>
  {/if}
</div>

<style>
.movie-search { margin: 1em 0; }
.result { margin-top: 1em; display: flex; align-items: center; gap: 1em; }
.error { color: red; margin-top: 0.5em; }
</style> 