# Degov Agent

## OpenZeppelin Status Lifecycle

```typescript
enum ProposalState {
  Pending,
  Active,
  Canceled,
  Defeated,
  Succeeded,
  Queued,
  Expired,
  Executed,
}
```

```mathematia
                      ┌────────────┐
                      │  Pending   │
                      └────┬───────┘
                           │ votingDelay reached
                           ▼
                      ┌────────────┐
                      │   Active   │
                      └────┬───────┘
     ┌────────────┬────────┼─────────────┬─────────────┐
     │            │        │             │             │
     ▼            ▼        ▼             ▼             ▼
Canceled     Defeated   Succeeded    (manual)       (manual)
                        ┌──────┐      Cancel         Cancel
                        ▼
                    ┌──────────┐
                    │  Queued  │  <- Timelock
                    └────┬─────┘
                         │
                         ▼
                    ┌──────────┐
                    │ Executed │
                    └──────────┘

Or if the queue phase times out:
                    ▼
                ┌─────────┐
                │ Expired │
                └─────────┘

```
