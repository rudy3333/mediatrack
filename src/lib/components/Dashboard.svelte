<script lang="ts">
  import { user, logout } from '../stores/auth';
  type Book = {
    isbn: string;
    title: string;
    cover: string | null;
  };
  type SavedBook = {
    id: string;
    isbn: string;
    title: string;
    cover: string | null;
    savedAt: string;
  };
  let isbn = '';
  let book: Book | null = null;
  let bookError = '';
  let loadingBook = false;
  let saveStatus = '';
  let savingBook = false;
  let savedBooks: SavedBook[] = [];
  let loadingSavedBooks = false;
  let savedBooksError = '';

  async function deleteBook(id: string) {
  if (!confirm('Are you sure you want to delete this book?')) return;
  try {
    const res = await fetch(`/api/books/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) {
      const data = await res.json();
      savedBooksError = data.error || 'Failed to delete book.';
      return;
    }
    // remove from local state
    savedBooks = savedBooks.filter(b => b.id !== id);
  } catch (e) {
    savedBooksError = 'Failed to delete book.';
  }
}

  function handleLogout() {
    logout();
  }

  async function searchBook() {
    book = null;
    bookError = '';
    if (!isbn) {
      bookError = 'Please enter an ISBN.';
      return;
    }
    loadingBook = true;
    try {
      let res = await fetch(`/api/books/${isbn}`);
      if (!res.ok) {
        // Try title lookup if ISBN lookup fails
        res = await fetch(`/api/books/title/${encodeURIComponent(isbn)}`);
        if (!res.ok) {
          const data = await res.json();
          bookError = data.error || 'Book not found.';
          return;
        }
      }
      book = await res.json();
    } catch (e) {
      bookError = 'Failed to fetch book.';
    } finally {
      loadingBook = false;
    }
  }

  async function saveBook() {
    if (!book || !$user?.id) return;
    saveStatus = '';
    savingBook = true;
    try {
      const res = await fetch('/api/books/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: $user.id,
          isbn: book.isbn,
          title: book.title,
          cover: book.cover
        })
      });
      if (!res.ok) {
        const data = await res.json();
        saveStatus = data.error || 'Failed to save book.';
        return;
      }
      saveStatus = 'Book saved!';
    } catch (e) {
      saveStatus = 'Failed to save book.';
    } finally {
      savingBook = false;
    }
  }

  async function fetchSavedBooks() {
    if (!$user?.id) return;
    loadingSavedBooks = true;
    savedBooksError = '';
    try {
      const res = await fetch(`/api/books/user/${$user.id}`);
      if (!res.ok) {
        const data = await res.json();
        savedBooksError = data.error || 'Failed to fetch saved books.';
        return;
      }
      const data = await res.json();
      savedBooks = data.books;
    } catch (e) {
      savedBooksError = 'Failed to fetch saved books.';
    } finally {
      loadingSavedBooks = false;
    }
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  import { onMount } from 'svelte';

  onMount(() => {
    fetchSavedBooks();
  });


  $: if ($user?.id) {
    fetchSavedBooks();
  }
</script>

<div class="dashboard">
  <div class="dashboard-header">
    <div class="welcome-section">
      <h1>Welcome back, {$user?.name}!</h1>
      <p>You're successfully authenticated.</p>
    </div>
    <button class="logout-btn" on:click={handleLogout}>
      Sign Out
    </button>
  </div>

  <div class="dashboard-content">
    <div class="info-cards">
      <div class="info-card">
        <h3>Profile Information</h3>
        <p><strong>Name:</strong> {$user?.name}</p>
        <p><strong>Email:</strong> {$user?.email}</p>
        <p><strong>Member since:</strong> {$user?.createdAt ? formatDate($user.createdAt) : 'Unknown'}</p>
      </div>
    </div>

    <div class="book-search">
      <h3>Book Lookup</h3>
      <div class="book-search-form">
        <input
          type="text"
          placeholder="Enter ISBN (e.g. 9780140328721)"
          bind:value={isbn}
          on:keydown={(e) => e.key === 'Enter' && searchBook()}
          disabled={loadingBook}
        />
        <button on:click={searchBook} disabled={loadingBook}>Search</button>
      </div>
      {#if loadingBook}
        <p>Loading...</p>
      {:else if bookError}
        <p class="error">{bookError}</p>
      {:else if book}
        <div class="book-result">
          {#if book.cover}
            <img src={book.cover} alt="Book cover" class="book-cover" />
          {/if}
          <div class="book-info">
            <h4>{book.title}</h4>
            <button class="save-btn" on:click={saveBook} disabled={savingBook}>{savingBook ? 'Saving...' : 'Save'}</button>
            {#if saveStatus}
              <span class="save-status">{saveStatus}</span>
            {/if}
          </div>
        </div>
      {/if}
    </div>

    <div class="saved-books">
      <h3>My Saved Books</h3>
      {#if loadingSavedBooks}
        <p>Loading...</p>
      {:else if savedBooksError}
        <p class="error">{savedBooksError}</p>
      {:else if savedBooks.length === 0}
        <p>No books saved yet.</p>
      {:else}
        <div class="saved-books-list">
          {#each savedBooks as b}
            <div class="saved-book-card">
              {#if b.cover}
                <img src={b.cover} alt="Book cover" class="book-cover" />
              {/if}
              <div class="book-info">
                <h4>{b.title}</h4>
                <p><small>Saved: {formatDate(b.savedAt)}</small></p>
                <button class="delete-btn" on:click={() => deleteBook(b.id)}>Delete</button>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .dashboard {
    max-width: 1000px;
    margin: 0 auto;
    padding: 20px;
  }

  .dashboard-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 30px;
    background: white;
    border: 1px solid #ddd;
    border-radius: 4px;
    padding: 20px;
  }

  .welcome-section h1 {
    margin: 0 0 10px 0;
    font-size: 28px;
  }

  .welcome-section p {
    margin: 0;
    color: #666;
    font-size: 16px;
  }

  .logout-btn {
    background: #f44336;
    color: white;
    border: none;
    padding: 10px 20px;
    border-radius: 4px;
    font-size: 14px;
    font-weight: bold;
    cursor: pointer;
  }

  .logout-btn:hover {
    background: #d32f2f;
  }

  .info-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 20px;
    margin-bottom: 30px;
  }

  .info-card {
    background: white;
    border: 1px solid #ddd;
    border-radius: 4px;
    padding: 20px;
  }

  .info-card h3 {
    margin: 0 0 15px 0;
    font-size: 18px;
  }

  .info-card p {
    margin: 5px 0;
    line-height: 1.5;
  }

  .book-search {
    background: white;
    border: 1px solid #ddd;
    border-radius: 4px;
    padding: 20px;
    margin-bottom: 30px;
    max-width: 500px;
  }
  .book-search-form {
    display: flex;
    gap: 10px;
    margin-bottom: 15px;
  }
  .book-search-form input {
    flex: 1;
    padding: 8px;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-size: 16px;
  }
  .book-search-form button {
    padding: 8px 16px;
    font-size: 16px;
    border: none;
    border-radius: 4px;
    background: #1976d2;
    color: white;
    cursor: pointer;
  }
  .book-search-form button:disabled {
    background: #90caf9;
    cursor: not-allowed;
  }
  .book-result {
    display: flex;
    gap: 20px;
    align-items: flex-start;
    margin-top: 10px;
  }
  .book-cover {
    width: 75px;
    height: auto;
    border: 1px solid #eee;
    border-radius: 4px;
    box-shadow: 0 2px 6px rgba(0,0,0,0.05);
  }
  .book-info h4 {
    margin: 0 0 8px 0;
    font-size: 20px;
  }
  .book-info p {
    margin: 0 0 6px 0;
    color: #444;
  }
  .error {
    color: #d32f2f;
    font-weight: bold;
  }
  .save-btn {
    margin-top: 10px;
    background: #43a047;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 4px;
    font-size: 16px;
    cursor: pointer;
  }
  .save-btn:disabled {
    background: #a5d6a7;
    cursor: not-allowed;
  }
  .save-status {
    display: inline-block;
    margin-left: 12px;
    color: #388e3c;
    font-weight: bold;
    font-size: 15px;
  }

  .saved-books {
    background: white;
    border: 1px solid #ddd;
    border-radius: 4px;
    padding: 20px;
    margin-bottom: 30px;
    max-width: 700px;
  }
  .saved-books-list {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
  }
  .saved-book-card {
    display: flex;
    gap: 16px;
    align-items: flex-start;
    background: #fafafa;
    border: 1px solid #eee;
    border-radius: 4px;
    padding: 10px;
    min-width: 180px;
    max-width: 240px;
  }

  @media (max-width: 768px) {
    .dashboard {
      padding: 10px;
    }

    .dashboard-header {
      flex-direction: column;
      gap: 15px;
      align-items: stretch;
    }

    .welcome-section h1 {
      font-size: 24px;
    }

    .info-cards {
      grid-template-columns: 1fr;
    }
  }
</style>