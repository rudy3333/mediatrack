<script lang="ts">
  import { user, logout } from '../stores/auth';
  
  function handleLogout() {
    logout();
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