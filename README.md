# ParkSmart — Singapore Parking Optimizer

Find the most optimal parking spot for your destination in Singapore, with real-time availability from LTA DataMall.

## Why I Built This

I once paid $25 just for parking on a trip to the CBD — more than the meal I went there for. I knew cheaper carparks existed nearby, but by the time I'd circled around and checked a few, I'd already wasted time and fuel. ParkSmart started from that frustration: I wanted a tool that could instantly tell me the cheapest, closest, and best-value carpark for wherever I was heading in Singapore, before I even left home.

## Features

- Real-time carpark availability from HDB, URA, and LTA carparks (updates every minute)
- Smart scoring engine that ranks carparks by cost, distance, and availability
- Accurate Singapore parking rates with daily cap detection
- Location search using OneMap API
- Interactive dark-themed map with numbered markers
- Full cost breakdown calculator
- One-tap Google Maps navigation

## Quick Setup

### 1. Get your free LTA API key

Go to https://datamall.lta.gov.sg/content/datamall/en/request-for-api.html and request an API key. It's free and usually approved within minutes.

### 2. Configure environment

```bash
cp .env.example .env.local
```

Edit `.env.local` and replace with your actual API key:

```
LTA_API_KEY=your_actual_key_here
```

### 3. Install and run

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Scoring Algorithm

Each carpark gets a score from 0-100 based on weighted factors:

- Cheapest: 60% cost, 20% distance, 20% availability
- Closest: 20% cost, 60% distance, 20% availability
- Balanced: 35% cost, 35% distance, 30% availability
- Best Value: 45% cost, 30% distance, 25% availability

## Parking Rates

Built-in Singapore public carpark rates:

- HDB Non-Central: $0.60/30min, $12/day cap
- HDB Central: $1.20/30min, $20/day cap
- Night parking (10:30pm-7am): $5 cap
- URA: Similar to HDB Central rates
- LTA (malls): ~$3.00/hr average, $30/day cap

## Tech Stack

- Next.js 14 (React + API routes)
- LTA DataMall API (real-time carpark availability)
- OneMap API (Singapore geocoding, free, no key needed)
- Leaflet (interactive map)
- Google Maps (navigation links)


