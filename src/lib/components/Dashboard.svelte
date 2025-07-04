<script lang="ts">
  import { user, logout, setUser } from '../stores/auth';
  import { onMount } from 'svelte';
  import AuthForm from './AuthForm.svelte';
  import BookSearch from './BookSearch.svelte';
  import BookLibrary from './BookLibrary.svelte';
  import MovieSearch from './MovieSearch.svelte';
  import MovieLibrary from './MovieLibrary.svelte';
  import { writable } from 'svelte/store';
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
  let userId: string | null = null;
  let tab: 'books' | 'movies' = 'books';

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
  const API_BASE_URL = '';

  let movieReloadKey = 0;
  function handleMovieSaved() {
    movieReloadKey += 1;
  }

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
    
    // Debug: Log the user object to see what we're working with
    console.log('User object:', $user);
    console.log('User ID type:', typeof $user.id, 'Value:', $user.id);
    console.log('User airtableId:', $user.airtableId);
    
    try {
      const res = await fetch(`/api/books/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: $user.airtableId || $user.id, // Use airtableId if available, fallback to id
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
      
      // Refresh the saved books list to show the newly saved book
      await fetchSavedBooks();
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
      const res = await fetch(`/api/books/user/${$user.airtableId || $user.id}`);
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
    if (!newReviewText[bookId]?.trim() || !$user?.id) return;
    reviewStatus[bookId] = '';
    try {
      const res = await fetch(`/api/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookId,
          userId: $user.airtableId || $user.id, // Use airtableId if available, fallback to id
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
      // Refresh reviews after deletion
      fetchReviews(bookId);
    } catch (e) {
      alert('Failed to delete review.');
    }
  }

  $: userId = $user?.airtableId || $user?.id || null;

  $: if (book && book.airtableId) {
    fetchReviews(book.airtableId);
  }

  function handleImgError(e: Event) {
    const img = e.target as HTMLImageElement | null;
    if (img) img.src = '/static/placeholder.jpg';
  }

  let showProfilePanel = false;
  let profileForm = { name: '', email: '', profilePicture: '' };
  let selectedProfileFile: File | null = null;
  let previewProfileUrl: string | null = null;

  function handleProfileFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      selectedProfileFile = input.files[0];
      previewProfileUrl = URL.createObjectURL(selectedProfileFile);
    } else {
      selectedProfileFile = null;
      previewProfileUrl = null;
    }
  }

  $: if ($user) {
    profileForm.name = $user.name;
    profileForm.email = $user.email;
    profileForm.profilePicture = $user.profilePicture || '';
  }

  function openProfilePanel() {
    if ($user) {
      profileForm.name = $user.name;
      profileForm.email = $user.email;
      profileForm.profilePicture = $user.profilePicture || '';
      showProfilePanel = true;
    }
  }
  function closeProfilePanel() {
    showProfilePanel = false;
  }
  async function saveProfile() {
    let profilePictureUrl = profileForm.profilePicture;
    if (selectedProfileFile) {
      const formData = new FormData();
      formData.append('profilePicture', selectedProfileFile);
      const uploadRes = await fetch('/api/upload/profile-picture', {
        method: 'POST',
        body: formData
      });
      if (uploadRes.ok) {
        const data = await uploadRes.json();
        profilePictureUrl = data.url;
      } else {
        alert('Failed to upload profile picture.');
        return;
      }
    }
    const userId = $user?.airtableId || $user?.id;
    if (!userId) return;
    const patchRes = await fetch(`/api/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: profileForm.name,
        email: profileForm.email,
        profilePicture: profilePictureUrl
      })
    });
    if (patchRes.ok) {
      const data = await patchRes.json();
      setUser({
        ...$user,
        name: profileForm.name,
        email: profileForm.email,
        profilePicture: profilePictureUrl
      });
      showProfilePanel = false;
      selectedProfileFile = null;
      previewProfileUrl = null;
    } else {
      alert('Failed to update profile.');
    }
  }

  let recentReviews: any[] = [];
  let loadingRecent = false;
  let recentError = '';

  async function fetchBookCoverAndTitle(bookId: string): Promise<{cover: string|null, title: string|null}> {
    if (!bookId) return {cover: null, title: null};
    try {
      const res = await fetch(`/api/books/id/${bookId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.cover) {
          return {cover: data.cover, title: data.title || null};
        }
      }
    } catch (e) {}
    try {
      const res = await fetch(`/api/movies/id/${bookId}`);
      if (res.ok) {
        const data = await res.json();
        return {cover: (data.poster && data.poster !== 'N/A') ? data.poster : null, title: data.title || null};
      }
    } catch (e) {}
    return {cover: null, title: null};
  }

  onMount(async () => {
    loadingRecent = true;
    recentError = '';
    try {
      const res = await fetch('/api/recent');
      if (!res.ok) {
        const data = await res.json();
        recentError = data.error || 'Failed to fetch recent reviews.';
        return;
      }
      const data = await res.json();
      let reviews = data.records || [];
      await Promise.all(
        reviews.map(async (review: any) => {
          const bookId = review.fields?.BookID;
          const {cover, title} = await fetchBookCoverAndTitle(bookId);
          review.bookCover = cover;
          review.bookTitle = title;
        })
      );
      recentReviews = reviews;
    } catch (e) {
      recentError = 'Failed to fetch recent reviews.';
    } finally {
      loadingRecent = false;
    }
  });

  let hoveredReviewIdx: number | null = null;
</script>

<div class="dashboard-bg"></div>
<div class="dashboard">
  {#if userId}
    <button class="logout-btn" on:click={handleLogout}>Sign Out</button>
    <div class="profile-header">
      <img class="profile-picture" src={$user?.profilePicture || '/static/placeholder.jpg'} alt={$user?.name ? `Profile photo of ${$user.name}` : 'User profile photo'} on:error={handleImgError} />
      <div class="profile-actions">
        <button class="manage-profile-btn" on:click={openProfilePanel}>Manage Profile</button>
      </div>
    </div>
  {/if}
  <section class="recent-reviews">
    <h2>Recent Reviews</h2>
    {#if loadingRecent}
      <div class="recent-loading">Loading recent reviews...</div>
    {:else if recentError}
      <div class="recent-error">{recentError}</div>
    {:else if recentReviews.length === 0}
      <div class="recent-empty">No recent reviews found.</div>
    {:else}
      <div class="recent-covers-row">
        {#each recentReviews as review, i}
          <div class="recent-cover-wrapper"
            on:mouseenter={() => hoveredReviewIdx = i}
            on:mouseleave={() => hoveredReviewIdx = null}
          >
            <img
              class="recent-cover"
              src={review.bookCover || '/static/placeholder.jpg'}
              alt={review.fields?.BookTitle || 'Book cover'}
              on:error={handleImgError}
            />
            <div class="recent-tooltip">
              <div class="recent-tooltip-title">{review.fields?.BookTitle || review.bookTitle || ''}</div>
              <div class="recent-tooltip-reviewer">{review.fields?.UserName || 'Anonymous'}</div>
              {#if review.fields?.Rating}
                <div class="recent-tooltip-rating">{'★'.repeat(+review.fields.Rating)}{'☆'.repeat(5 - +review.fields.Rating)}</div>
              {/if}
              <div class="recent-tooltip-text">{review.fields?.ReviewText || ''}</div>
              <div class="recent-tooltip-date">{formatDate(review.fields?.CreatedAt || review.createdTime)}</div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </section>
  <div class="tabs-row">
    <div class="tabs">
      <button class:active={tab === 'books'} on:click={() => tab = 'books'}>Books</button>
      <button class:active={tab === 'movies'} on:click={() => tab = 'movies'}>Movies/Shows</button>
    </div>
    {#if userId && tab === 'books'}
      <div class="booksearch-inline booksearch-right"><BookSearch userId={userId} /></div>
    {/if}
    {#if userId && tab === 'movies'}
      <div class="booksearch-inline booksearch-right"><MovieSearch userId={userId} on:movie-saved={handleMovieSaved} /></div>
    {/if}
  </div>
  {#if !userId}
    <AuthForm />
  {:else}
    {#if tab === 'books'}
      <BookLibrary userId={userId} />
    {:else if tab === 'movies'}
      <MovieLibrary userId={userId} {movieReloadKey} />
    {/if}
  {/if}
  {#if showProfilePanel}
    <button
      type="button"
      class="profile-panel-backdrop"
      on:click={closeProfilePanel}
      aria-label="Close profile panel"
    ></button>
    <div class="profile-panel">
      <h3>Manage Profile</h3>
      <form on:submit|preventDefault={saveProfile}>
        <label>
          Name
          <input type="text" bind:value={profileForm.name} />
        </label>
        <label>
          Email
          <input type="email" bind:value={profileForm.email} />
        </label>
        <label>
          Profile Picture
          <input type="file" accept="image/*" on:change={handleProfileFileChange} />
          {#if previewProfileUrl}
            <img src={previewProfileUrl} alt="Preview" class="profile-picture-preview" />
          {:else if profileForm.profilePicture}
            <img src={profileForm.profilePicture} alt="Current" class="profile-picture-preview" />
          {/if}
        </label>
        <div class="profile-panel-actions">
          <button type="submit">Save</button>
          <button type="button" on:click={closeProfilePanel}>Cancel</button>
        </div>
      </form>
    </div>
  {/if}
</div>

<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap');

  .dashboard {
    font-family: 'Inter', Arial, sans-serif;
    background: none;
  }
  .dashboard-bg {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    z-index: -1;
    background: linear-gradient(120deg, #e0e7ff 0%, #f8fafc 100%);
    min-height: 100vh;
  }
  .dashboard {
    max-width: 1000px;
    margin: 0 auto;
    padding: 32px 20px 20px 20px;
    border-radius: 18px;
    box-shadow: 0 8px 32px rgba(60, 60, 120, 0.08);
    background: rgba(255,255,255,0.95);
  }
  .logout-btn {
    position: absolute;
    top: 24px;
    right: 32px;
    background: linear-gradient(90deg, #f44336 60%, #ff7961 100%);
    color: white;
    border: none;
    padding: 8px 18px;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(244,67,54,0.08);
    transition: background 0.2s, transform 0.2s;
    z-index: 10;
  }
  .logout-btn:hover {
    filter: brightness(1.08);
    transform: translateY(-2px) scale(1.03);
  }
  .tabs-row {
    display: flex;
    align-items: flex-start;
    gap: 1.5em;
    margin-bottom: 1em;
    position: relative;
  }
  .tabs {
    display: flex;
    gap: 1em;
    margin-bottom: 0;
  }
  .booksearch-inline {
    flex: 1;
    display: flex;
    align-items: flex-start;
  }
  .booksearch-right {
    justify-content: flex-end;
    position: absolute;
    right: 0;
    top: -18px;
    max-width: 400px;
    width: 100%;
  }
  .booksearch-inline .book-search {
    margin: 0;
    width: 100%;
  }
  .profile-header {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
    margin-bottom: 18px;
    position: relative;
  }
  .profile-actions {
    display: flex;
    flex-direction: row;
    gap: 8px;
    margin-left: auto;
  }
  .manage-profile-btn {
    background: linear-gradient(90deg, #1976d2 60%, #64b5f6 100%);
    color: white;
    border: none;
    border-radius: 6px;
    padding: 8px 18px;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(25,118,210,0.08);
    transition: background 0.2s, transform 0.2s;
  }
  .manage-profile-btn:hover {
    filter: brightness(1.08);
    transform: translateY(-2px) scale(1.03);
  }
  .profile-panel-backdrop {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.25);
    z-index: 1001;
    border: none;
    padding: 0;
    margin: 0;
    cursor: pointer;
    width: 100vw;
    height: 100vh;
    outline: none;
  }
  .profile-panel-backdrop:focus {
    outline: 2px solid #1976d2;
  }
  .profile-panel-backdrop::-moz-focus-inner {
    border: 0;
  }
  .profile-panel {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: #fff;
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(60,60,120,0.18);
    padding: 32px 28px 24px 28px;
    z-index: 1002;
    min-width: 320px;
    max-width: 90vw;
  }
  .profile-panel h3 {
    margin-top: 0;
    margin-bottom: 18px;
    font-size: 22px;
    font-weight: 600;
    color: #22223b;
  }
  .profile-panel label {
    display: block;
    margin-bottom: 14px;
    font-size: 15px;
    color: #333;
  }
  .profile-panel input {
    width: 100%;
    padding: 7px 10px;
    border-radius: 5px;
    border: 1.5px solid #bfc9e0;
    font-size: 15px;
    margin-top: 4px;
    background: #f6f8fa;
    margin-bottom: 4px;
  }
  .profile-panel-actions {
    display: flex;
    gap: 12px;
    margin-top: 18px;
  }
  .profile-panel-actions button {
    background: linear-gradient(90deg, #1976d2 60%, #64b5f6 100%);
    color: white;
    border: none;
    border-radius: 6px;
    padding: 8px 18px;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(25,118,210,0.08);
    transition: background 0.2s, transform 0.2s;
  }
  .profile-panel-actions button[type="button"] {
    background: #bfc9e0;
    color: #333;
  }
  .profile-panel-actions button:hover {
    filter: brightness(1.08);
    transform: translateY(-2px) scale(1.03);
  }
  .profile-picture {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid #bfc9e0;
    background: #e3e7ef;
    box-shadow: 0 1px 4px rgba(60,60,120,0.08);
  }
  .profile-picture-preview {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid #bfc9e0;
    background: #e3e7ef;
    box-shadow: 0 1px 4px rgba(60,60,120,0.08);
    margin-top: 8px;
    margin-bottom: 8px;
    display: block;
  }
  .recent-reviews {
    background: rgba(240,245,255,0.7);
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(60,60,120,0.06);
    padding: 18px 22px 12px 22px;
    margin-bottom: 28px;
    overflow: visible;
  }
  .recent-reviews h2 {
    margin-top: 0;
    margin-bottom: 12px;
    font-size: 20px;
    font-weight: 600;
    color: #22223b;
  }
  .recent-covers-row {
    display: flex;
    flex-direction: row;
    gap: 18px;
    overflow-x: visible;
    padding-bottom: 8px;
  }
  .recent-cover-wrapper {
    flex: 0 0 auto;
    width: 72px;
    height: 72px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    background: #f6f8fa;
    box-shadow: 0 1px 4px rgba(60,60,120,0.06);
    position: relative;
    overflow: visible;
    z-index: 10;
  }
  .recent-cover {
    width: 64px;
    height: 64px;
    object-fit: cover;
    border-radius: 6px;
    border: 1.5px solid #bfc9e0;
    background: #e3e7ef;
    transition: transform 0.15s;
    cursor: pointer;
  }
  .recent-cover:hover {
    transform: scale(1.07);
    box-shadow: 0 2px 8px rgba(60,60,120,0.12);
  }
  .recent-loading, .recent-error, .recent-empty {
    color: #888;
    font-size: 15px;
    padding: 8px 0;
  }
  .recent-tooltip {
    position: absolute;
    left: 50%;
    top: 100%;
    bottom: auto;
    transform: translateX(-50%) translateY(10px);
    background: #fff;
    color: #22223b;
    border-radius: 10px;
    box-shadow: 0 4px 24px rgba(60,60,120,0.18);
    padding: 14px 18px 12px 18px;
    min-width: 220px;
    max-width: 320px;
    z-index: 100;
    font-size: 15px;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.15s, transform 0.18s;
  }
  .recent-cover-wrapper:hover .recent-tooltip {
    opacity: 0.98;
    pointer-events: auto;
    transform: translateX(-50%) translateY(18px);
  }
  .recent-tooltip-title {
    font-weight: 600;
    font-size: 16px;
    margin-bottom: 2px;
  }
  .recent-tooltip-reviewer {
    color: #3a3a5a;
    font-size: 14px;
    margin-bottom: 2px;
  }
  .recent-tooltip-rating {
    color: #f59e42;
    font-size: 15px;
    margin-bottom: 2px;
  }
  .recent-tooltip-text {
    color: #444;
    font-size: 15px;
    margin-bottom: 2px;
    margin-top: 2px;
  }
  .recent-tooltip-date {
    color: #7b7b9a;
    font-size: 13px;
    margin-top: 4px;
  }
</style>