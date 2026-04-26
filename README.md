# Feriados UI

Calendario visual para consultar feriados nacionais, regionais e municipais de
Portugal.

Esta app consome a API publica:

```text
https://feriados-red.vercel.app
```

## Desenvolvimento

```powershell
npm install
npm run dev
```

## Build

```powershell
npm run build
```

## Endpoints usados

```text
GET /regions
GET /municipalities
GET /coverage
GET /sources
GET /holidays?year=2026&region=Madeira&municipality=Funchal
```
