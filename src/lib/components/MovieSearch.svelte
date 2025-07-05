<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { lookupMovieByTitle, saveMovie } from '../services/movies';
  import type { Movie } from '../services/movies';
  import { onMount } from 'svelte';
  export let userId: string;
  let search = '';
  let result: Movie | null = null;
  let error: string = '';
  let saving = false;
  let saved = false;
  let resultElement: HTMLDivElement;
  const dispatch = createEventDispatcher();

  function handleClickOutside(event: MouseEvent) {
    if (result && resultElement && !resultElement.contains(event.target as Node)) {
      result = null;
      saved = false;
    }
  }

  onMount(() => {
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  });

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
    <div class="result" bind:this={resultElement}>
      <img src={result.poster} alt={result.title} width="100" />
      <div><strong>{result.title}</strong> {result.year ? `(${result.year})` : ''}</div>
      <button on:click={save} disabled={saving || saved}>{saved ? 'Saved!' : saving ? 'Saving...' : 'Save to Library'}</button>
    </div>
  {/if}
</div>

<style>
.movie-search { margin: 1em 0; }
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
</style> 