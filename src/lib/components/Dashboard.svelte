<script lang="ts">
  import { user, logout } from '../stores/auth';
  type Book = {
    isbn: string;
    title: string;
    cover: string | null;
    airtableId: string;
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

  // --- Review System ---
  type Review = {
    id: string;
    userId: string;
    reviewText: string;
    rating?: number;
    createdAt: string;
  };
  let reviews: Record<string, Review[]> = {};
  let newReviewText: Record<string, string> = {};
  let newReviewRating: Record<string, number | null> = {};
  let reviewStatus: Record<string, string> = {};
  let loadingReviews: Record<string, boolean> = {};
  let showReviewSection: Record<string, boolean> = {};

  // Add API base URL from Vite env
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

  async function deleteBook(id: string) {
    if (!confirm('Are you sure you want to delete this book?')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/books/${id}`, {
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
      let res = await fetch(`${API_BASE_URL}/api/books/${isbn}`);
      if (!res.ok) {
        // Try title lookup if ISBN lookup fails
        res = await fetch(`${API_BASE_URL}/api/books/title/${encodeURIComponent(isbn)}`);
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
      const res = await fetch(`${API_BASE_URL}/api/books/save`, {
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
      const res = await fetch(`${API_BASE_URL}/api/books/user/${$user.id}`);
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

  async function fetchReviews(bookId: string) {
    loadingReviews[bookId] = true;
    try {
      const res = await fetch(`${API_BASE_URL}/api/reviews/${bookId}`);
      if (!res.ok) {
        reviews[bookId] = [];
        return;
      }
      const data = await res.json();
      reviews[bookId] = data.reviews;
    } finally {
      loadingReviews[bookId] = false;
    }
  }

  async function submitReview(bookId: string) {
    if (!newReviewText[bookId]?.trim() || !$user?.id) return;
    reviewStatus[bookId] = '';
    try {
      const res = await fetch(`${API_BASE_URL}/api/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookId,
          userId: $user.id,
          reviewText: newReviewText[bookId],
          rating: newReviewRating[bookId]
        })
      });
      if (!res.ok) {
        const data = await res.json();
        reviewStatus[bookId] = data.error || 'Failed to submit review.';
        return;
      }
      newReviewText[bookId] = '';
      newReviewRating[bookId] = null;
      reviewStatus[bookId] = 'Review submitted!';
      fetchReviews(bookId);
    } catch (e) {
      reviewStatus[bookId] = 'Failed to submit review.';
    }
  }

  import { onMount } from 'svelte';

  onMount(() => {
    fetchSavedBooks();
  });


  $: if ($user?.id) {
    fetchSavedBooks();
  }

  $: if (book && book.airtableId) {
    fetchReviews(book.airtableId);
  }
</script>

<div class="dashboard">
  <div class="dashboard-header">
    <div class="welcome-section">
      <h1>Welcome back, {$user?.name}!</h1>
    </div>
    <button class="logout-btn" on:click={handleLogout}>
      Sign Out
    </button>
  </div>

  <div class="dashboard-content">

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
            <!-- Review Section -->
            {#if book && book.airtableId}
              <div class="review-section">
                <h5>Reviews</h5>
                {#if loadingReviews[book.airtableId]}
                  <p>Loading reviews...</p>
                {:else if !reviews[book.airtableId] || reviews[book.airtableId].length === 0}
                  <p>No reviews yet.</p>
                {:else}
                  <ul class="review-list">
                    {#each reviews[book.airtableId] as r}
                      <li>
                        <div class="review-meta">
                          <span class="review-rating">{r.rating ? `Rating: ${r.rating}/5` : ''}</span>
                          <span class="review-date">{formatDate(r.createdAt)}</span>
                        </div>
                        <div class="review-text">{r.reviewText}</div>
                      </li>
                    {/each}
                  </ul>
                {/if}
                {#if $user?.id}
                  <div class="review-form">
                    <textarea placeholder="Write your review..." bind:value={newReviewText[book.airtableId]}></textarea>
                    <select bind:value={newReviewRating[book.airtableId]}>
                      <option value="">Rating (optional)</option>
                      <option value="1">1</option>
                      <option value="2">2</option>
                      <option value="3">3</option>
                      <option value="4">4</option>
                      <option value="5">5</option>
                    </select>
                    <button on:click={() => submitReview(book.airtableId)} disabled={!newReviewText[book.airtableId]?.trim()}>Submit Review</button>
                    {#if reviewStatus[book.airtableId]}
                      <span class="review-status">{reviewStatus[book.airtableId]}</span>
                    {/if}
                  </div>
                {/if}
              </div>
            {/if}
            <!-- End Review Section -->
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
                <button class="review-btn" on:click={() => {
                  showReviewSection[b.id] = !showReviewSection[b.id];
                  if (showReviewSection[b.id] && !reviews[b.id]) fetchReviews(b.id);
                }}>
                  {showReviewSection[b.id] ? 'Hide Reviews' : 'Reviews'}
                </button>
                {#if showReviewSection[b.id]}
                  <div class="review-section">
                    <h5>Reviews</h5>
                    {#if loadingReviews[b.id]}
                      <p>Loading reviews...</p>
                    {:else if !reviews[b.id] || reviews[b.id].length === 0}
                      <p>No reviews yet.</p>
                    {:else}
                      <ul class="review-list">
                        {#each reviews[b.id] as r}
                          <li>
                            <div class="review-meta">
                              <span class="review-rating">{r.rating ? `Rating: ${r.rating}/5` : ''}</span>
                              <span class="review-date">{formatDate(r.createdAt)}</span>
                            </div>
                            <div class="review-text">{r.reviewText}</div>
                          </li>
                        {/each}
                      </ul>
                    {/if}
                    {#if $user?.id}
                      <div class="review-form">
                        <textarea placeholder="Write your review..." bind:value={newReviewText[b.id]}></textarea>
                        <select bind:value={newReviewRating[b.id]}>
                          <option value="">Rating (optional)</option>
                          <option value="1">1</option>
                          <option value="2">2</option>
                          <option value="3">3</option>
                          <option value="4">4</option>
                          <option value="5">5</option>
                        </select>
                        <button on:click={() => submitReview(b.id)} disabled={!newReviewText[b.id]?.trim()}>Submit Review</button>
                        {#if reviewStatus[b.id]}
                          <span class="review-status">{reviewStatus[b.id]}</span>
                        {/if}
                      </div>
                    {/if}
                  </div>
                {/if}
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
    flex-direction: column;
    align-items: stretch;
    gap: 16px;
    background: #fafafa;
    border: 1px solid #eee;
    border-radius: 4px;
    padding: 10px;
    min-width: 180px;
    max-width: 240px;
    box-sizing: border-box;
  }
  .book-info {
    flex: 1 1 auto;
    width: 100%;
  }
  .review-section {
    width: 100%;
    box-sizing: border-box;
    overflow: visible;
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

  .review-section {
    margin-top: 18px;
    background: #f5f5f5;
    border-radius: 4px;
    padding: 12px;
  }
  .review-section h5 {
    margin: 0 0 8px 0;
    font-size: 16px;
  }
  .review-list {
    list-style: none;
    padding: 0;
    margin: 0 0 10px 0;
  }
  .review-list li {
    margin-bottom: 10px;
    padding-bottom: 8px;
    border-bottom: 1px solid #e0e0e0;
  }
  .review-meta {
    font-size: 13px;
    color: #888;
    display: flex;
    gap: 10px;
    margin-bottom: 2px;
  }
  .review-rating {
    color: #ff9800;
  }
  .review-text {
    font-size: 15px;
    color: #333;
  }
  .review-form {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 10px;
  }
  .review-form textarea {
    resize: vertical;
    min-height: 40px;
    font-size: 15px;
    padding: 6px;
    border-radius: 4px;
    border: 1px solid #ccc;
  }
  .review-form select {
    width: 120px;
    font-size: 15px;
    padding: 3px;
    border-radius: 4px;
    border: 1px solid #ccc;
  }
  .review-form button {
    align-self: flex-start;
    background: #1976d2;
    color: white;
    border: none;
    border-radius: 4px;
    padding: 6px 14px;
    font-size: 15px;
    cursor: pointer;
  }
  .review-status {
    margin-left: 10px;
    color: #388e3c;
    font-size: 14px;
  }
  .review-btn {
    margin-top: 8px;
    background: #1976d2;
    color: white;
    border: none;
    border-radius: 4px;
    padding: 6px 14px;
    font-size: 15px;
    cursor: pointer;
    margin-right: 8px;
  }
</style>