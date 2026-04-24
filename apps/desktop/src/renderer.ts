import './index.css'

console.log('Renderer loaded (Vite)')

const app = document.getElementById('app')
if (app) {
  const p = document.createElement('p')
  p.textContent = 'Ordo desktop is running.'
  app.append(p)
}
