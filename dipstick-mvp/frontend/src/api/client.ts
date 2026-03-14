/**
 * API Client
 * ==========
 * Thin wrapper around fetch/axios for backend communication.
 * All calls return typed responses matching the backend schemas.
 */

import axios from 'axios';
import type { AnalysisResponse } from '../types';

const BASE_URL = import.meta.env.VITE_API_URL ?? '';  // empty = use Vite proxy

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 60_000,   // Image uploads may be slow on mobile networks
});

// ---------------------------------------------------------------------------
// Analyze: POST /api/analyze
// ---------------------------------------------------------------------------

export async function analyzeImage(file: File): Promise<AnalysisResponse> {
  const form = new FormData();
  form.append('image', file);

  const response = await api.post<AnalysisResponse>('/api/analyze', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  return response.data;
}

// ---------------------------------------------------------------------------
// Demo: GET /api/demo (no image needed — returns seeded mock result)
// ---------------------------------------------------------------------------

export async function fetchDemo(): Promise<AnalysisResponse> {
  const response = await api.get<AnalysisResponse>('/api/demo');
  return response.data;
}

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

export async function checkHealth(): Promise<boolean> {
  try {
    await api.get('/api/health');
    return true;
  } catch {
    return false;
  }
}

export default api;
