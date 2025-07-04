<script lang="ts">
  import { onMount } from 'svelte';
  export let userId: string;
  let books: any[] = [];
  let loading = false;
  let error = '';

  // Review system state
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
  let modalBook: any = null;

  async function load() {
    if (!userId) return;
    loading = true;
    error = '';
    try {
      const res = await fetch(`/api/books/user/${userId}`);
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to fetch books');
      const data = await res.json();
      books = data.books || [];
    } catch (e: unknown) {
      error = (e as Error).message;
    } finally {
      loading = false;
    }
  }

  async function remove(id: string | undefined) {
    if (!id) return;
    if (!confirm('Delete this book?')) return;
    try {
      const res = await fetch(`/api/books/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to delete book');
      books = books.filter(b => b.id !== id);
    } catch (e: unknown) {
      error = (e as Error).message;
    }
  }

  // --- Review System ---
  async function fetchReviews(bookId: string) {
    loadingReviews[bookId] = true;
    try {
      const res = await fetch(`/api/reviews/${bookId}`);
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
    if (!newReviewText[bookId]?.trim() || !userId) return;
    reviewStatus[bookId] = '';
    try {
      const res = await fetch(`/api/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookId,
          userId,
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

  async function deleteReview(reviewId: string, bookId: string) {
    if (!confirm('Are you sure you want to delete this review?')) return;
    try {
      const res = await fetch(`/api/reviews/${reviewId}`, {
        method: 'DELETE'
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Failed to delete review.');
        return;
      }
      fetchReviews(bookId);
    } catch (e) {
      alert('Failed to delete review.');
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

  $: if (userId) load();
  onMount(load);
</script>

<div class="book-library">
  <h3>Your Saved Books</h3>
  {#if loading}
    <div>Loading...</div>
  {:else if error}
    <div class="error">{error}</div>
  {:else if books.length === 0}
    <div>No books saved.</div>
  {:else}
    <ul>
      {#each books as book}
        <li>
          {#if book.cover}
            <img src={book.cover} alt={book.title} width="60" />
          {/if}
          <span><strong>{book.title}</strong></span>
          <span class="saved-at">{book.savedAt ? `(Saved: ${new Date(book.savedAt).toLocaleDateString()})` : ''}</span>
          {#if book.id}
            <button on:click={() => remove(book.id)}>Delete</button>
            <button on:click={() => {
              modalBook = book;
              if (!reviews[book.id]) fetchReviews(book.id);
            }}>
              Reviews
            </button>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</div>

{#if modalBook}
  <div class="modal-backdrop" on:click={() => modalBook = null}></div>
  <div class="modal-overlay">
    <div class="modal-content" on:click|stopPropagation>
      <button class="close-modal" on:click={() => modalBook = null} aria-label="Close">
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          <line x1="9" y1="9" x2="19" y2="19" stroke="#111" stroke-width="2.5" stroke-linecap="round"/>
          <line x1="19" y1="9" x2="9" y2="19" stroke="#111" stroke-width="2.5" stroke-linecap="round"/>
        </svg>
      </button>
      <h3>Reviews for {modalBook.title}</h3>
      {#if loadingReviews[modalBook.id]}
        <p>Loading reviews...</p>
      {:else if !reviews[modalBook.id] || reviews[modalBook.id].length === 0}
        <p>No reviews yet.</p>
      {:else}
        <ul class="review-list">
          {#each reviews[modalBook.id] as r}
            <li>
              <div class="review-meta">
                <span class="review-rating">{r.rating ? `Rating: ${r.rating}/5` : ''}</span>
                <span class="review-date">{formatDate(r.createdAt)}</span>
                {#if r.userId === userId}
                  <button 
                    class="delete-review-btn" 
                    on:click={() => deleteReview(r.id, modalBook.id)}
                    title="Delete this review"
                  >
                    ×
                  </button>
                {/if}
              </div>
              <div class="review-text">{r.reviewText}</div>
            </li>
          {/each}
        </ul>
      {/if}
      <div class="review-form">
        <textarea placeholder="Write your review..." bind:value={newReviewText[modalBook.id]}></textarea>
        <select bind:value={newReviewRating[modalBook.id]}>
          <option value="">Rating (optional)</option>
          <option value="1">1</option>
          <option value="2">2</option>
          <option value="3">3</option>
          <option value="4">4</option>
          <option value="5">5</option>
        </select>
        <button on:click={() => submitReview(modalBook.id)} disabled={!newReviewText[modalBook.id]?.trim()}>Submit Review</button>
        {#if reviewStatus[modalBook.id]}
          <span class="review-status">{reviewStatus[modalBook.id]}</span>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
.book-library ul { list-style: none; padding: 0; }
.book-library li { display: flex; align-items: center; gap: 1em; margin-bottom: 0.5em; }
.error { color: red; }
.saved-at { color: #888; font-size: 0.9em; margin-left: 0.5em; }
.review-section { margin-top: 18px; background: #e9f0fa; border-radius: 8px; padding: 14px 12px; box-shadow: 0 1px 4px rgba(60,60,120,0.04); width: 100%; box-sizing: border-box; overflow: visible; animation: fadeIn 0.4s; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
.review-section h5 { margin: 0 0 8px 0; font-size: 17px; font-weight: 600; color: #22223b; }
.review-list { list-style: none; padding: 0; margin: 0 0 10px 0; }
.review-list li { margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid #dbeafe; background: #f5faff; border-radius: 4px; padding-left: 6px; padding-right: 6px; transition: background 0.2s; }
.review-list li:hover { background: #e3e7ef; }
.review-meta { font-size: 13px; color: #888; display: flex; gap: 10px; margin-bottom: 2px; align-items: center; }
.review-rating { color: #ff9800; font-weight: 600; }
.review-date { color: #6c757d; }
.review-text { font-size: 15px; color: #333; margin-top: 2px; }
.review-form { display: flex; flex-direction: column; gap: 7px; margin-top: 10px; background: #f7f9fc; border-radius: 6px; padding: 8px 6px; }
.review-form textarea { resize: vertical; min-height: 40px; font-size: 15px; padding: 7px; border-radius: 4px; border: 1.5px solid #bfc9e0; background: #f6f8fa; transition: border 0.2s; }
.review-form textarea:focus { border: 1.5px solid #1976d2; outline: none; }
.review-form select { width: 130px; font-size: 15px; padding: 4px; border-radius: 4px; border: 1.5px solid #bfc9e0; background: #f6f8fa; transition: border 0.2s; }
.review-form select:focus { border: 1.5px solid #1976d2; outline: none; }
.review-form button { align-self: flex-start; background: linear-gradient(90deg, #1976d2 60%, #64b5f6 100%); color: white; border: none; border-radius: 6px; padding: 7px 16px; font-size: 15px; font-weight: 600; cursor: pointer; box-shadow: 0 2px 8px rgba(25,118,210,0.08); transition: background 0.2s, transform 0.2s; }
.review-status { margin-left: 10px; color: #388e3c; font-size: 15px; font-weight: 600; }
.delete-review-btn { background: linear-gradient(90deg, #f44336 60%, #ff7961 100%); color: white; border: none; border-radius: 50%; width: 22px; height: 22px; font-size: 15px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; margin-left: auto; box-shadow: 0 2px 8px rgba(244,67,54,0.08); transition: background 0.2s, transform 0.2s; }
.delete-review-btn:hover { background: #d32f2f; transform: scale(1.1); }
.modal-backdrop {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.35);
  z-index: 1001;
}
.modal-overlay {
  position: fixed; top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  background: #fff;
  border-radius: 18px;
  box-shadow: 0 8px 32px rgba(60,60,120,0.18);
  padding: 48px 40px 36px 40px;
  z-index: 1002;
  min-width: 520px;
  max-width: 98vw;
  max-height: 96vh;
  overflow-y: auto;
}
.modal-content { position: relative; }
.close-modal {
  position: absolute;
  top: -30px;
  right: -20px;
  background: #fff;
  border: 2px solid #222;
  border-radius: 50%;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-weight: bold;
  z-index: 10;
  box-shadow: 0 2px 8px rgba(0,0,0,0.10);
  transition: background 0.2s, color 0.2s, border 0.2s;
  padding: 0;
}
.close-modal:hover {
  background: #222;
  border-color: #222;
}
.close-modal:hover svg line {
  stroke: #fff;
}
</style> 