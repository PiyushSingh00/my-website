# ScheduleIt Frontend

Static multi-page frontend for ScheduleIt. Nginx serves this directory and proxies `/api/*` to the backend.

## Local Checks

```bash
npm run check
```

## Runtime

- Static HTML, CSS, and browser JavaScript
- No frontend build step
- API calls are same-origin under `/api`
- Production web root: `/home/ubuntu/website-main`

## Production Notes

The production domain must point to the EC2 Elastic IP in the DNS provider. The current DNS provider for `scheduleit.co.in` is GoDaddy, not Route 53.
