<script lang="ts">
  import { isAuthenticated, isLoading, setUser } from './lib/stores/auth';
  import { registerUser, loginUser } from './lib/services/auth';
  import AuthForm from './lib/components/AuthForm.svelte';
  import Dashboard from './lib/components/Dashboard.svelte';
  import type { LoginCredentials, RegisterCredentials } from './lib/types/auth';
  import AlbumSearch from './lib/components/AlbumSearch.svelte';

  let authMode: 'login' | 'register' = 'login';
  let authError = '';

  async function handleLogin(event: CustomEvent<LoginCredentials>) {
    authError = '';
    isLoading.set(true);

    try {
      const user = await loginUser(event.detail);
      setUser(user);
    } catch (error) {
      authError = error instanceof Error ? error.message : 'Login failed';
      console.error('Login error:', error);
    } finally {
      isLoading.set(false);
    }
  }

  async function handleRegister(event: CustomEvent<RegisterCredentials>) {
    authError = '';
    isLoading.set(true);

    try {
      const user = await registerUser(event.detail);
      setUser(user);
    } catch (error) {
      authError = error instanceof Error ? error.message : 'Registration failed';
      console.error('Registration error:', error);
    } finally {
      isLoading.set(false);
    }
  }

  function handleModeChange(event: CustomEvent<'login' | 'register'>) {
    authMode = event.detail;
    authError = '';
  }
</script>

<main class="app">
  <div class="content">
    {#if !$isAuthenticated}
      <div class="auth-container">
        <div class="app-header">
          <h1>mediatrack</h1>
        </div>

        <AuthForm
          bind:mode={authMode}
          isLoading={$isLoading}
          error={authError}
          on:login={handleLogin}
          on:register={handleRegister}
          on:modeChange={handleModeChange}
        />
      </div>
    {:else}
      <Dashboard />
    {/if}
  </div>
</main>

<style>
  .app {
    min-height: 100vh;
    padding: 20px;
    background-color: #f5f5f5;
  }

  .content {
    max-width: 800px;
    margin: 0 auto;
  }

  .auth-container {
    max-width: 400px;
    margin: 0 auto;
  }

  .app-header {
    text-align: center;
    margin-bottom: 30px;
    background: white;
    border: 1px solid #ddd;
    border-radius: 4px;
    padding: 20px;
  }

  .app-header h1 {
    font-size: 32px;
    margin-bottom: 10px;
  }


  @media (max-width: 480px) {
    .app {
      padding: 10px;
    }

    .app-header h1 {
      font-size: 24px;
    }
  }
</style>