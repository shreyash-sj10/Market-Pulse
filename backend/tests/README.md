# Test Suite Structure

- `unit/`: deterministic engine/service/middleware tests
- `integration/`: end-to-end route and persistence flow tests
- `concurrency/`: idempotency, race-safety, and parallel execution tests
- `security/`: auth, token, csrf, and refresh security tests

Run by category:

- `npm run test:unit`
- `npm run test:integration`
- `npm run test:concurrency`
- `npm run test:security`
