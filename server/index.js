import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import fetch from 'node-fetch';
import path from 'path';
import { exec } from 'child_process';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Airtable configuration from environment variables
const AIRTABLE_CONFIG = {
  baseId: process.env.AIRTABLE_BASE_ID,
  apiKey: process.env.AIRTABLE_API_KEY,
  tableName: process.env.AIRTABLE_TABLE_NAME || 'Users'
};

// Validate Airtable configuration
function validateAirtableConfig() {
  if (!AIRTABLE_CONFIG.baseId || !AIRTABLE_CONFIG.apiKey || !AIRTABLE_CONFIG.tableName) {
    throw new Error('Missing Airtable configuration. Please check your .env file.');
  }
  
  if (!AIRTABLE_CONFIG.baseId.startsWith('app')) {
    throw new Error('Invalid Airtable Base ID. It should start with "app".');
  }
  
  if (!AIRTABLE_CONFIG.apiKey.startsWith('pat') && !AIRTABLE_CONFIG.apiKey.startsWith('key')) {
    throw new Error('Invalid Airtable API key. It should start with "pat" or "key".');
  }
}

// Initialize and validate configuration
try {
  validateAirtableConfig();
  console.log('✅ Airtable configuration validated successfully');
} catch (error) {
  console.error('❌ Airtable configuration error:', error.message);
  process.exit(1);
}

// Airtable API helpers
function getAirtableHeaders() {
  return {
    'Authorization': `Bearer ${AIRTABLE_CONFIG.apiKey}`,
    'Content-Type': 'application/json'
  };
}

function getAirtableUrl() {
  return `https://api.airtable.com/v0/${AIRTABLE_CONFIG.baseId}/${AIRTABLE_CONFIG.tableName}`;
}

// Hash password securely
async function hashPassword(password) {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
}

// Verify password
async function verifyPassword(password, hashedPassword) {
  return await bcrypt.compare(password, hashedPassword);
}

// Get user by email from Airtable
async function getUserByEmail(email) {
  try {
    const headers = getAirtableHeaders();
    const url = getAirtableUrl();
    
    const response = await fetch(`${url}?filterByFormula={Email}="${email}"`, {
      headers
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to fetch user');
    }

    const data = await response.json();
    
    if (data.records.length === 0) {
      return null;
    }

    const record = data.records[0];
    
    return {
      id: record.id, // Use Airtable record ID as user ID
      airtableId: record.id,
      name: record.fields.Name,
      email: record.fields.Email,
      password: record.fields.Password,
      createdAt: record.fields.CreatedAt,
      profilePicture: record.fields.ProfilePicture || undefined
    };
  } catch (error) {
    console.error('Error fetching user by email:', error);
    throw error;
  }
}

// OMDb configuration from environment variables
const OMDB_API_KEY = process.env.OMDB_API_KEY;
const OMDB_API_URL = 'https://www.omdbapi.com/';

if (!OMDB_API_KEY) {
  console.error('❌ OMDb API key missing. Please add OMDB_API_KEY to your .env file.');
  process.exit(1);
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(process.cwd(), 'static'));
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const uniqueName = `profile_${Date.now()}_${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, uniqueName);
  }
});
const upload = multer({ storage });

// API Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Server is running',
    airtableConfigured: !!AIRTABLE_CONFIG.baseId && !!AIRTABLE_CONFIG.apiKey
  });
});

// Test DELETE endpoint
app.delete('/api/test', (req, res) => {
  console.log('Test DELETE endpoint called');
  res.json({ message: 'DELETE endpoint is working' });
});

// Register user
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, profilePicture } = req.body;

    // Validate input
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    // Check if user already exists
    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }

    // Hash password
    const hashedPassword = await hashPassword(password);
    
    // Create user in Airtable
    const headers = getAirtableHeaders();
    const url = getAirtableUrl();
    
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        fields: {
          Name: name,
          Email: email,
          Password: hashedPassword,
          CreatedAt: new Date().toISOString(),
          ...(profilePicture ? { ProfilePicture: profilePicture } : {})
        }
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Registration failed');
    }

    const data = await response.json();
    
    // Return user data (without password)
    const user = {
      id: data.id, // Use Airtable record ID as user ID
      airtableId: data.id,
      name: data.fields.Name,
      email: data.fields.Email,
      createdAt: data.fields.CreatedAt,
      profilePicture: data.fields.ProfilePicture || undefined
    };

    res.status(201).json({ user });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: error.message || 'Registration failed' });
  }
});

// Login user
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Get user from Airtable
    const user = await getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Verify password
    const isValidPassword = await verifyPassword(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Return user data (without password)
    const userData = {
      id: user.id,
      airtableId: user.airtableId,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
      profilePicture: user.profilePicture || undefined
    };

    res.json({ user: userData });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: error.message || 'Login failed' });
  }
});

app.get('/api/books/:isbn', async (req, res) => {
  const { isbn } = req.params;
  if (!isbn) {
    return res.status(400).json({ error: 'ISBN is required' });
  }

  try {
    const apiUrl = `https://openlibrary.org/isbn/${isbn}.json`;
    const coverUrl = `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`;
    const response = await fetch(apiUrl);
    if (!response.ok) {
      return res.status(404).json({ error: 'Book not found' });
    }
    const data = await response.json();

    const title = data.title || null;

    res.json({
      isbn,
      title,
      cover: coverUrl
    });
  } catch (error) {
    console.error('Book lookup error:', error);
    res.status(500).json({ error: 'Failed to fetch book data' });
  }
});


app.post('/api/books/save', async (req, res) => {
  const { userId, isbn, title, cover } = req.body;
  if (!userId || !title) {
    return res.status(400).json({ error: 'userId and title are required' });
  }

  try {
    const url = `https://api.airtable.com/v0/${AIRTABLE_CONFIG.baseId}/Books`;
    const headers = getAirtableHeaders();
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        fields: {
          UserID: String(userId), // Convert to string to ensure compatibility
          ISBN: isbn || '',
          Title: title,
          Cover: cover,
          SavedAt: new Date().toISOString()
        }
      })
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to save book');
    }
    const data = await response.json();
    res.status(201).json({ book: data });
  } catch (error) {
    console.error('Save book error:', error);
    res.status(500).json({ error: error.message || 'Failed to save book' });
  }
});

app.get('/api/books/user/:userId', async (req, res) => {
  const { userId } = req.params;
  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }
  try {
    const url = `https://api.airtable.com/v0/${AIRTABLE_CONFIG.baseId}/Books?filterByFormula={UserID}='${String(userId)}'`;
    const headers = getAirtableHeaders();
    const response = await fetch(url, { headers });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to fetch books');
    }
    const data = await response.json();
    const books = data.records.map(record => ({
      id: record.id,
      isbn: record.fields.ISBN,
      title: record.fields.Title,
      cover: record.fields.Cover,
      savedAt: record.fields.SavedAt
    }));
    res.json({ books });
  } catch (error) {
    console.error('Fetch user books error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch books' });
  }
});

// DELETE /api/books/:airtableId
app.delete('/api/books/:airtableId', async (req, res) => {
  const { airtableId } = req.params;

  if (!airtableId) {
    return res.status(400).json({ error: 'Book ID is required' });
  }

  try {
    const url = `https://api.airtable.com/v0/${AIRTABLE_CONFIG.baseId}/Books/${airtableId}`;
    const headers = getAirtableHeaders();

    const response = await fetch(url, {
      method: 'DELETE',
      headers
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to delete book');
    }

    res.status(200).json({ success: true, message: 'Book deleted successfully' });
  } catch (error) {
    console.error('Delete book error:', error);
    res.status(500).json({ error: error.message || 'Failed to delete book' });
  }
});

app.get('/api/books/title/:title', async (req, res) => {
  const { title } = req.params;
  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }

  try {
    // Open Library Search API for title
    const apiUrl = `https://openlibrary.org/search.json?title=${encodeURIComponent(title)}`;
    const response = await fetch(apiUrl);
    if (!response.ok) {
      return res.status(404).json({ error: 'Book not found' });
    }
    const data = await response.json();
    if (!data.docs || data.docs.length === 0) {
      return res.status(404).json({ error: 'Book not found' });
    }
    // Pick the first result (even if it has no ISBN)
    const book = data.docs[0];
    const isbn = book.isbn && book.isbn.length > 0 ? book.isbn[0] : '';
    let coverUrl = '';
    if (isbn) {
      coverUrl = `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`;
    } else if (book.cover_i) {
      coverUrl = `https://covers.openlibrary.org/b/id/${book.cover_i}-L.jpg`;
    }
    res.json({
      isbn,
      title: book.title,
      cover: coverUrl
    });
  } catch (error) {
    console.error('Book lookup by title error:', error);
    res.status(500).json({ error: 'Failed to fetch book data' });
  }
});

// --- Review System ---
// POST /api/reviews
app.post('/api/reviews', async (req, res) => {
  const { bookId, userId, reviewText, rating, userName, userProfilePicture } = req.body;
  if (!bookId || !userId || !reviewText) {
    return res.status(400).json({ error: 'bookId, userId, and reviewText are required' });
  }
  try {
    const url = `https://api.airtable.com/v0/${AIRTABLE_CONFIG.baseId}/Reviews`;
    const headers = getAirtableHeaders();
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        fields: {
          BookID: bookId,
          UserID: String(userId),
          ReviewText: reviewText,
          Rating: rating || null,
          CreatedAt: new Date().toISOString(),
          UserName: userName || '',
          UserProfilePicture: userProfilePicture || ''
        }
      })
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to save review');
    }
    const data = await response.json();
    res.status(201).json({ review: data });
  } catch (error) {
    console.error('Save review error:', error);
    res.status(500).json({ error: error.message || 'Failed to save review' });
  }
});

// GET /api/reviews/:bookId
app.get('/api/reviews/:bookId', async (req, res) => {
  const { bookId } = req.params;
  if (!bookId) {
    return res.status(400).json({ error: 'bookId is required' });
  }
  try {
    const url = `https://api.airtable.com/v0/${AIRTABLE_CONFIG.baseId}/Reviews?filterByFormula={BookID}='${bookId}'`;
    const headers = getAirtableHeaders();
    const response = await fetch(url, { headers });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to fetch reviews');
    }
    const data = await response.json();
    const reviews = data.records.map(record => ({
      id: record.id,
      userId: record.fields.UserID,
      userName: record.fields.UserName || '',
      userProfilePicture: record.fields.UserProfilePicture || '',
      reviewText: record.fields.ReviewText,
      rating: record.fields.Rating,
      createdAt: record.fields.CreatedAt
    }));
    res.json({ reviews });
  } catch (error) {
    console.error('Fetch reviews error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch reviews' });
  }
});

// DELETE /api/reviews/:reviewId
app.delete('/api/reviews/:reviewId', async (req, res) => {
  console.log('DELETE /api/reviews/:reviewId called with reviewId:', req.params.reviewId);
  const { reviewId } = req.params;
  if (!reviewId) {
    return res.status(400).json({ error: 'reviewId is required' });
  }
  try {
    const url = `https://api.airtable.com/v0/${AIRTABLE_CONFIG.baseId}/Reviews/${reviewId}`;
    console.log('Deleting review from Airtable URL:', url);
    const headers = getAirtableHeaders();
    const response = await fetch(url, {
      method: 'DELETE',
      headers
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to delete review');
    }
    console.log('Review deleted successfully');
    res.status(200).json({ success: true, message: 'Review deleted successfully' });
  } catch (error) {
    console.error('Delete review error:', error);
    res.status(500).json({ error: error.message || 'Failed to delete review' });
  }
});

// GET /api/reviews/recent
app.get('/api/reviews/recent', async (req, res) => {
  try {
    const baseId = process.env.AIRTABLE_BASE_ID;
    const apiKey = process.env.AIRTABLE_API_KEY;
    if (!baseId || !apiKey) {
      return res.status(500).json({ error: 'Airtable configuration missing' });
    }
    const url = `https://api.airtable.com/v0/${baseId}/Reviews?sort%5B0%5D%5Bfield%5D=CreatedAt&sort%5B0%5D%5Bdirection%5D=desc&maxRecords=10`;
    const headers = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    };
    const response = await fetch(url, { headers });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Failed to fetch recent reviews');
    }
    const data = await response.json();
    res.set('Content-Type', 'application/json');
    res.json(data);
  } catch (error) {
    console.error('Fetch recent reviews error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch recent reviews' });
  }
});

// --- MOVIES/SHOWS ENDPOINTS ---
// Lookup by IMDb ID
app.get('/api/movies/:imdbId', async (req, res) => {
  const { imdbId } = req.params;
  if (!imdbId) {
    return res.status(400).json({ error: 'IMDb ID is required' });
  }
  try {
    const url = `${OMDB_API_URL}?i=${encodeURIComponent(imdbId)}&apikey=${OMDB_API_KEY}`;
    const response = await fetch(url);
    if (!response.ok) {
      return res.status(404).json({ error: 'Movie/show not found' });
    }
    const data = await response.json();
    if (data.Response === 'False') {
      return res.status(404).json({ error: data.Error || 'Movie/show not found' });
    }
    res.json({
      imdbId: data.imdbID,
      title: data.Title,
      poster: data.Poster,
      type: data.Type,
      year: data.Year
    });
  } catch (error) {
    console.error('Movie lookup error:', error);
    res.status(500).json({ error: 'Failed to fetch movie/show data' });
  }
});

// Lookup by title
app.get('/api/movies/title/:title', async (req, res) => {
  const { title } = req.params;
  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }
  try {
    const url = `${OMDB_API_URL}?t=${encodeURIComponent(title)}&apikey=${OMDB_API_KEY}`;
    const response = await fetch(url);
    if (!response.ok) {
      return res.status(404).json({ error: 'Movie/show not found' });
    }
    const data = await response.json();
    if (data.Response === 'False') {
      return res.status(404).json({ error: data.Error || 'Movie/show not found' });
    }
    res.json({
      imdbId: data.imdbID,
      title: data.Title,
      poster: data.Poster,
      type: data.Type,
      year: data.Year
    });
  } catch (error) {
    console.error('Movie lookup by title error:', error);
    res.status(500).json({ error: 'Failed to fetch movie/show data' });
  }
});

// Save movie/show to user's library
app.post('/api/movies/save', async (req, res) => {
  const { userId, imdbId, title, poster, type, year } = req.body;
  if (!userId || !imdbId || !title) {
    return res.status(400).json({ error: 'userId, imdbId, and title are required' });
  }
  try {
    const url = `https://api.airtable.com/v0/${AIRTABLE_CONFIG.baseId}/Movies`;
    const headers = getAirtableHeaders();
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        fields: {
          UserID: String(userId),
          IMDbID: imdbId,
          Title: title,
          Poster: poster || '',
          Type: type || '',
          Year: year || '',
          SavedAt: new Date().toISOString()
        }
      })
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to save movie/show');
    }
    const data = await response.json();
    res.status(201).json({ movie: data });
  } catch (error) {
    console.error('Save movie/show error:', error);
    res.status(500).json({ error: error.message || 'Failed to save movie/show' });
  }
});

// Get user's saved movies/shows
app.get('/api/movies/user/:userId', async (req, res) => {
  const { userId } = req.params;
  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }
  try {
    const url = `https://api.airtable.com/v0/${AIRTABLE_CONFIG.baseId}/Movies?filterByFormula={UserID}='${String(userId)}'`;
    const headers = getAirtableHeaders();
    const response = await fetch(url, { headers });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to fetch movies/shows');
    }
    const data = await response.json();
    const movies = data.records.map(record => ({
      id: record.id,
      imdbId: record.fields.IMDbID,
      title: record.fields.Title,
      poster: record.fields.Poster,
      type: record.fields.Type,
      year: record.fields.Year,
      savedAt: record.fields.SavedAt
    }));
    res.json({ movies });
  } catch (error) {
    console.error('Fetch user movies/shows error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch movies/shows' });
  }
});

// Delete saved movie/show
app.delete('/api/movies/:airtableId', async (req, res) => {
  const { airtableId } = req.params;
  if (!airtableId) {
    return res.status(400).json({ error: 'Movie/show ID is required' });
  }
  try {
    const url = `https://api.airtable.com/v0/${AIRTABLE_CONFIG.baseId}/Movies/${airtableId}`;
    const headers = getAirtableHeaders();
    const response = await fetch(url, {
      method: 'DELETE',
      headers
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to delete movie/show');
    }
    res.status(200).json({ success: true, message: 'Movie/show deleted successfully' });
  } catch (error) {
    console.error('Delete movie/show error:', error);
    res.status(500).json({ error: error.message || 'Failed to delete movie/show' });
  }
});

app.post('/api/upload/profile-picture', upload.single('profilePicture'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  const publicUrl = `/static/${req.file.filename}`;
  res.json({ url: publicUrl });
});

app.patch('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  const { name, email, profilePicture } = req.body;
  if (!id) {
    return res.status(400).json({ error: 'User ID is required' });
  }
  try {
    const url = `https://api.airtable.com/v0/${AIRTABLE_CONFIG.baseId}/${AIRTABLE_CONFIG.tableName}/${id}`;
    const headers = getAirtableHeaders();
    const fields = {};
    if (name) fields['Name'] = name;
    if (email) fields['Email'] = email;
    if (profilePicture) fields['ProfilePicture'] = profilePicture;
    const response = await fetch(url, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ fields })
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to update user');
    }
    const data = await response.json();
    res.json({ user: data });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: error.message || 'Failed to update user' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Airtable Base: ${AIRTABLE_CONFIG.baseId}`);
  console.log(`📋 Table Name: ${AIRTABLE_CONFIG.tableName}`);
});