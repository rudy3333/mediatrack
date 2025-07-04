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
</script>

<div class="dashboard-bg"></div>
<div class="dashboard">
  {#if userId}
    <button class="logout-btn" on:click={handleLogout}>Sign Out</button>
    <div class="profile-header">
      <img class="profile-picture" src={$user?.profilePicture || '/static/placeholder.jpg'} alt="Profile Picture" on:error={handleImgError} />
      <div class="profile-actions">
        <button class="manage-profile-btn" on:click={openProfilePanel}>Manage Profile</button>
      </div>
    </div>
  {/if}
  <div class="tabs">
    <button class:active={tab === 'books'} on:click={() => tab = 'books'}>Books</button>
    <button class:active={tab === 'movies'} on:click={() => tab = 'movies'}>Movies/Shows</button>
  </div>
  {#if !userId}
    <AuthForm />
  {:else}
    {#if tab === 'books'}
      <BookSearch userId={userId} />
      <BookLibrary userId={userId} />
    {:else if tab === 'movies'}
      <MovieSearch userId={userId} on:movie-saved={handleMovieSaved} />
      <MovieLibrary userId={userId} {movieReloadKey} />
    {/if}
  {/if}
  {#if showProfilePanel}
    <div class="profile-panel-backdrop" on:click={closeProfilePanel}></div>
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

  body, .dashboard {
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
  .dashboard-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 30px;
    background: white;
    border: none;
    border-radius: 12px;
    padding: 28px 24px;
    box-shadow: 0 2px 12px rgba(60,60,120,0.07);
  }
  .welcome-section h1 {
    margin: 0 0 10px 0;
    font-size: 32px;
    font-weight: 600;
    color: #22223b;
    letter-spacing: -1px;
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
  .book-search, .saved-books {
    background: white;
    border: none;
    border-radius: 14px;
    padding: 28px 24px;
    margin-bottom: 32px;
    max-width: 700px;
    box-shadow: 0 2px 12px rgba(60,60,120,0.07);
  }
  .book-search-form {
    display: flex;
    gap: 12px;
    margin-bottom: 18px;
  }
  .book-search-form input {
    flex: 1;
    padding: 10px 12px;
    border: 1.5px solid #bfc9e0;
    border-radius: 6px;
    font-size: 17px;
    background: #f6f8fa;
    transition: border 0.2s;
  }
  .book-search-form input:focus {
    border: 1.5px solid #1976d2;
    outline: none;
  }
  .book-search-form button {
    padding: 10px 20px;
    font-size: 17px;
    border: none;
    border-radius: 6px;
    background: linear-gradient(90deg, #1976d2 60%, #64b5f6 100%);
    color: white;
    cursor: pointer;
    font-weight: 600;
    box-shadow: 0 2px 8px rgba(25,118,210,0.08);
    transition: background 0.2s, transform 0.2s;
  }
  .book-search-form button:disabled {
    background: #b3c6e6;
    cursor: not-allowed;
  }
  .book-result {
    display: flex;
    gap: 24px;
    align-items: flex-start;
    margin-top: 12px;
    background: #f7f9fc;
    border-radius: 10px;
    padding: 18px 16px;
    box-shadow: 0 1px 6px rgba(60,60,120,0.04);
    transition: box-shadow 0.2s;
  }
  .img-wrapper {
    min-width: 75px;
    min-height: 110px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #e3e7ef;
    border-radius: 6px;
    box-shadow: 0 1px 4px rgba(60,60,120,0.04);
    overflow: hidden;
  }
  .book-cover {
    width: 75px;
    height: auto;
    border-radius: 4px;
    box-shadow: 0 2px 6px rgba(0,0,0,0.05);
    background: #e3e7ef;
    object-fit: cover;
    transition: filter 0.2s;
  }
  .book-info h4 {
    margin: 0 0 8px 0;
    font-size: 22px;
    font-weight: 600;
    color: #22223b;
  }
  .book-info p {
    margin: 0 0 6px 0;
    color: #444;
  }
  .error {
    color: #d32f2f;
    font-weight: bold;
    margin-top: 8px;
  }
  .save-btn {
    margin-top: 10px;
    background: linear-gradient(90deg, #43a047 60%, #81c784 100%);
    color: white;
    border: none;
    padding: 8px 18px;
    border-radius: 6px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(67,160,71,0.08);
    transition: background 0.2s, transform 0.2s;
  }
  .save-btn:disabled {
    background: #b7e1c2;
    cursor: not-allowed;
  }
  .save-status {
    display: inline-block;
    margin-left: 14px;
    color: #388e3c;
    font-weight: bold;
    font-size: 16px;
  }
  .saved-books-list {
    display: flex;
    flex-wrap: wrap;
    gap: 20px;
  }
  .saved-book-card {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 14px;
    background: #f7f9fc;
    border: none;
    border-radius: 10px;
    padding: 14px 10px 14px 10px;
    min-width: 180px;
    max-width: 240px;
    box-sizing: border-box;
    box-shadow: 0 1px 6px rgba(60,60,120,0.04);
    transition: box-shadow 0.2s, transform 0.2s;
  }
  .saved-book-card:hover {
    box-shadow: 0 4px 16px rgba(60,60,120,0.10);
    transform: translateY(-2px) scale(1.03);
  }
  .book-info {
    flex: 1 1 auto;
    width: 100%;
  }
  .delete-btn {
    background: linear-gradient(90deg, #f44336 60%, #ff7961 100%);
    color: white;
    border: none;
    border-radius: 6px;
    padding: 7px 14px;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    margin-top: 6px;
    margin-bottom: 4px;
    box-shadow: 0 2px 8px rgba(244,67,54,0.08);
    transition: background 0.2s, transform 0.2s;
  }
  .review-btn {
    margin-top: 8px;
    background: linear-gradient(90deg, #1976d2 60%, #64b5f6 100%);
    color: white;
    border: none;
    border-radius: 6px;
    padding: 7px 14px;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    margin-right: 8px;
    box-shadow: 0 2px 8px rgba(25,118,210,0.08);
    transition: background 0.2s, transform 0.2s;
  }
  .review-section {
    margin-top: 18px;
    background: #e9f0fa;
    border-radius: 8px;
    padding: 14px 12px;
    box-shadow: 0 1px 4px rgba(60,60,120,0.04);
    width: 100%;
    box-sizing: border-box;
    overflow: visible;
    animation: fadeIn 0.4s;
  }
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: none; }
  }
  .review-section h5 {
    margin: 0 0 8px 0;
    font-size: 17px;
    font-weight: 600;
    color: #22223b;
  }
  .review-list {
    list-style: none;
    padding: 0;
    margin: 0 0 10px 0;
  }
  .review-list li {
    margin-bottom: 10px;
    padding-bottom: 8px;
    border-bottom: 1px solid #dbeafe;
    background: #f5faff;
    border-radius: 4px;
    padding-left: 6px;
    padding-right: 6px;
    transition: background 0.2s;
  }
  .review-list li:hover {
    background: #e3e7ef;
  }
  .review-meta {
    font-size: 13px;
    color: #888;
    display: flex;
    gap: 10px;
    margin-bottom: 2px;
    align-items: center;
  }
  .review-rating {
    color: #ff9800;
    font-weight: 600;
  }
  .review-date {
    color: #6c757d;
  }
  .review-text {
    font-size: 15px;
    color: #333;
    margin-top: 2px;
  }
  .review-form {
    display: flex;
    flex-direction: column;
    gap: 7px;
    margin-top: 10px;
    background: #f7f9fc;
    border-radius: 6px;
    padding: 8px 6px;
  }
  .review-form textarea {
    resize: vertical;
    min-height: 40px;
    font-size: 15px;
    padding: 7px;
    border-radius: 4px;
    border: 1.5px solid #bfc9e0;
    background: #f6f8fa;
    transition: border 0.2s;
  }
  .review-form textarea:focus {
    border: 1.5px solid #1976d2;
    outline: none;
  }
  .review-form select {
    width: 130px;
    font-size: 15px;
    padding: 4px;
    border-radius: 4px;
    border: 1.5px solid #bfc9e0;
    background: #f6f8fa;
    transition: border 0.2s;
  }
  .review-form select:focus {
    border: 1.5px solid #1976d2;
    outline: none;
  }
  .review-form button {
    align-self: flex-start;
    background: linear-gradient(90deg, #1976d2 60%, #64b5f6 100%);
    color: white;
    border: none;
    border-radius: 6px;
    padding: 7px 16px;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(25,118,210,0.08);
    transition: background 0.2s, transform 0.2s;
  }
  .review-status {
    margin-left: 10px;
    color: #388e3c;
    font-size: 15px;
    font-weight: 600;
  }
  .delete-review-btn {
    background: linear-gradient(90deg, #f44336 60%, #ff7961 100%);
    color: white;
    border: none;
    border-radius: 50%;
    width: 22px;
    height: 22px;
    font-size: 15px;
    font-weight: bold;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-left: auto;
    box-shadow: 0 2px 8px rgba(244,67,54,0.08);
    transition: background 0.2s, transform 0.2s;
  }
  .delete-review-btn:hover {
    background: #d32f2f;
    transform: scale(1.1);
  }
  .loader {
    border: 4px solid #e3e7ef;
    border-top: 4px solid #1976d2;
    border-radius: 50%;
    width: 32px;
    height: 32px;
    animation: spin 1s linear infinite;
    margin: 0 auto 10px auto;
    display: block;
  }
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  @media (max-width: 768px) {
    .dashboard {
      padding: 10px;
    }
    .dashboard-header {
      flex-direction: column;
      gap: 15px;
      align-items: stretch;
      padding: 18px 10px;
    }
    .welcome-section h1 {
      font-size: 24px;
    }
    .book-search, .saved-books {
      padding: 16px 8px;
    }
    .saved-books-list {
      gap: 10px;
    }
    .saved-book-card {
      min-width: 120px;
      max-width: 100%;
      padding: 8px 4px;
    }
  }
  .placeholder-cover {
    width: 75px;
    height: 110px;
    background: repeating-linear-gradient(135deg, #e3e7ef, #e3e7ef 10px, #f6f8fa 10px, #f6f8fa 20px);
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #bfc9e0;
    font-size: 13px;
    font-style: italic;
    box-shadow: 0 1px 4px rgba(60,60,120,0.04);
  }
  .tabs { display: flex; gap: 1em; margin-bottom: 1em; }
  .tabs button { padding: 0.5em 1.5em; border: none; background: #eee; cursor: pointer; border-radius: 4px; font-weight: bold; }
  .tabs button.active { background: #333; color: #fff; }
  .profile-header {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 18px;
    margin-bottom: 18px;
    position: relative;
  }
  .profile-actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
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
  .logout-btn {
    background: linear-gradient(90deg, #f44336 60%, #ff7961 100%);
    color: white;
    border: none;
    border-radius: 6px;
    padding: 8px 18px;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(244,67,54,0.08);
    transition: background 0.2s, transform 0.2s;
  }
  .logout-btn:hover {
    filter: brightness(1.08);
    transform: translateY(-2px) scale(1.03);
  }
  .profile-panel-backdrop {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.25);
    z-index: 1001;
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
</style>