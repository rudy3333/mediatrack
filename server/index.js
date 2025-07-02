import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

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
      id: record.fields['User ID'],
      airtableId: record.id,
      name: record.fields.Name,
      email: record.fields.Email,
      password: record.fields.Password,
      createdAt: record.fields.CreatedAt
    };
  } catch (error) {
    console.error('Error fetching user by email:', error);
    throw error;
  }
}

// API Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Server is running',
    airtableConfigured: !!AIRTABLE_CONFIG.baseId && !!AIRTABLE_CONFIG.apiKey
  });
});

// Register user
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

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
          CreatedAt: new Date().toISOString()
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
      id: data.fields['User ID'],
      airtableId: data.id,
      name: data.fields.Name,
      email: data.fields.Email,
      createdAt: data.fields.CreatedAt
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
      createdAt: user.createdAt
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
          UserID: userId,
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
    const url = `https://api.airtable.com/v0/${AIRTABLE_CONFIG.baseId}/Books?filterByFormula={UserID}='${userId}'`;
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
  const { bookId, userId, reviewText, rating } = req.body;
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
          UserID: userId,
          ReviewText: reviewText,
          Rating: rating || null,
          CreatedAt: new Date().toISOString()
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