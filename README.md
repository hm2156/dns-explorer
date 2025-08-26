# 🌐 DNS Explorer

DNS Explorer is an interactive tool that visualizes how DNS resolution works in real-time.

It has two parts:
- **Backend (FastAPI)**: Performs iterative DNS resolution (step by step through Root → TLD → Authoritative servers).
- **Frontend (React + Vite)**: Animated visualization of DNS queries, hops, and final IP resolution.

## Features

- Iterative DNS resolution (A, AAAA, CNAME).
- Built-in caching layer with TTL.
- Real-time animated frontend that shows:
  - Each DNS hop (root, TLD, authoritative).
  - Packet movement (queries & responses).
  - Final IP resolution with timing.
  - Narrated step list for non-experts ("Root referral → TLD referral → Authoritative answer").
- Works with any domain name you input.

## Tech Stack

### Backend
- FastAPI + Uvicorn
- dnspython (low-level DNS resolution)
- TTL cache (custom lightweight store)

### Frontend
- React + Vite
- TailwindCSS + Framer Motion
- Recharts (response time graphs)

## 📂 Repository Structure

```
dns-explorer/
├── dns-explorer-backend/     # FastAPI backend
│   ├── app/
│   │   ├── main.py           # FastAPI entrypoint
│   │   ├── resolver.py       # Iterative DNS resolution logic
│   │   └── cache.py          # TTL cache implementation
│   ├── requirements.txt      # Python dependencies
│   └── ...                   
│
├── dns-explorer-frontend/    # React + Vite frontend
│   ├── src/
│   │   ├── DnsHopExplorer.jsx  # Main visualization component
│   │   └── ...                 
│   ├── package.json
│   └── vite.config.js
│
└── README.md                 # Project documentation
```

## 📦 Running Locally

### 1. Clone repo
```bash
git clone https://github.com/hm2156/dns-explorer.git
cd dns-explorer
```

### 2. Backend (FastAPI)
```bash
cd dns-explorer-backend
python3 -m venv .venv
source .venv/bin/activate   # (Mac/Linux)
# or .venv\Scripts\activate # (Windows)
pip install -r requirements.txt

# Run server
uvicorn app.main:app --reload
```

Backend will be live at 👉 http://127.0.0.1:8000

Check health: http://127.0.0.1:8000/healthz

### 3. Frontend (React + Vite)
```bash
cd ../dns-explorer-frontend
npm install
npm run dev
```

Frontend will be live at 👉 http://127.0.0.1:5173

### 4. Usage
1. Open the frontend in your browser.
2. Enter a domain (e.g., www.google.com).
3. Select record type (A / AAAA / CNAME).
4. Click Resolve → watch the DNS path animate.

## ✨ Notes

- Implements iterative DNS resolution using dnspython.
- Includes a simple in-memory TTL cache.
- Visualization is designed for both desktop and mobile (with scroll/expand support).
