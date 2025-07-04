<script lang="ts">
  import { onMount } from 'svelte';
  export let userId: string;
  let search = '';
  let loading = false;
  let error = '';
  let book: any = null;
  let saving = false;
  let saveStatus = '';

  async function searchBook() {
    error = '';
    book = null;
    saveStatus = '';
    if (!search) return;
    loading = true;
    try {
      let res;
      if (/^\d{9,13}$/.test(search.replace(/-/g, ''))) {
        // Looks like ISBN
        res = await fetch(`/api/books/${encodeURIComponent(search)}`);
      } else {
        res = await fetch(`/api/books/title/${encodeURIComponent(search)}`);
      }
      if (!res.ok) throw new Error((await res.json()).error || 'Book not found');
      book = await res.json();
    } catch (e: unknown) {
      error = (e as Error).message;
    } finally {
      loading = false;
    }
  }

  async function saveBook() {
    if (!userId || !book) return;
    saving = true;
    saveStatus = '';
    error = '';
    try {
      const res = await fetch('/api/books/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          isbn: book.isbn,
          title: book.title,
          cover: book.cover
        })
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to save book');
      saveStatus = 'Saved!';
    } catch (e: unknown) {
      error = (e as Error).message;
    } finally {
      saving = false;
    }
  }
</script>

<div class="book-search">
  <input type="text" bind:value={search} placeholder="Enter ISBN or Title" on:keydown={(e) => e.key === 'Enter' && searchBook()} />
  <button on:click={searchBook} disabled={!search || loading}>Search</button>
  {#if loading}
    <div>Loading...</div>
  {/if}
  {#if error}
    <div class="error">{error}</div>
  {/if}
  {#if book}
    <div class="result">
      {#if book.cover}
        <img src={book.cover} alt={book.title} width="100" />
      {/if}
      <div><strong>{book.title}</strong></div>
      <button on:click={saveBook} disabled={saving}>{saving ? 'Saving...' : 'Save to Library'}</button>
      {#if saveStatus}
        <span class="save-status">{saveStatus}</span>
      {/if}
    </div>
  {/if}
</div>

<style>
.book-search { margin: 1em 0; }
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