export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface AirtableRecord {
  id: string;
  fields: {
    Name: string;
    Email: string;
    Password: string;
    CreatedAt: string;
  };
}