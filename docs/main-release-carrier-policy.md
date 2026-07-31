# Main-release carrier policy

Exact-head and latest-main request branches are immutable evidence carriers, not controller changes.

- Carrier pull requests must be closed without merge after their sanitized result is recorded.
- Public controller and reusable-profile changes must use separate branches and pull requests.
- A carrier never authorizes deployment or production database operations.
- If a carrier is merged accidentally, replace its request on a new carrier only after removing the stale residue from public `main`.
