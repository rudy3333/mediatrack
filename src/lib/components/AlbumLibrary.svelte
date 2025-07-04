<script lang="ts">
  import { onMount } from 'svelte';
  import { user } from '../stores/auth';
  import { get } from 'svelte/store';

  export let userId: string;
  export let albumReloadKey: number;

  type Album = {
    id?: string;
    title: string;
    artist: string;
    mbid?: string;
    cover?: string;
    firstReleaseDate?: string;
    savedAt?: string;
  };

  let albums: Album[] = [];
  let loading = false;
  let error: string = '';
  let reloadKey = 0;

  type Review = {
    id: string;
    userId: string;
    userName?: string;
    userProfilePicture?: string;
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
  let modalAlbum: any = null;

  async function load() {
    if (!userId) return;
    loading = true;
    error = '';
    try {
      const res = await fetch(`/api/music/albums/user/${userId}`);
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to fetch albums');
      const data = await res.json();
      albums = data.albums || [];
    } catch (e: unknown) {
      error = (e as Error).message;
    } finally {
      loading = false;
    }
  }

  async function remove(id: string | undefined) {
    if (!id) return;
    if (!confirm('Delete this album?')) return;
    try {
      const res = await fetch(`/api/music/albums/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete album');
      }
      albums = albums.filter(a => a.id !== id);
    } catch (e: unknown) {
      error = (e as Error).message;
    }
  }

  function handleAlbumSaved() {
    reloadKey += 1;
    load();
  }

  async function fetchReviews(albumId: string) {
    if (!albumId) return;
    loadingReviews[albumId] = true;
    try {
      const res = await fetch(`/api/reviews/${albumId}`);
      if (!res.ok) {
        reviews[albumId] = [];
        return;
      }
      const data = await res.json();
      reviews[albumId] = data.reviews;
    } finally {
      loadingReviews[albumId] = false;
    }
  }

  async function submitReview(albumId: string) {
    if (!newReviewText[albumId]?.trim() || !userId) return;
    reviewStatus[albumId] = '';
    const $user = get(user);
    try {
      const res = await fetch(`/api/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookId: albumId,
          userId,
          userName: $user?.name,
          userProfilePicture: $user?.profilePicture,
          reviewText: newReviewText[albumId],
          rating: newReviewRating[albumId] != null ? String(newReviewRating[albumId]) : null
        })
      });
      if (!res.ok) {
        const data = await res.json();
        reviewStatus[albumId] = data.error || 'Failed to submit review.';
        return;
      }
      newReviewText[albumId] = '';
      newReviewRating[albumId] = null;
      reviewStatus[albumId] = 'Review submitted!';
      fetchReviews(albumId);
    } catch (e) {
      reviewStatus[albumId] = 'Failed to submit review.';
    }
  }

  async function deleteReview(reviewId: string, albumId: string) {
    if (!confirm('Are you sure you want to delete this review?')) return;
    try {
      const res = await fetch(`/api/reviews/${reviewId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Failed to delete review.');
        return;
      }
      fetchReviews(albumId);
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

  function handleDeleteReview(reviewId: string, albumId: string | undefined) {
    if (albumId) deleteReview(reviewId, albumId);
  }

  function getModalAlbumId(): string {
    return modalAlbum && typeof modalAlbum.id === 'string' ? modalAlbum.id : '';
  }

  function renderStars(rating: number) {
    let stars = '';
    for (let i = 1; i <= 5; i++) {
      stars += i <= rating ? '★' : '☆';
    }
    return stars;
  }

  function handleImgError(e: Event) {
    const img = e.target as HTMLImageElement | null;
    if (img && img.src !== '/static/placeholder.jpg') img.src = '/static/placeholder.jpg';
  }

  $: if (userId || albumReloadKey) load();
  onMount(load);
</script>

<div class="album-library">
  <h3>Your Albums</h3>
  {#if loading}
    <div>Loading...</div>
  {:else if error}
    <div class="error">{error}</div>
  {:else if albums.length === 0}
    <div>No albums saved.</div>
  {:else}
    <ul>
      {#each albums as album}
        <li>
          <img src={album.cover || '/static/placeholder.jpg'} alt={album.title} width="60" on:error={handleImgError} />
          <span><strong>{album.title}</strong></span>
          <span class="artist">{album.artist}</span>
          <span class="saved-at">{album.savedAt ? `(Saved: ${new Date(album.savedAt).toLocaleDateString()})` : ''}</span>
          {#if album.id}
            <button on:click={() => remove(album.id)}>Delete</button>
            <button class="reviews-btn" on:click={() => {
              modalAlbum = album;
              if (album.id && !reviews[album.id]) fetchReviews(album.id);
            }}>
              Reviews
            </button>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</div>

{#if modalAlbum}
  <div class="modal-backdrop" on:click={() => modalAlbum = null}></div>
  <div class="modal-overlay">
    <div class="modal-content" on:click|stopPropagation>
      <button class="close-modal" on:click={() => modalAlbum = null} aria-label="Close">
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          <line x1="9" y1="9" x2="19" y2="19" stroke="#111" stroke-width="2.5" stroke-linecap="round"/>
          <line x1="19" y1="9" x2="9" y2="19" stroke="#111" stroke-width="2.5" stroke-linecap="round"/>
        </svg>
      </button>
      <h3>Reviews for {modalAlbum?.title}</h3>
      {#if loadingReviews[getModalAlbumId()]}
        <p>Loading reviews...</p>
      {:else if !reviews[getModalAlbumId()] || reviews[getModalAlbumId()]?.length === 0}
        <p>No reviews yet.</p>
      {:else}
        <ul class="review-list">
          {#each reviews[getModalAlbumId()] as r}
            <li>
              <div class="review-meta">
                {#if r.userProfilePicture}
                  <img src={r.userProfilePicture} alt={r.userName} class="review-pfp" width="28" height="28" on:error={handleImgError} />
                {:else}
                  <img src="/static/placeholder.jpg" alt="No profile" class="review-pfp" width="28" height="28" />
                {/if}
                <span class="review-user">{r.userName || 'Anonymous'}</span>
                <span class="review-rating">{r.rating ? `Rating: ${renderStars(r.rating)}` : ''}</span>
                <span class="review-date">{formatDate(r.createdAt)}</span>
                {#if r.userId === userId && getModalAlbumId() !== ''}
                  <button 
                    class="delete-review-btn" 
                    on:click={() => { const id = getModalAlbumId(); if (id) handleDeleteReview(r.id, id); }}
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
            {@const rating = newReviewRating[getModalAlbumId()]}
            <span
              class="star {rating && rating >= 5 - i ? 'filled' : ''}"
              on:click={() => newReviewRating[getModalAlbumId()] = 5 - i}
              >&#9733;</span>
          {/each}
        </div>
        <textarea placeholder="Write your review..." bind:value={newReviewText[getModalAlbumId()]}></textarea>
        <button on:click={() => getModalAlbumId() && submitReview(getModalAlbumId())} disabled={!getModalAlbumId() || !newReviewText[getModalAlbumId()]?.trim()}>Submit Review</button>
        {#if getModalAlbumId() && reviewStatus[getModalAlbumId()]}
          <span class="review-status">{reviewStatus[getModalAlbumId()]}</span>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
.album-library ul { list-style: none; padding: 0; }
.album-library li { display: flex; align-items: center; gap: 1em; margin-bottom: 0.5em; }
.error { color: red; }
.artist { color: #666; font-style: italic; }
.release-date { color: #888; font-size: 0.9em; }
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
  background: #fff !important;
  opacity: 1 !important;
  filter: none !important;
  border: 2px solid #1976d2;
  border-radius: 18px;
  box-shadow: 0 8px 32px rgba(60,60,120,0.18);
  padding: 48px 40px 36px 40px;
  z-index: 1002;
  min-width: 520px;
  max-width: 98vw;
  max-height: 96vh;
  overflow-y: auto;
}
.modal-content {
  background: #fff !important;
  opacity: 1 !important;
  filter: none !important;
  border-radius: 16px;
  box-shadow: none;
  position: relative;
}
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
.album-library li .reviews-btn {
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
.album-library li .reviews-btn:hover {
  background: #2e7d32;
  transform: translateY(-2px) scale(1.03);
}
.album-library li button:not(.reviews-btn) {
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
.album-library li button:not(.reviews-btn):hover {
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
.review-pfp {
  border-radius: 50%;
  width: 28px;
  height: 28px;
  object-fit: cover;
  margin-right: 8px;
  border: 1.5px solid #bfc9e0;
}
.review-user {
  font-weight: 600;
  color: #22223b;
  margin-right: 10px;
}
.modal-overlay, .modal-content, .modal-backdrop, .album-library {
  background-color: #fff !important;
  opacity: 1 !important;
  filter: none !important;
}
</style> 