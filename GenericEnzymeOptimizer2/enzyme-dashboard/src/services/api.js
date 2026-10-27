import axios from 'axios'
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api',
  timeout: 120000,
})

export async function uploadDataset(file) {
  const body = new FormData()
  body.append('file', file)
  return (await api.post('/datasets/upload', body)).data
}

export async function runOptimization(payload) {
  return (await api.post('/optimization/run', payload)).data
}

export async function getMetrics() {
  return (await api.get('/results/metrics')).data
}
export async function predictActivity(payload) {
  return (await api.post('/predictions', payload)).data
}

export async function getPredictionInfo() {
  return (await api.get('/predictions/info')).data
}

export default api