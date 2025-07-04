<script lang="ts">
  import { onMount } from 'svelte';
  import { getUserMovies, deleteMovie } from '../services/movies';
  import type { Movie } from '../services/movies';
  export let userId: string;
  export let movieReloadKey: number;
  let movies: Movie[] = [];
  let loading = false;
  let error: string = '';
  let reloadKey = 0;

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

  async function load() {
    if (!userId) return;
    loading = true;
    error = '';
    try {
      const res = await fetch(`/api/movies/user/${userId}`);
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to fetch movies/shows');
      const data = await res.json();
      movies = data.movies || [];
    } catch (e: unknown) {
      error = (e as Error).message;
    } finally {
      loading = false;
    }
  }

  async function remove(id: string | undefined) {
    if (!id) return;
    if (!confirm('Delete this movie/show?')) return;
    try {
      await deleteMovie(id);
      movies = movies.filter(m => m.id !== id);
    } catch (e: unknown) {
      error = (e as Error).message;
    }
  }

  function handleMovieSaved() {
    reloadKey += 1;
    load();
  }

  async function fetchReviews(movieId: string) {
    loadingReviews[movieId] = true;
    try {
      const res = await fetch(`/api/reviews/${movieId}`);
      if (!res.ok) {
        reviews[movieId] = [];
        return;
      }
      const data = await res.json();
      reviews[movieId] = data.reviews;
    } finally {
      loadingReviews[movieId] = false;
    }
  }

  async function submitReview(movieId: string) {
    if (!newReviewText[movieId]?.trim() || !userId) return;
    reviewStatus[movieId] = '';
    try {
      const res = await fetch(`/api/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookId: movieId, // API expects bookId, reuse for movies
          userId,
          reviewText: newReviewText[movieId],
          rating: newReviewRating[movieId]
        })
      });
      if (!res.ok) {
        const data = await res.json();
        reviewStatus[movieId] = data.error || 'Failed to submit review.';
        return;
      }
      newReviewText[movieId] = '';
      newReviewRating[movieId] = null;
      reviewStatus[movieId] = 'Review submitted!';
      fetchReviews(movieId);
    } catch (e) {
      reviewStatus[movieId] = 'Failed to submit review.';
    }
  }

  async function deleteReview(reviewId: string, movieId: string) {
    if (!confirm('Are you sure you want to delete this review?')) return;
    try {
      const res = await fetch(`/api/reviews/${reviewId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Failed to delete review.');
        return;
      }
      fetchReviews(movieId);
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

  function handleDeleteReview(reviewId: string, movieId: string | undefined) {
    if (movieId) deleteReview(reviewId, movieId);
  }

  $: if (userId || movieReloadKey) load();
  onMount(load);
</script>

<div class="movie-library">
  <h3>Your Movies/Shows</h3>
  {#if loading}
    <div>Loading...</div>
  {:else if error}
    <div class="error">{error}</div>
  {:else if movies.length === 0}
    <div>No movies/shows saved.</div>
  {:else}
    <ul>
      {#each movies as movie}
        <li>
          <img src={movie.poster} alt={movie.title} width="60" />
          <span><strong>{movie.title}</strong> <strong>({movie.year})</strong></span>
          <span class="saved-at">{movie.savedAt ? `(Saved: ${new Date(movie.savedAt).toLocaleDateString()})` : ''}</span>
          {#if movie.id}
            <button on:click={() => remove(movie.id)}>Delete</button>
            <button on:click={() => {
              if (!movie.id) return;
              showReviewSection[movie.id] = !showReviewSection[movie.id];
              if (showReviewSection[movie.id] && !reviews[movie.id]) fetchReviews(movie.id);
            }}>
              {showReviewSection[movie.id] ? 'Hide Reviews' : 'Reviews'}
            </button>
            {#if showReviewSection[movie.id]}
              <div class="review-section">
                <h5>Reviews</h5>
                {#if loadingReviews[movie.id]}
                  <p>Loading reviews...</p>
                {:else if !reviews[movie.id] || reviews[movie.id].length === 0}
                  <p>No reviews yet.</p>
                {:else}
                  <ul class="review-list">
                    {#each movie.id ? reviews[movie.id] : [] as r}
                      <li>
                        <div class="review-meta">
                          <span class="review-rating">{r.rating ? `Rating: ${r.rating}/5` : ''}</span>
                          <span class="review-date">{formatDate(r.createdAt)}</span>
                          {#if r.userId === userId && movie.id}
                            <button 
                              class="delete-review-btn" 
                              on:click={() => handleDeleteReview(r.id, movie.id)}
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
                  <textarea placeholder="Write your review..." bind:value={newReviewText[movie.id]}></textarea>
                  <select bind:value={newReviewRating[movie.id]}>
                    <option value="">Rating (optional)</option>
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                    <option value="4">4</option>
                    <option value="5">5</option>
                  </select>
                  <button on:click={() => movie.id && submitReview(movie.id)} disabled={!movie.id || !newReviewText[movie.id]?.trim()}>Submit Review</button>
                  {#if movie.id && reviewStatus[movie.id]}
                    <span class="review-status">{reviewStatus[movie.id]}</span>
                  {/if}
                </div>
              </div>
            {/if}
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
.movie-library ul { list-style: none; padding: 0; }
.movie-library li { display: flex; align-items: center; gap: 1em; margin-bottom: 0.5em; }
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
</style>