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
  let modalMovie: any = null;

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
          rating: newReviewRating[movieId] != null ? String(newReviewRating[movieId]) : null
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

  // Helper to safely get modalMovieId as string
  function getModalMovieId() {
    return modalMovie && typeof modalMovie.id === 'string' ? modalMovie.id : '';
  }

  function renderStars(rating: number) {
    let stars = '';
    for (let i = 1; i <= 5; i++) {
      stars += i <= rating ? '★' : '☆';
    }
    return stars;
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
            <button class="reviews-btn" on:click={() => {
              modalMovie = movie;
              if (!reviews[movie.id]) fetchReviews(movie.id);
            }}>
              Reviews
            </button>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</div>

{#if modalMovie}
  <div class="modal-backdrop" on:click={() => modalMovie = null}></div>
  <div class="modal-overlay">
    <div class="modal-content" on:click|stopPropagation>
      <button class="close-modal" on:click={() => modalMovie = null} aria-label="Close">
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          <line x1="9" y1="9" x2="19" y2="19" stroke="#111" stroke-width="2.5" stroke-linecap="round"/>
          <line x1="19" y1="9" x2="9" y2="19" stroke="#111" stroke-width="2.5" stroke-linecap="round"/>
        </svg>
      </button>
      <h3>Reviews for {modalMovie.title}</h3>
      {#if loadingReviews[getModalMovieId()]}
        <p>Loading reviews...</p>
      {:else if !reviews[getModalMovieId()] || reviews[getModalMovieId()].length === 0}
        <p>No reviews yet.</p>
      {:else}
        <ul class="review-list">
          {#each reviews[getModalMovieId()] as r}
            <li>
              <div class="review-meta">
                <span class="review-rating">{r.rating ? `Rating: ${renderStars(r.rating)}` : ''}</span>
                <span class="review-date">{formatDate(r.createdAt)}</span>
                {#if r.userId === userId && getModalMovieId() !== ''}
                  <button 
                    class="delete-review-btn" 
                    on:click={() => { const id = getModalMovieId(); if (id) handleDeleteReview(r.id, id); }}
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
        <div class="star-input">
          {#each Array(5) as _, i (i)}
            <span
              class="star {newReviewRating[getModalMovieId()] >= 5 - i ? 'filled' : ''}"
              on:click={() => newReviewRating[getModalMovieId()] = 5 - i}
              >&#9733;</span>
          {/each}
        </div>
        <textarea placeholder="Write your review..." bind:value={newReviewText[getModalMovieId()]}></textarea>
        <button on:click={() => getModalMovieId() && submitReview(getModalMovieId())} disabled={!getModalMovieId() || !newReviewText[getModalMovieId()]?.trim()}>Submit Review</button>
        {#if getModalMovieId() && reviewStatus[getModalMovieId()]}
          <span class="review-status">{reviewStatus[getModalMovieId()]}</span>
        {/if}
      </div>
    </div>
  </div>
{/if}

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
.review-rating { color: #ff9800; font-weight: 600; font-size: 1.2em; letter-spacing: 2px; }
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
  font-size: 2.4rem;
  line-height: 1;
  color: #111;
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
.movie-library li .reviews-btn {
  background: #43a047;
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 6px 14px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  margin-right: 8px;
  box-shadow: 0 2px 8px rgba(67,160,71,0.08);
}
.movie-library li .reviews-btn:hover {
  background: #2e7d32;
  transform: translateY(-2px) scale(1.03);
}
.movie-library li button:not(.reviews-btn) {
  background: #f44336;
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 6px 14px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  margin-right: 8px;
  box-shadow: 0 2px 8px rgba(244,67,54,0.08);
  transition: background 0.2s, transform 0.2s;
}
.movie-library li button:not(.reviews-btn):hover {
  background: #d32f2f;
  transform: translateY(-2px) scale(1.03);
}
.star-input {
  margin-bottom: 8px;
  text-align: center;
  margin-left: auto;
  margin-right: auto;
  display: flex;
  flex-direction: row-reverse;
  justify-content: center;
}
.star { font-size: 1.7em; color: #bbb; cursor: pointer; transition: color 0.2s; }
.star.filled { color: #ff9800; }
.star:hover, .star:hover ~ .star { color: #ffa726; }
</style>