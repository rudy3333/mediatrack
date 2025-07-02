<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { LoginCredentials, RegisterCredentials } from '../types/auth';
  
  export let mode: 'login' | 'register' = 'login';
  export let isLoading = false;
  export let error = '';

  const dispatch = createEventDispatcher();

  let formData = {
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  };

  let errors = {
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  };

  function validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  function validateForm(): boolean {
    errors = {
      name: '',
      email: '',
      password: '',
      confirmPassword: ''
    };

    let isValid = true;

    if (mode === 'register') {
      if (!formData.name.trim()) {
        errors.name = 'Name is required';
        isValid = false;
      }
    }

    if (!formData.email.trim()) {
      errors.email = 'Email is required';
      isValid = false;
    } else if (!validateEmail(formData.email)) {
      errors.email = 'Please enter a valid email address';
      isValid = false;
    }

    if (!formData.password) {
      errors.password = 'Password is required';
      isValid = false;
    } else if (formData.password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
      isValid = false;
    }

    if (mode === 'register') {
      if (!formData.confirmPassword) {
        errors.confirmPassword = 'Please confirm your password';
        isValid = false;
      } else if (formData.password !== formData.confirmPassword) {
        errors.confirmPassword = 'Passwords do not match';
        isValid = false;
      }
    }

    return isValid;
  }

  function handleSubmit() {
    if (!validateForm()) return;

    if (mode === 'login') {
      const credentials: LoginCredentials = {
        email: formData.email,
        password: formData.password
      };
      dispatch('login', credentials);
    } else {
      const credentials: RegisterCredentials = {
        name: formData.name,
        email: formData.email,
        password: formData.password,
        confirmPassword: formData.confirmPassword
      };
      dispatch('register', credentials);
    }
  }

  function toggleMode() {
    mode = mode === 'login' ? 'register' : 'login';
    formData = {
      name: '',
      email: '',
      password: '',
      confirmPassword: ''
    };
    errors = {
      name: '',
      email: '',
      password: '',
      confirmPassword: ''
    };
    dispatch('modeChange', mode);
  }
</script>

<div class="auth-form">
  <div class="form-header">
    <h2>{mode === 'login' ? 'Sign In' : 'Create Account'}</h2>
  </div>

  {#if error}
    <div class="error-message">
      {error}
    </div>
  {/if}

  <form on:submit|preventDefault={handleSubmit}>
    {#if mode === 'register'}
      <div class="form-group">
        <label for="name">Full Name</label>
        <input
          type="text"
          id="name"
          bind:value={formData.name}
          class:error={errors.name}
          disabled={isLoading}
          placeholder="Enter your full name"
        />
        {#if errors.name}
          <span class="field-error">{errors.name}</span>
        {/if}
      </div>
    {/if}

    <div class="form-group">
      <label for="email">Email Address</label>
      <input
        type="email"
        id="email"
        bind:value={formData.email}
        class:error={errors.email}
        disabled={isLoading}
        placeholder="Enter your email"
      />
      {#if errors.email}
        <span class="field-error">{errors.email}</span>
      {/if}
    </div>

    <div class="form-group">
      <label for="password">Password</label>
      <input
        type="password"
        id="password"
        bind:value={formData.password}
        class:error={errors.password}
        disabled={isLoading}
        placeholder="Enter your password"
      />
      {#if errors.password}
        <span class="field-error">{errors.password}</span>
      {/if}
    </div>

    {#if mode === 'register'}
      <div class="form-group">
        <label for="confirmPassword">Confirm Password</label>
        <input
          type="password"
          id="confirmPassword"
          bind:value={formData.confirmPassword}
          class:error={errors.confirmPassword}
          disabled={isLoading}
          placeholder="Confirm your password"
        />
        {#if errors.confirmPassword}
          <span class="field-error">{errors.confirmPassword}</span>
        {/if}
      </div>
    {/if}

    <button type="submit" class="submit-btn" disabled={isLoading}>
      {#if isLoading}
        {mode === 'login' ? 'Signing in...' : 'Creating account...'}
      {:else}
        {mode === 'login' ? 'Sign In' : 'Create Account'}
      {/if}
    </button>
  </form>

  <div class="form-footer">
    <p>
      {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}
      <button type="button" class="link-btn" on:click={toggleMode} disabled={isLoading}>
        {mode === 'login' ? 'Sign up' : 'Sign in'}
      </button>
    </p>
  </div>
</div>

<style>
  .auth-form {
    background: white;
    border: 1px solid #ddd;
    border-radius: 4px;
    padding: 20px;
    margin: 20px 0;
  }

  .form-header {
    text-align: center;
    margin-bottom: 20px;
  }

  .form-header h2 {
    margin: 0;
    font-size: 24px;
  }

  .error-message {
    background: #ffebee;
    border: 1px solid #f44336;
    color: #d32f2f;
    padding: 10px;
    border-radius: 4px;
    margin-bottom: 20px;
    font-size: 14px;
  }

  .form-group {
    margin-bottom: 15px;
  }

  label {
    display: block;
    margin-bottom: 5px;
    font-weight: bold;
    font-size: 14px;
  }

  input {
    width: 100%;
    padding: 10px;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-size: 16px;
    box-sizing: border-box;
  }

  input:focus {
    border-color: #0066cc;
    outline: none;
  }

  input.error {
    border-color: #f44336;
  }

  input:disabled {
    background: #f5f5f5;
    cursor: not-allowed;
    opacity: 0.6;
  }

  .field-error {
    display: block;
    color: #f44336;
    font-size: 12px;
    margin-top: 5px;
  }

  .submit-btn {
    width: 100%;
    background: #0066cc;
    color: white;
    border: none;
    padding: 12px;
    border-radius: 4px;
    font-size: 16px;
    font-weight: bold;
    cursor: pointer;
  }

  .submit-btn:hover:not(:disabled) {
    background: #0052a3;
  }

  .submit-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .form-footer {
    text-align: center;
    margin-top: 20px;
    padding-top: 20px;
    border-top: 1px solid #eee;
  }

  .form-footer p {
    margin: 0;
    font-size: 14px;
  }

  .link-btn {
    background: none;
    border: none;
    color: #0066cc;
    font-weight: bold;
    cursor: pointer;
    font-size: 14px;
    text-decoration: underline;
    margin-left: 5px;
  }

  .link-btn:hover:not(:disabled) {
    color: #004499;
  }

  .link-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  @media (max-width: 480px) {
    .auth-form {
      margin: 10px 0;
      padding: 15px;
    }
  }
</style>